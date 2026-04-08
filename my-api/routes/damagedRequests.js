const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/damaged-requests?status=&soldier_id=&unit=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const { status, soldier_id, unit, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT dr.id, dr.soldier_id, dr.category, dr.item_name, dr.item_identifier, 
             dr.urgency, dr.description, dr.status, dr.created_at, dr.processed_at, dr.processed_by,
             u.username AS soldier_username, u.name AS soldier_name, u.unit AS soldier_unit,
             pu.username AS processed_by_username, pu.name AS processed_by_name
      FROM damaged_requests dr
      LEFT JOIN users u ON u.id = dr.soldier_id
      LEFT JOIN users pu ON pu.id = dr.processed_by
      WHERE 1=1`;
    const params = [];
    let p = 0;
    if (status) { p++; sql += ` AND LOWER(dr.status) = LOWER($${p})`; params.push(status); }
    if (soldier_id) { p++; sql += ` AND dr.soldier_id = $${p}`; params.push(Number(soldier_id)); }
    if (unit) { p++; sql += ` AND LOWER(u.unit) = LOWER($${p})`; params.push(String(unit).trim()); }
    // Sort: pending first, then newest first
    p++; sql += ` ORDER BY CASE WHEN LOWER(dr.status) = 'pending' THEN 0 ELSE 1 END, dr.created_at DESC LIMIT $${p}`; params.push(parseInt(limit));
    p++; sql += ` OFFSET $${p}`; params.push(parseInt(offset));
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching damaged requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/damaged-requests { soldier_id, category, item_name, item_identifier, urgency, description }
router.post('/', async (req, res) => {
  try {
    const { soldier_id, category, item_name, item_identifier, urgency, description } = req.body || {};
    
    if (!soldier_id || !category || !item_name || !urgency || !description) {
      return res.status(400).json({ error: 'soldier_id, category, item_name, urgency, and description are required' });
    }

    // Get soldier info for unit
    const soldierResult = await pool.query('SELECT id, username, name, unit FROM users WHERE id = $1', [soldier_id]);
    if (soldierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    const soldier = soldierResult.rows[0];

    // Find commander assigned to the soldier's unit
    let commanderId = null;
    if (soldier.unit) {
      try {
        const commanderResult = await pool.query(
          `SELECT id FROM users 
           WHERE LOWER(TRIM(role)) = 'commander' 
           AND LOWER(TRIM(unit)) = LOWER(TRIM($1))
           LIMIT 1`,
          [soldier.unit]
        );
        if (commanderResult.rows.length > 0) {
          commanderId = commanderResult.rows[0].id;
          console.log(`[DamagedRequests] Found commander ${commanderId} for unit "${soldier.unit}"`);
        } else {
          console.warn(`[DamagedRequests] No commander found for unit "${soldier.unit}"`);
        }
      } catch (commanderErr) {
        console.error('[DamagedRequests] Error finding commander:', commanderErr);
      }
    }

    // Insert damaged request
    const insertResult = await pool.query(
      `INSERT INTO damaged_requests (soldier_id, category, item_name, item_identifier, urgency, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [soldier_id, category, item_name, item_identifier, urgency, description]
    );
    const created = insertResult.rows[0];
    
    console.log(`[DamagedRequests] Created damaged request ID ${created.id} for soldier ${soldier_id}, commander_id: ${commanderId || 'NULL'}`);

    // Send push notification to commanders in the same unit
    try {
      const { sendNotificationsByFilter } = require('../services/firebaseService');
      await sendNotificationsByFilter({ role: 'commander', unit: soldier.unit, hasPushToken: true }, {
        title: '🔧 New Damaged Weapon Report',
        body: `${soldier.name || soldier.username} reported damaged ${item_name} (${urgency})`,
        data: {
          type: 'system',
          category: 'system',
          priority: 'high',
          damagedRequestId: created.id?.toString?.(),
          soldierId: soldier_id?.toString?.(),
          unit: soldier.unit || '',
        }
      });
    } catch (pushErr) {
      console.warn('Damaged request push warn:', pushErr?.message);
    }

    return res.status(201).json(created);
  } catch (err) {
    console.error('Error creating damaged request:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/damaged-requests/:id/approve { processed_by }
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { processed_by } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE damaged_requests SET status = 'approved', processed_at = NOW(), processed_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [processed_by || null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found or already processed' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error approving damaged request:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/damaged-requests/:id/reject { processed_by }
router.post('/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { processed_by } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE damaged_requests SET status = 'rejected', processed_at = NOW(), processed_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [processed_by || null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found or already processed' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error rejecting damaged request:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
