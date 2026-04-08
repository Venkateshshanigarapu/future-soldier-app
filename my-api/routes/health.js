const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper function to determine health status
function getHealthStatus(metricName, value) {
  if (value === null || value === undefined) return 'no_data';

  const thresholds = {
    spo2: { normal: [95, 100], critical: [90, 100] },
    heart_rate: { normal: [60, 100], critical: [50, 120] },
    temperature: { normal: [36.1, 37.5], critical: [35, 39] },
    blood_pressure: { normal: [90, 120], critical: [80, 160] }
  };

  const threshold = thresholds[metricName];
  if (!threshold) return 'normal';

  if (value < threshold.critical[0] || value > threshold.critical[1]) {
    return 'critical';
  } else if (value >= threshold.normal[0] && value <= threshold.normal[1]) {
    return 'normal';
  } else {
    return 'warning';
  }
}

// Removed parseBloodPressure as survival_table uses numeric blood_pressure

// GET /api/health/vitals/:userId - Get latest health vitals for a soldier
router.get('/vitals/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // First check if user exists and get identifying fields
    const userCheck = await pool.query('SELECT id, username, name, unit, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get survival data for heart_rate, temperature, blood_pressure, spo2
    const survivalResult = await pool.query(
      `SELECT s.heart_rate, s.temperature, s.blood_pressure, s.spo2, s.created_at
       FROM survival_table s
       JOIN devicemaster d ON s.device_id = d.device_id
       WHERE d.user_id = $1`,
      [userId]
    );

    const survivalData = survivalResult.rows.length > 0 ? survivalResult.rows[0] : null;

    if (!survivalData) {
      return res.json({
        user_id: parseInt(userId),
        blood_pressure: null,
        blood_pressure_systolic: null,
        blood_pressure_diastolic: null,
        spo2: null,
        heart_rate: null,
        temperature: null,
        recorded_at: null,
        status: {
          blood_pressure: 'no_data',
          spo2: 'no_data',
          heart_rate: 'no_data',
          temperature: 'no_data'
        }
      });
    }

    // Add status indicators for each vital
    const vitalsWithStatus = {
      user_id: parseInt(userId),
      blood_pressure: survivalData.blood_pressure,
      blood_pressure_systolic: null,
      blood_pressure_diastolic: null,
      spo2: survivalData.spo2,
      heart_rate: survivalData.heart_rate,
      temperature: survivalData.temperature,
      recorded_at: survivalData.created_at,
      status: {
        blood_pressure: getHealthStatus('blood_pressure', survivalData.blood_pressure),
        spo2: getHealthStatus('spo2', survivalData.spo2),
        heart_rate: getHealthStatus('heart_rate', survivalData.heart_rate),
        temperature: getHealthStatus('temperature', survivalData.temperature)
      }
    };

    res.json(vitalsWithStatus);
  } catch (err) {
    console.error('Error fetching health vitals:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// POST /api/health/vitals/:userId - Record new health vitals
router.post('/vitals/:userId', async (req, res) => {
  const { userId } = req.params;
  const {
    bp,
    spo2
  } = req.body;

  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find user's device
    const deviceResult = await pool.query('SELECT device_id FROM devicemaster WHERE user_id = $1 LIMIT 1', [userId]);
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'No device associated with user' });
    }
    const deviceId = deviceResult.rows[0].device_id;

    let result = await pool.query(
      `UPDATE survival_table SET
        blood_pressure = COALESCE($1, blood_pressure),
        spo2 = COALESCE($2, spo2)
      WHERE device_id = $3
      RETURNING *`,
      [bp, spo2, deviceId]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO survival_table (device_id, blood_pressure, spo2)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [deviceId, bp, spo2]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error recording health vitals:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/health/profile/:userId - Get health profile for a soldier
router.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get latest survival data for profile
    const result = await pool.query(
      `SELECT s.heart_rate, s.temperature, s.created_at
       FROM survival_table s
       JOIN devicemaster d ON s.device_id = d.device_id
       WHERE d.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        user_id: parseInt(userId),
        heart_rate: null,
        temperature: null,
        last_updated: null,
        status: {
          heart_rate: 'no_data',
          temperature: 'no_data'
        }
      });
    }

    const survival = result.rows[0];

    // Add status indicators for each metric
    const profileWithStatus = {
      user_id: parseInt(userId),
      heart_rate: survival.heart_rate,
      temperature: survival.temperature,
      last_updated: survival.created_at,
      status: {
        heart_rate: getHealthStatus('heart_rate', survival.heart_rate),
        temperature: getHealthStatus('temperature', survival.temperature)
      }
    };

    res.json(profileWithStatus);
  } catch (err) {
    console.error('Error fetching health profile:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// PUT /api/health/profile/:userId - Update health profile for a soldier
router.put('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const {
    heart_rate,
    temperature
  } = req.body;

  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find user's device
    const deviceResult = await pool.query('SELECT device_id FROM devicemaster WHERE user_id = $1 LIMIT 1', [userId]);
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'No device associated with user' });
    }
    const deviceId = deviceResult.rows[0].device_id;

    // Update survival_table
    const result = await pool.query(
      `UPDATE survival_table SET
        heart_rate = COALESCE($1, heart_rate),
        temperature = COALESCE($2, temperature)
      WHERE device_id = $3
      RETURNING *`,
      [heart_rate, temperature, deviceId]
    );

    if (result.rows.length === 0) {
      // Create new survival record if none exists
      const newResult = await pool.query(
        `INSERT INTO survival_table (device_id, heart_rate, temperature)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [deviceId, heart_rate, temperature]
      );
      res.json(newResult.rows[0]);
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error updating health profile:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/health/dashboard/:userId - Get complete health dashboard data
router.get('/dashboard/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, name, unit FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const survivalResult = await pool.query(
      `SELECT s.heart_rate, s.temperature, s.blood_pressure, s.spo2, s.created_at
       FROM survival_table s
       JOIN devicemaster d ON s.device_id = d.device_id
       WHERE d.user_id = $1`,
      [userId]
    );

    const survivalData = survivalResult.rows.length > 0 ? survivalResult.rows[0] : null;

    // Get current active mission(s) relevant to this user only
    const user = userCheck.rows[0];
    const username = user.username || null;
    const name = user.name || null;
    const unit = user.unit || null;

    console.log(`[Health Dashboard] User ID: ${userId}, Username: ${username}, Name: ${name}, Unit: ${unit}`);

    const missionResult = await pool.query(
      `SELECT 
        a.assignment_id as id,
        a.assignment_name as title,
        a.brief_description as description,
        LOWER(REPLACE(a.status, ' ', '_')) AS status,
        a.type as priority,
        a.created_at,
        a.destination,
        a.objectives,
        a.assigned_commander,
        a.sector,
        ub.name as assigned_by_name
       FROM assignments a
       LEFT JOIN units un ON a.unit_id = un.id
       LEFT JOIN users ub ON a.assigned_commander = ub.username
       WHERE 
         (
           a.assigned_commander = $1
           OR a.assigned_commander = $2
           OR a.unit_id = $3
           OR un.name = $4
         )
         AND (
           LOWER(REPLACE(a.status, ' ', '_')) IN ('in_progress', 'pending', 'active', 'ongoing')
           OR a.status IN ('Ongoing', 'Pending', 'Active', 'In Progress')
         )
       ORDER BY 
         CASE 
           WHEN LOWER(REPLACE(a.status, ' ', '_')) = 'pending' THEN 0
           WHEN LOWER(REPLACE(a.status, ' ', '_')) = 'in_progress' THEN 1
           WHEN LOWER(REPLACE(a.status, ' ', '_')) IN ('active','ongoing') THEN 2
           ELSE 3
         END,
         a.created_at DESC
       LIMIT 5`,
      [username, name, user.unit_id, unit]
    );

    console.log(`[Health Dashboard] Found ${missionResult.rows.length} missions for user ${userId}`);
    if (missionResult.rows.length > 0) {
      console.log(`[Health Dashboard] Mission details:`, JSON.stringify(missionResult.rows[0], null, 2));
    }

    let vitals, profile;

    if (!survivalData) {
      vitals = {
        user_id: parseInt(userId),
        blood_pressure: null,
        blood_pressure_systolic: null,
        blood_pressure_diastolic: null,
        spo2: null,
        heart_rate: null,
        temperature: null,
        recorded_at: null
      };
      profile = {
        user_id: parseInt(userId),
        heart_rate: null,
        temperature: null,
        last_updated: null
      };
    } else {
      vitals = {
        user_id: parseInt(userId),
        blood_pressure: survivalData.blood_pressure,
        blood_pressure_systolic: null,
        blood_pressure_diastolic: null,
        spo2: survivalData.spo2,
        heart_rate: survivalData.heart_rate,
        temperature: survivalData.temperature,
        recorded_at: survivalData.created_at
      };

      profile = {
        user_id: parseInt(userId),
        heart_rate: survivalData.heart_rate,
        temperature: survivalData.temperature,
        last_updated: survivalData.created_at
      };
    }

    const currentMissions = missionResult.rows || [];
    const currentMission = currentMissions[0] || null;

    // Add status indicators
    const vitalsWithStatus = {
      ...vitals,
      status: {
        blood_pressure: getHealthStatus('blood_pressure', vitals.blood_pressure),
        spo2: getHealthStatus('spo2', vitals.spo2),
        heart_rate: getHealthStatus('heart_rate', vitals.heart_rate),
        temperature: getHealthStatus('temperature', vitals.temperature)
      }
    };

    const profileWithStatus = {
      ...profile,
      status: {
        heart_rate: getHealthStatus('heart_rate', profile.heart_rate),
        temperature: getHealthStatus('temperature', profile.temperature)
      }
    };

    res.json({
      vitals: vitalsWithStatus,
      profile: profileWithStatus,
      currentMission: currentMission,
      currentMissions: currentMissions
    });
  } catch (err) {
    console.error('Error fetching health dashboard:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Test endpoint to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Health router is working', timestamp: new Date().toISOString() });
});

// GET /api/health/advanced/:userId - Get advanced health details for a user
router.get('/advanced/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log(`[Health] GET /advanced/${userId} - Request received`);
  console.log(`[Health] Full URL: ${req.method} ${req.originalUrl || req.url}`);
  console.log(`[Health] Route params:`, req.params);

  try {
    // First check if user exists and get profile fields from users table
    const userCheck = await pool.query(
      `SELECT id, username, role 
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userCheck.rows.length === 0) {
      console.log(`[Health] User ${userId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userCheck.rows[0];

    // Get advanced health details (unique per user_id)
    const result = await pool.query(
      `SELECT * FROM advanced_health_details WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    // Get health data from advanced_health_details if exists
    const health = result.rows.length > 0 ? result.rows[0] : null;

    // Get user's registration_request_id first
    const userResult = await pool.query(
      'SELECT registration_request_id FROM users WHERE id = $1',
      [userId]
    );

    let profile = null;
    if (userResult.rows.length > 0 && userResult.rows[0].registration_request_id) {
      // Get profile data from registration_requests using the foreign key
      const profileResult = await pool.query(
        'SELECT weight, height, age, gender, blood_group, bp FROM registration_requests WHERE id = $1',
        [userResult.rows[0].registration_request_id]
      );
      profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
    }

    // Map data from both tables
    const mappedHealth = {
      user_id: parseInt(userId),
      // Advanced health details (from advanced_health_details table)
      hdl: health?.hdl ?? null,
      ldl: health?.ldl ?? null,
      major_alignment: health?.major_alignment ?? null,
      majorAlignment: health?.major_alignment ?? null, // Frontend uses camelCase
      blood_sugar: health?.blood_sugar ?? null,
      bloodSugar: health?.blood_sugar ?? null, // Frontend uses camelCase
      precipitation: health?.precipitation ?? null,
      // Profile fields (from registration_requests table)
      weight: profile?.weight ?? null,
      height: profile?.height ?? null,
      age: profile?.age ?? null,
      gender: profile?.gender ?? null,
      blood_group: profile?.blood_group ?? null,
      bloodGroup: profile?.blood_group ?? null, // Frontend uses camelCase
      blood_pressure: profile?.bp ?? null,
      bloodPressure: profile?.bp ?? null, // Frontend uses camelCase
      created_at: health?.created_at ?? null,
      updated_at: health?.updated_at ?? null
    };

    res.json(mappedHealth);
  } catch (err) {
    console.error('Error fetching advanced health details:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      error: 'Database error',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// PUT /api/health/advanced/:userId - Create or update advanced health details for a user
router.put('/advanced/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log(`[Health] PUT /advanced/${userId} - Request received`);
  const {
    hdl,
    ldl,
    majorAlignment,
    major_alignment,
    bloodSugar,
    blood_sugar,
    precipitation,
    bloodPressure,
    blood_pressure,
    weight,
    height,
    age,
    gender,
    bloodGroup,
    blood_group
  } = req.body;

  try {
    // First check if user exists and get their registration_request_id
    const userCheck = await pool.query('SELECT id, username, role, registration_request_id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userCheck.rows[0];
    const existingRegistrationId = user.registration_request_id;

    // Use camelCase values if provided, otherwise use snake_case
    const majorAlignmentValue = majorAlignment || major_alignment;
    const bloodSugarValue = bloodSugar || blood_sugar;
    const bloodPressureValue = bloodPressure || blood_pressure;
    const bloodGroupValue = bloodGroup || blood_group;

    try {
      // Save medical data to advanced_health_details table
      const updateAdvancedQuery = `
        INSERT INTO advanced_health_details (
          user_id, hdl, ldl, major_alignment, blood_sugar, precipitation, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET
          hdl = EXCLUDED.hdl,
          ldl = EXCLUDED.ldl,
          major_alignment = EXCLUDED.major_alignment,
          blood_sugar = EXCLUDED.blood_sugar,
          precipitation = EXCLUDED.precipitation,
          updated_at = CURRENT_TIMESTAMP
      `;

      const advancedParams = [
        userId,
        hdl,
        ldl,
        majorAlignmentValue,
        bloodSugarValue,
        precipitation
      ];

      await pool.query(updateAdvancedQuery, advancedParams);

      // Save profile data to registration_requests table
      if (existingRegistrationId) {
        // Update existing registration request
        const updateProfileQuery = `
          UPDATE registration_requests SET
            weight = $1, height = $2, age = $3, gender = $4, 
            blood_group = $5, bp = $6, updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `;

        const profileParams = [
          weight,
          height,
          age,
          gender,
          bloodGroupValue,
          bloodPressureValue,
          existingRegistrationId
        ];

        await pool.query(updateProfileQuery, profileParams);
      } else {
        // Create new registration request and link to user
        const createProfileQuery = `
          INSERT INTO registration_requests (
            username, password, name, role, weight, height, age, gender, 
            blood_group, bp, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
          RETURNING id
        `;

        const profileParams = [
          'health_user', // default username for health records
          'health_password', // default password
          'Health Record', // default name
          'soldier', // default role
          weight,
          height,
          age,
          gender,
          bloodGroupValue,
          bloodPressureValue
        ];

        const result = await pool.query(createProfileQuery, profileParams);
        const newRegistrationId = result.rows[0].id;

        // Update user with new registration_request_id
        await pool.query('UPDATE users SET registration_request_id = $1 WHERE id = $2', [newRegistrationId, userId]);
      }

      console.log('[Health] Successfully saved data to both tables');
    } catch (error) {
      console.error('[Health] Error saving health data:', error);
      throw error;
    }

    // Return the updated data from both tables
    const advancedResult = await pool.query(
      'SELECT * FROM advanced_health_details WHERE user_id = $1',
      [userId]
    );

    const profileResult = await pool.query(
      'SELECT weight, height, age, gender, blood_group as blood_group, bp as blood_pressure FROM registration_requests WHERE user_id = $1',
      [userId]
    );

    if (!advancedResult || !advancedResult.rows || advancedResult.rows.length === 0) {
      console.error(`[Health] Failed to create/update advanced_health_details for user ${userId}`);
      return res.status(500).json({ error: 'Failed to save advanced health details' });
    }

    const advancedHealth = advancedResult.rows[0];
    const profileHealth = profileResult.rows.length > 0 ? profileResult.rows[0] : null;

    // Map database column names to frontend field names (merge both tables)
    const mappedHealth = {
      user_id: parseInt(userId),
      // Advanced health details (from advanced_health_details table)
      hdl: advancedHealth?.hdl ?? null,
      ldl: advancedHealth?.ldl ?? null,
      major_alignment: advancedHealth?.major_alignment ?? null,
      majorAlignment: advancedHealth?.major_alignment ?? null, // Frontend uses camelCase
      blood_sugar: advancedHealth?.blood_sugar ?? null,
      bloodSugar: advancedHealth?.blood_sugar ?? null, // Frontend uses camelCase
      precipitation: advancedHealth?.precipitation ?? null,
      // Profile fields (from registration_requests table)
      weight: profileHealth?.weight ?? null,
      height: profileHealth?.height ?? null,
      age: profileHealth?.age ?? null,
      gender: profileHealth?.gender ?? null,
      blood_group: profileHealth?.blood_group ?? null,
      bloodGroup: profileHealth?.blood_group ?? null, // Frontend uses camelCase
      blood_pressure: profileHealth?.blood_pressure ?? null,
      bloodPressure: profileHealth?.blood_pressure ?? null, // Frontend uses camelCase
      created_at: advancedHealth?.created_at ?? null,
      updated_at: advancedHealth?.updated_at ?? null
    };

    res.json(mappedHealth);
  } catch (err) {
    console.error('Error updating advanced health details:', err);
    console.error('Error stack:', err.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('User ID:', userId);
    res.status(500).json({
      error: 'Database error',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
