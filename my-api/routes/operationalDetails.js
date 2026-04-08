const express = require('express');
const router = express.Router();
const pool = require('../db');

const normalizeStatus = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['active', 'inactive'].includes(normalized)) {
    return normalized;
  }
  if (['yes', 'true', '1', 'enabled'].includes(normalized)) {
    return 'active';
  }
  if (['no', 'false', '0', 'disabled'].includes(normalized)) {
    return 'inactive';
  }
  return null;
};

const parseSkillIds = (skillIds) => {
  if (!Array.isArray(skillIds)) return [];
  return skillIds
    .map((id) => {
      const num = Number(id);
      return Number.isFinite(num) ? num : null;
    })
    .filter((id) => id !== null);
};

const coerceSpecialSkills = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry != null ? String(entry).trim() : null))
      .filter((entry) => entry && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (entry != null ? String(entry).trim() : null))
          .filter((entry) => entry && entry.length > 0);
      }
    } catch {}
    return [value.trim()].filter(Boolean);
  }
  return [];
};

// GET /api/operational-details/skills
router.get('/skills', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT skill_id AS id, skill_name AS name
       FROM skills
       WHERE skill_name IS NOT NULL AND LENGTH(TRIM(skill_name)) > 0
       ORDER BY skill_name ASC`
    );
    console.log('[OperationalDetails] Loaded skills:', rows.length);
    res.json(rows || []);
  } catch (error) {
    console.error('[OperationalDetails] Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// GET /api/operational-details/:userId
router.get('/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  try {
    const userResult = await pool.query(
      'SELECT id, role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      console.warn('[OperationalDetails] User not found for update – userId:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const detailsResult = await pool.query(
      `SELECT user_id, observation_role, status, special_skills
       FROM operation_details
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    const details = detailsResult.rows[0] || null;
    const storedSkillTokens = coerceSpecialSkills(details?.special_skills);

    const numericTokens = [];
    const nameTokens = [];
    storedSkillTokens.forEach((token) => {
      const numeric = Number(token);
      if (Number.isFinite(numeric) && token === String(numeric)) {
        numericTokens.push(numeric);
      } else {
        nameTokens.push(token);
      }
    });

    let skillLookupRows = [];
    if (numericTokens.length > 0) {
      const lookupById = await pool.query(
        `SELECT skill_id AS id, skill_name AS name
         FROM skills
         WHERE skill_id = ANY($1::int[])`,
        [numericTokens]
      );
      skillLookupRows = skillLookupRows.concat(lookupById.rows || []);
    }
    if (nameTokens.length > 0) {
      const lookupByName = await pool.query(
        `SELECT skill_id AS id, skill_name AS name
         FROM skills
         WHERE skill_name = ANY($1::text[])`,
        [nameTokens]
      );
      skillLookupRows = skillLookupRows.concat(lookupByName.rows || []);
    }

    const dedupedMap = new Map();
    skillLookupRows.forEach((row) => {
      if (!dedupedMap.has(row.id)) dedupedMap.set(row.id, row);
    });
    const dedupedSkills = Array.from(dedupedMap.values());

    const specialSkillIds = dedupedSkills.map((row) => row.id);
    const specialSkillNames = dedupedSkills.map((row) => row.name);
    const selectedSkills = dedupedSkills;

    const payload = {
      userId,
      userRole: user.role,
      role: details?.observation_role || user.role,
      status: details?.status || null,
      selectedSkills,
      specialSkillIds,
      specialSkillNames,
    };
    console.log('[OperationalDetails] Returning payload:', payload);
    res.json(payload);
  } catch (error) {
    console.error('[OperationalDetails] Error fetching details:', error);
    res.status(500).json({ error: 'Failed to fetch operational details' });
  }
});

// PUT /api/operational-details/:userId
router.put('/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const { status, specialSkillIds, role } = req.body || {};

  try {
    const userResult = await pool.query(
      'SELECT id, role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      console.warn('[OperationalDetails] User not found for save – userId:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) {
      return res.status(400).json({ error: 'Status must be Active or Inactive' });
    }
    const skillIds = parseSkillIds(specialSkillIds);

    const targetRole =
      typeof role === 'string' && role.trim().length > 0 ? role.trim().toLowerCase() : user.role;

    let skillsMeta = [];
    if (skillIds.length > 0) {
      const lookup = await pool.query(
        `SELECT skill_id AS id, skill_name AS name
         FROM skills
         WHERE skill_id = ANY($1::int[])`,
        [skillIds]
      );
      skillsMeta = lookup.rows || [];
    }
    const skillNames = skillsMeta.map((row) => row.name);
    const specialSkillsForStorage =
      skillNames.length > 0 ? skillNames : skillIds.map((id) => String(id));

    const upsertResult = await pool.query(
      `INSERT INTO operation_details (user_id, status, special_skills, observation_role, updated_at)
       VALUES ($1, $2, $3::text[], $4, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         special_skills = EXCLUDED.special_skills,
         observation_role = EXCLUDED.observation_role,
         updated_at = NOW()
       RETURNING user_id, observation_role AS role, status, special_skills`,
      [userId, normalizedStatus, specialSkillsForStorage, targetRole]
    );

    const saved = upsertResult.rows[0];

    let selectedSkills = [];
    let specialSkillNames = coerceSpecialSkills(saved.special_skills);
    if (skillsMeta.length === 0 && specialSkillNames.length > 0) {
      const lookup = await pool.query(
        `SELECT skill_id AS id, skill_name AS name
         FROM skills
         WHERE skill_name = ANY($1::text[])`,
        [specialSkillNames]
      );
      selectedSkills = lookup.rows || [];
    } else {
      selectedSkills = skillsMeta;
      if (specialSkillNames.length === 0) {
        specialSkillNames = skillsMeta.map((row) => row.name);
      }
    }

    if (selectedSkills.length > 0) {
      specialSkillNames = selectedSkills.map((row) => row.name);
    }

    const responseSkillIds =
      selectedSkills && selectedSkills.length > 0
        ? selectedSkills.map((row) => row.id)
        : skillIds;

    res.json({
      userId: saved.user_id,
      role: saved.role,
      status: saved.status,
      specialSkillIds: responseSkillIds,
      specialSkillNames,
      selectedSkills,
    });
  } catch (error) {
    console.error('[OperationalDetails] Error updating details:', error);
    res.status(500).json({ error: 'Failed to update operational details' });
  }
});

module.exports = router;

