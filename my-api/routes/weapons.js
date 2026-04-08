const express = require('express');
const router = express.Router();
const pool = require('../db');

// Ensure table exists (lightweight, idempotent)
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weapons (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL,
      caliber VARCHAR(50),
      manufacturer VARCHAR(100),
      weight_kg NUMERIC(8,2),
      effective_range_meters INTEGER,
      status VARCHAR(50) DEFAULT 'available',
      serial_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_weapons_type ON weapons(type);
    CREATE INDEX IF NOT EXISTS idx_weapons_status ON weapons(status);
  `);
  
  // Add columns if they don't exist (for existing tables)
  await pool.query(`
    ALTER TABLE weapons 
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100)
  `);
  
  // Update existing weapons to have status = 'available' if null
  await pool.query(`
    UPDATE weapons 
    SET status = 'available' 
    WHERE status IS NULL
  `);
};

// GET /api/weapons
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query('SELECT * FROM weapons ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/weapons
router.post('/', async (req, res) => {
  const { name, type, caliber, manufacturer, weight_kg, effective_range_meters } = req.body || {};
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `INSERT INTO weapons (name, type, caliber, manufacturer, weight_kg, effective_range_meters)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, caliber || null, manufacturer || null, weight_kg ?? null, effective_range_meters ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/weapons/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, caliber, manufacturer, weight_kg, effective_range_meters } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE weapons SET
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         caliber = COALESCE($3, caliber),
         manufacturer = COALESCE($4, manufacturer),
         weight_kg = COALESCE($5, weight_kg),
         effective_range_meters = COALESCE($6, effective_range_meters),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name ?? null, type ?? null, caliber ?? null, manufacturer ?? null, weight_kg ?? null, effective_range_meters ?? null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Weapon not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== SOLDIER WEAPON ASSIGNMENT ENDPOINTS ==============

// GET /api/weapons/assigned/:soldierId
// Get all weapons assigned to a specific soldier
router.get('/assigned/:soldierId', async (req, res) => {
  const { soldierId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT 
        sw.id AS assignment_id,
        sw.soldier_id,
        sw.status,
        sw.assigned_at,
        sw.notes,
        w.id AS weapon_id,
        w.name AS weapon_name,
        w.type AS weapon_type,
        w.caliber,
        w.manufacturer,
        w.weight_kg,
        w.effective_range_meters,
        u.name AS assigned_by_name,
        sw.assigned_by
      FROM soldier_weapons sw
      JOIN weapons w ON sw.weapon_id = w.id
      LEFT JOIN users u ON sw.assigned_by = u.id
      WHERE sw.soldier_id = $1 AND sw.status = 'active'
      ORDER BY sw.assigned_at DESC`,
      [soldierId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weapons/available
// Get all available weapons (status = 'available' OR not actively assigned)
router.get('/available', async (req, res) => {
  try {
    // Get all weapons that are:
    // 1. Have status = 'available' in weapons table, OR
    // 2. Are NOT actively assigned in soldier_weapons table (status = 'active')
    // Include serial_number and current status
    const { rows } = await pool.query(
      `SELECT 
        w.id,
        w.name,
        w.type,
        w.caliber,
        w.manufacturer,
        w.weight_kg,
        w.effective_range_meters,
        w.serial_number,
        w.created_at,
        w.updated_at,
        COALESCE(
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM soldier_weapons sw 
              WHERE sw.weapon_id = w.id AND sw.status = 'active'
            ) THEN 'assigned'
            WHEN w.status = 'available' THEN 'available'
            ELSE COALESCE(w.status, 'available')
          END,
          'available'
        ) AS current_status
       FROM weapons w
       WHERE 
         (w.status = 'available' OR w.status IS NULL)
         AND w.id NOT IN (
           SELECT DISTINCT weapon_id 
           FROM soldier_weapons 
           WHERE status = 'active'
         )
       ORDER BY w.name ASC, w.id ASC`
    );
    
    console.log(`[Weapons] Available weapons query returned ${rows.length} weapons`);
    res.json(rows);
  } catch (err) {
    console.error('[Weapons] Error fetching available weapons:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/weapons/assign
// Assign a weapon to a soldier
router.post('/assign', async (req, res) => {
  const { soldier_id, weapon_id, assigned_by, notes } = req.body || {};
  if (!soldier_id || !weapon_id || !assigned_by) {
    return res.status(400).json({ error: 'soldier_id, weapon_id, and assigned_by are required' });
  }
  try {
    // Check if weapon is already assigned
    const existing = await pool.query(
      `SELECT id FROM soldier_weapons 
       WHERE soldier_id = $1 AND weapon_id = $2 AND status = 'active'`,
      [soldier_id, weapon_id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Weapon is already assigned to this soldier' });
    }
    
    // Assign the weapon
    const { rows } = await pool.query(
      `INSERT INTO soldier_weapons (soldier_id, weapon_id, assigned_by, notes, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [soldier_id, weapon_id, assigned_by, notes || null]
    );
    
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/weapons/unassign/:assignmentId
// Unassign/Return a weapon from a soldier
router.post('/unassign/:assignmentId', async (req, res) => {
  const { assignmentId } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE soldier_weapons 
       SET status = 'returned', returned_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [assignmentId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found or already returned' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


