const express = require('express');
const router = express.Router();
const pool = require('../db');

// Ensure table exists
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ammunition (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      caliber VARCHAR(50) NOT NULL,
      description TEXT,
      weight_per_round_grams NUMERIC(8,2),
      muzzle_velocity_mps INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ammunition_caliber ON ammunition(caliber);
  `);
};

// GET /api/ammunition
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query('SELECT * FROM ammunition ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ammunition
router.post('/', async (req, res) => {
  const { type, caliber, description, weight_per_round_grams, muzzle_velocity_mps } = req.body || {};
  if (!type || !caliber) return res.status(400).json({ error: 'type and caliber are required' });
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `INSERT INTO ammunition (type, caliber, description, weight_per_round_grams, muzzle_velocity_mps)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [type, caliber, description || null, weight_per_round_grams ?? null, muzzle_velocity_mps ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ammunition/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { type, caliber, description, weight_per_round_grams, muzzle_velocity_mps } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE ammunition SET
         type = COALESCE($1, type),
         caliber = COALESCE($2, caliber),
         description = COALESCE($3, description),
         weight_per_round_grams = COALESCE($4, weight_per_round_grams),
         muzzle_velocity_mps = COALESCE($5, muzzle_velocity_mps),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [type ?? null, caliber ?? null, description ?? null, weight_per_round_grams ?? null, muzzle_velocity_mps ?? null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ammunition not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


