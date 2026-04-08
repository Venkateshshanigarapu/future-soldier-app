const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/supply-requests?status=&commander_id=&soldier_id=&unit=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const { status, commander_id, soldier_id, unit, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT sr.id, sr.soldier_id, sr.commander_id, sr.type, sr.urgency, sr.details, sr.status,
             sr.created_at, sr.processed_at, sr.processed_by,
             su.username AS soldier_username, su.name AS soldier_name,
             su."EmployeeID" AS soldier_employee_id, su.unit AS soldier_unit,
             cu.username AS commander_username, cu.name AS commander_name,
             pu.username AS processed_by_username, pu.name AS processed_by_name
      FROM supply_requests sr
      LEFT JOIN users su ON su.id = sr.soldier_id
      LEFT JOIN users cu ON cu.id = sr.commander_id
      LEFT JOIN users pu ON pu.id = sr.processed_by
      WHERE 1=1`;
    const params = [];
    let p = 0;
    if (status) { p++; sql += ` AND LOWER(sr.status) = LOWER($${p})`; params.push(status); }
    if (commander_id) { p++; sql += ` AND sr.commander_id = $${p}`; params.push(Number(commander_id)); }
    if (soldier_id) { p++; sql += ` AND sr.soldier_id = $${p}`; params.push(Number(soldier_id)); }
    if (unit) { p++; sql += ` AND LOWER(su.unit) = LOWER($${p})`; params.push(String(unit).trim()); }
    // Sort: pending first, then newest first
    p++; sql += ` ORDER BY CASE WHEN LOWER(sr.status) = 'pending' THEN 0 ELSE 1 END, sr.created_at DESC LIMIT $${p}`; params.push(parseInt(limit));
    p++; sql += ` OFFSET $${p}`; params.push(parseInt(offset));
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching supply requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supply-requests  { soldier_id, type, urgency, details }
// Creates a new request and notifies commanders in the soldier's unit
router.post('/', async (req, res) => {
  try {
    const { soldier_id, type, urgency, details } = req.body || {};
    if (!soldier_id || !type || !urgency) {
      return res.status(400).json({ error: 'soldier_id, type, and urgency are required' });
    }

    // Get soldier info for unit
    const su = await pool.query('SELECT id, username, name, unit FROM users WHERE id = $1', [soldier_id]);
    if (su.rows.length === 0) return res.status(404).json({ error: 'Soldier not found' });
    const soldier = su.rows[0];

    // Find commander assigned to the soldier's unit
    let commanderId = null;
    if (soldier.unit) {
      try {
        // Find a commander with the same unit (case-insensitive, trimmed)
        const commanderResult = await pool.query(
          `SELECT id FROM users 
           WHERE LOWER(TRIM(role)) = 'commander' 
           AND LOWER(TRIM(unit)) = LOWER(TRIM($1))
           LIMIT 1`,
          [soldier.unit]
        );
        if (commanderResult.rows.length > 0) {
          commanderId = commanderResult.rows[0].id;
          console.log(`[SupplyRequests] Found commander ${commanderId} for unit "${soldier.unit}"`);
        } else {
          console.warn(`[SupplyRequests] No commander found for unit "${soldier.unit}"`);
        }
      } catch (commanderErr) {
        console.error('[SupplyRequests] Error finding commander:', commanderErr);
        // Continue without commander_id if lookup fails
      }
    }

    // Insert request with auto-filled fields:
    // - commander_id: ID of commander in soldier's unit
    // - processed_at: CURRENT_TIMESTAMP (when request was submitted)
    // - processed_by: soldier_id (the soldier submitting the request)
    // - status: 'pending' (default)
    const ins = await pool.query(
      `INSERT INTO supply_requests (soldier_id, commander_id, type, urgency, details, status, processed_at, processed_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, $1)
       RETURNING *`,
      [soldier_id, commanderId, type, urgency, details || null]
    );
    const created = ins.rows[0];
    
    console.log(`[SupplyRequests] Created request ID ${created.id} for soldier ${soldier_id}, commander_id: ${commanderId || 'NULL'}, processed_by: ${soldier_id}`);

    // Send push to commanders in the same unit
    try {
      const { sendNotificationsByFilter } = require('../services/firebaseService');
      await sendNotificationsByFilter({ role: 'commander', unit: soldier.unit, hasPushToken: true }, {
        title: '📦 New Supply Request',
        body: `${soldier.name || soldier.username} requested ${type} (${urgency})`,
        data: {
          type: 'system',
          category: 'system',
          priority: 'high',
          requestId: created.id?.toString?.(),
          soldierId: soldier_id?.toString?.(),
          unit: soldier.unit || '',
        }
      });
    } catch (pushErr) {
      console.warn('Supply request push warn:', pushErr?.message);
    }

    return res.status(201).json(created);
  } catch (err) {
    console.error('Error creating supply request:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supply-requests/:id/approve { processed_by }
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { processed_by } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE supply_requests SET status = 'approved', processed_at = NOW(), processed_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [processed_by || null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found or already processed' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error approving supply request:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supply-requests/:id/reject { processed_by }
router.post('/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { processed_by } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE supply_requests SET status = 'rejected', processed_at = NOW(), processed_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [processed_by || null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found or already processed' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error rejecting supply request:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


