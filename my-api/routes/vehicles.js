const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/vehicles
router.get('/', async (req, res) => {
  try {
    // Basic healthy response; expand with real schema when available
    // If a vehicles table exists, you can uncomment and adapt the query below
    // const { rows } = await pool.query('SELECT * FROM vehicles ORDER BY id');
    // return res.json(rows);
    return res.json({ message: 'Vehicles endpoint is active' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

