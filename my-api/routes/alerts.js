const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendFirebaseNotification, sendNotificationsByFilter, sendTopicNotification } = require('../services/firebaseService');

// GET /api/alerts - Get all alerts with filtering (matches simple alerts schema)
router.get('/', async (req, res) => {
  const { status, severity, category, unit, userId, limit = 50, offset = 0 } = req.query;
  try {
    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    let p = 0;

    // Security: Prevent dumping all alerts if no filters are provided
    if (!status && !severity && !category && !unit && !userId) {
      // Return empty array instead of exposing all data
      return res.json([]);
    }

    if (status) { p++; query += ` AND status = $${p}`; params.push(status); }
    if (severity) { p++; query += ` AND severity = $${p}`; params.push(severity); }
    if (category) { p++; query += ` AND category = $${p}`; params.push(category); }
    if (unit) { p++; query += ` AND unit = $${p}`; params.push(unit); }
    if (userId) { p++; query += ` AND user_id = $${p}`; params.push(parseInt(userId)); }

    query += ' ORDER BY created_at DESC';
    p++; query += ` LIMIT $${p}`; params.push(parseInt(limit));
    p++; query += ` OFFSET $${p}`; params.push(parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/:id - Get specific alert
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM alerts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts - Create a new alert. Central listener in index.js handles push + history.
router.post('/', async (req, res) => {
  const { category, message, severity = 'medium', status = 'active', userId, unit, data } = req.body;
  try {
    if (!category || !message) {
      return res.status(400).json({ error: 'category and message are required' });
    }

    // Insert alert row. index.js handles the rest via LISTEN/NOTIFY.
    const insert = await pool.query(
      `INSERT INTO alerts (category, message, severity, status, user_id, unit, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [category, message, severity, status, userId || null, unit || null, data || {}]
    );
    const alert = insert.rows[0];

    return res.status(201).json({ alert, message: 'Alert created successfully. Notifications are being processed.' });
  } catch (err) {
    console.error('Error creating alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/test-push - Test push notification system
router.post('/test-push', async (req, res) => {
  const { userId, unit, type = 'test', message = 'This is a test notification' } = req.body;

  try {
    console.log('🧪 Testing push via central listener...');

    // Simply insert a test alert.
    const result = await pool.query(
      `INSERT INTO alerts (category, message, severity, status, user_id, unit, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [type, message, 'medium', 'active', userId || null, unit || null, { isTest: true }]
    );

    return res.status(200).json({
      success: true,
      message: 'Test alert recorded. Watch server logs for notification processing.',
      alert: result.rows[0]
    });

  } catch (err) {
    console.error('❌ Error in test push:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/alerts/test-emergency - Test emergency notification
router.post('/test-emergency', async (req, res) => {
  const { severity = 'high', message = 'This is a test emergency alert' } = req.body;

  try {
    console.log('🚨 Testing emergency alert via central listener...');

    // Insert emergency test alert.
    const result = await pool.query(
      `INSERT INTO alerts (category, message, severity, status, user_id, unit, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      ['emergency', message, severity, 'active', null, null, { isTest: true, sound: 'emergency' }]
    );

    return res.status(200).json({
      success: true,
      message: 'Emergency test alert recorded.',
      alert: result.rows[0]
    });

  } catch (err) {
    console.error('❌ Error in emergency test:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Note: Additional specialized alert routes can be implemented similarly, using the same schema

// PUT /api/alerts/:id/mark-read - Mark an alert as read
router.put('/:id/mark-read', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // First check if alert exists
    const alertResult = await pool.query(
      'SELECT * FROM alerts WHERE id = $1',
      [id]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Update the alert to mark as read
    const result = await pool.query(
      'UPDATE alerts SET read = true, read_at = NOW(), read_by = $2 WHERE id = $1 RETURNING *',
      [id, userId]
    );

    res.json({ success: true, alert: result.rows[0] });
  } catch (err) {
    console.error('Error marking alert as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert (also pushes to creator or unit)
router.put('/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  const { acknowledgedBy } = req.body;

  try {
    if (!acknowledgedBy) {
      return res.status(400).json({ error: 'acknowledgedBy is required' });
    }

    const result = await pool.query(
      `UPDATE alerts SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [acknowledgedBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updated = result.rows[0];

    // Push notify: inform creator or unit subscribers that alert was acknowledged
    try {
      const push = {
        title: 'Alert Acknowledged',
        body: `Alert #${id} acknowledged`,
        data: { type: 'alert-ack', alertId: String(id) }
      };
      if (updated.user_id) {
        await sendFirebaseNotification(updated.user_id, push);
      } else if (updated.unit) {
        await sendNotificationsByFilter({ unit: updated.unit, hasPushToken: true }, push);
      }
    } catch (_) { }

    res.json(updated);
  } catch (err) {
    console.error('Error acknowledging alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/resolve - Resolve an alert (also pushes)
router.put('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolvedBy, resolutionNotes } = req.body;

  try {
    if (!resolvedBy) {
      return res.status(400).json({ error: 'resolvedBy is required' });
    }

    const result = await pool.query(
      `UPDATE alerts SET status = 'resolved', resolved_by = $1, resolved_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [resolvedBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updated = result.rows[0];
    try {
      const push = {
        title: 'Alert Resolved',
        body: `Alert #${id} resolved`,
        data: { type: 'alert-resolve', alertId: String(id) }
      };
      if (updated.user_id) {
        await sendFirebaseNotification(updated.user_id, push);
      } else if (updated.unit) {
        await sendNotificationsByFilter({ unit: updated.unit, hasPushToken: true }, push);
      }
    } catch (_) { }

    res.json(updated);
  } catch (err) {
    console.error('Error resolving alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:id - Delete an alert
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM alerts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    console.error('Error deleting alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/stats/summary - Get alert statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
        COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_alerts,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_alerts,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_alerts
      FROM alerts
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Error fetching alert statistics:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 