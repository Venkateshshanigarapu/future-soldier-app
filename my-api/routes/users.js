const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { sendAssignmentNotification } = require('../services/firebaseService');

// GET /api/users
router.get('/', async (req, res) => {
  const { username, role, unit, unit_id, sortBy = 'name' } = req.query;
  try {
    if (username) {
      // Join with units table to ensure we get the unit name if unit_id is present but unit string is null
      const result = await pool.query(`
        SELECT u.*, 
               COALESCE(u.unit, un.name) as unit 
        FROM users u
        LEFT JOIN units un ON u.unit_id = un.id
        WHERE u.username = $1
      `, [username]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(result.rows[0]);
    } else if (role && unit_id) {
      // Filter by role and unit_id (numeric) - ensures only soldiers from the specified unit are returned
      const unitIdNum = parseInt(unit_id);
      if (isNaN(unitIdNum)) {
        return res.status(400).json({ error: 'unit_id must be a valid number' });
      }
      // Sort by name or rank (if rank column exists, otherwise by name)
      const orderBy = sortBy === 'rank' ? 'COALESCE(rank, name), name' : 'name';
      console.log(`[Users] Fetching ${role} with unit_id: ${unitIdNum}`);
      // Handle role variations - if role is 'soldier', include all non-commander roles
      let query, params;
      if (role.toLowerCase() === 'soldier') {
        // For 'soldier' role, fetch all non-commander users with matching unit_id
        query = `SELECT * FROM users WHERE LOWER(role) != 'commander' AND unit_id = $1 ORDER BY ${orderBy} ASC`;
        params = [unitIdNum];
      } else {
        query = `SELECT * FROM users WHERE LOWER(role) = LOWER($1) AND unit_id = $2 ORDER BY ${orderBy} ASC`;
        params = [role, unitIdNum];
      }
      const result = await pool.query(query, params);
      console.log(`[Users] Found ${result.rows.length} ${role}(s) for unit_id ${unitIdNum}`);
      // Debug: Show what unit_ids actually exist
      if (result.rows.length === 0) {
        const debugResult = await pool.query(
          'SELECT DISTINCT unit_id FROM users WHERE LOWER(role) = LOWER($1) AND unit_id IS NOT NULL',
          [role]
        );
        console.log(`[Users] Available unit_ids for ${role}:`, debugResult.rows.map(r => r.unit_id));
      }
      return res.json(result.rows);
    } else if (role && unit) {
      // Filter by role and unit name (string) - for backward compatibility
      const unitTrimmed = String(unit).trim();
      console.log(`[Users] Fetching ${role} with unit: "${unitTrimmed}"`);
      // Handle role variations - if role is 'soldier', include all non-commander roles
      let query, params;
      if (role.toLowerCase() === 'soldier') {
        // For 'soldier' role, fetch all non-commander users with matching unit
        query = `SELECT * FROM users WHERE LOWER(role) != 'commander' AND LOWER(TRIM(unit)) = LOWER($1) ORDER BY name ASC`;
        params = [unitTrimmed];
      } else {
        query = `SELECT * FROM users WHERE LOWER(role) = LOWER($1) AND LOWER(TRIM(unit)) = LOWER($2) ORDER BY name ASC`;
        params = [role, unitTrimmed];
      }
      const result = await pool.query(query, params);
      console.log(`[Users] Found ${result.rows.length} ${role}(s) with unit "${unitTrimmed}"`);
      // Debug: Show what units actually exist
      if (result.rows.length === 0) {
        const debugResult = await pool.query(
          'SELECT DISTINCT unit FROM users WHERE LOWER(role) = LOWER($1) AND unit IS NOT NULL',
          [role]
        );
        console.log(`[Users] Available units for ${role}:`, debugResult.rows.map(r => r.unit));
      }
      return res.json(result.rows);
    } else if (role) {
      // Sort by name or rank
      const orderBy = sortBy === 'rank' ? 'COALESCE(rank, name), name' : 'name';
      const result = await pool.query(
        `SELECT * FROM users WHERE LOWER(role) = LOWER($1) ORDER BY ${orderBy} ASC`,
        [role]
      );
      return res.json(result.rows);
    } else if (unit_id) {
      // Filter by unit_id only
      const unitIdNum = parseInt(unit_id);
      if (isNaN(unitIdNum)) {
        return res.status(400).json({ error: 'unit_id must be a valid number' });
      }
      const orderBy = sortBy === 'rank' ? 'COALESCE(rank, name), name' : 'name';
      const result = await pool.query(
        `SELECT * FROM users WHERE unit_id = $1 ORDER BY ${orderBy} ASC`,
        [unitIdNum]
      );
      return res.json(result.rows);
    } else if (unit) {
      const result = await pool.query('SELECT * FROM users WHERE LOWER(unit) = LOWER($1) ORDER BY name ASC', [unit]);
      return res.json(result.rows);
    } else {
      const result = await pool.query('SELECT * FROM users ORDER BY name ASC');
      res.json(result.rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/register
router.post('/register', async (req, res) => {
  const {
    username,
    password,
    name,
    role,
    email,
    unit_name,
    category,
    phone_no,
    id_no,
    age,
    gender,
    height,
    weight,
    bp,
    blood_group
  } = req.body;

  if (!username || !password || !role || !name || !id_no) {
    return res.status(400).json({ error: 'Missing required fields: username, password, role, name, and ID Number are required' });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (
        username, password, name, role, email, unit, category, 
        "MobileNumber", "EmployeeID", latitude, longitude, heading,
        age, gender, height, weight, bp, blood_group
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING id, username, name, role, email, unit, category, "MobileNumber", "EmployeeID", latitude, longitude, heading, age, gender, height, weight, bp, blood_group`,
      [
        username,
        hashedPassword,
        name,
        role,
        email || null,
        unit_name || null,
        category || null,
        phone_no || null,
        id_no,
        0, // latitude default
        0, // longitude default
        0, // heading default
        age ? parseInt(age) : null,
        gender || null,
        height || null,
        weight || null,
        bp || null,
        blood_group || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[REGISTER] Backend error:', err);
    if (err.stack) console.error(err.stack);
    if (err.detail) console.error('DB Detail:', err.detail);
    if (err.hint) console.error('DB Hint:', err.hint);
    if (err.code) console.error('DB Code:', err.code);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
    }
    res.status(500).json({ error: err.message || 'Server error during registration' });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login request payload:', req.body);
  if (!username || !password) {
    console.log('Login error: Missing username or password');
    return res.status(400).json({ error: 'Missing username or password' });
  }
  try {
    console.log(`[LOGIN] Checking user: ${username}`);

    // Get current timestamp for login tracking
    const currentTimestamp = new Date();

    const result = await pool.query(
      `SELECT u.id, u.username, u.password, u.name, u.role, u.email, 
              COALESCE(u.unit, un.name) as unit, 
              u.unit_id, u.photo 
       FROM users u
       LEFT JOIN units un ON u.unit_id = un.id
       WHERE u.username = $1`,
      [username]
    );

    console.log(`[LOGIN] Users table query result: ${result.rows.length} rows found`);

    // Additional debugging: Check if user exists in registration_requests table regardless of status
    const allRegRequests = await pool.query(
      'SELECT username, status, created_at FROM registration_requests WHERE username = $1',
      [username]
    );
    console.log(`[LOGIN] Registration_requests table query result: ${allRegRequests.rows.length} total rows found`);
    if (allRegRequests.rows.length > 0) {
      console.log(`[LOGIN] Registration_requests details:`, allRegRequests.rows);
    }

    if (result.rows.length === 0) {
      console.log(`[LOGIN] User not found in users table, checking registration_requests...`);

      // Check if user exists in registration_requests with pending status
      const pendingResult = await pool.query(
        'SELECT username, status, created_at FROM registration_requests WHERE username = $1 AND status = $2',
        [username, 'pending']
      );

      console.log(`[LOGIN] Registration_requests query result: ${pendingResult.rows.length} pending rows found`);

      if (pendingResult.rows.length > 0) {
        console.log('Login error: User registration is pending approval');
        return res.status(403).json({
          error: 'Your registration is pending approval. Please wait for an administrator to approve your account.',
          status: 'pending_approval',
          registeredAt: pendingResult.rows[0].created_at
        });
      }

      console.log('Login error: Invalid credentials (user not found in either table)');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    // Normalize role to lowercase and restrict to 'commander' or 'soldier'
    if (user.role) {
      const normalizedRole = user.role.toLowerCase();
      if (normalizedRole === 'commander') {
        user.role = 'commander';
      } else if (normalizedRole === 'soldier') {
        user.role = 'soldier';
      } else {
        user.role = 'soldier'; // Default to soldier if invalid
      }
    } else {
      user.role = 'soldier'; // Default to soldier if missing
    }
    console.log('Stored password hash in DB:', user.password);

    // Verify password using bcrypt (same as web implementation)
    console.log(`[LOGIN] Verifying password for user: ${username}`)
      ;
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`[LOGIN] Password verification result: ${isMatch}`);

    if (!isMatch) {
      // Track failed login attempt
      await pool.query(
        'UPDATE users SET last_login_attempt = $1, login_attempts_count = COALESCE(login_attempts_count, 0) + 1 WHERE id = $2',
        [currentTimestamp, user.id]
      );

      console.log(`[LOGIN] Authentication failed for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`[LOGIN] Authentication successful for user: ${username}`);


    // Update login tracking for successful login
    await pool.query(
      'UPDATE users SET last_login_attempt = $1, last_login_success = $1, login_attempts_count = 0 WHERE id = $2',
      [currentTimestamp, user.id]
    );

    delete user.password;
    console.log('Login success:', user);
    res.json(user);
  } catch (err) {
    console.log('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:id/change-password
router.post('/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  try {
    // Fetch user with password
    const result = await pool.query(
      'SELECT id, username, password FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];

    // Check current password (support bcrypt or legacy plain match like login)
    const bcryptMatch = await bcrypt.compare(currentPassword, user.password);
    const directMatch = currentPassword === user.password;
    const passwordMatch = bcryptMatch || directMatch;
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update to bcrypt for all future logins
    const saltRounds = 10;
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, id]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    return res.status(500).json({ error: 'Server error updating password' });
  }
});

// GET /api/users/soldier-overview?commander_id=ID
router.get('/soldier-overview', async (req, res) => {
  const { commander_id } = req.query;
  if (!commander_id) {
    return res.status(400).json({ error: 'commander_id is required' });
  }
  try {
    console.log(`[soldier-overview] Fetching soldiers for commander_id: ${commander_id}`);

    // A) Determine the commander's unit name (fallback path)
    let commanderUnit = null;
    try {
      const cu = await pool.query('SELECT unit FROM users WHERE id = $1', [commander_id]);
      commanderUnit = (cu.rows[0]?.unit || null);
      console.log(`[soldier-overview] Commander unit: ${commanderUnit}`);
    } catch (err) {
      console.error('[soldier-overview] Error fetching commander unit:', err);
    }

    // B) Primary: mapping-based units assigned to the commander
    let unitIds = [];
    let mappingSoldiers = [];
    try {
      const unitResult = await pool.query(
        'SELECT unit_id FROM commander_unit_mappings WHERE commander_id = $1',
        [commander_id]
      );
      unitIds = unitResult.rows.map(row => row.unit_id);
      console.log(`[soldier-overview] Found ${unitIds.length} unit_ids from mapping table`);

      // B1) Soldiers via mapping tables
      if (unitIds.length > 0) {
        const soldierResult = await pool.query(
          `SELECT u.id, u.username, u.name, u.unit, u.status, u.photo, u.role
           FROM users u
           JOIN soldier_unit_mappings s ON u.id = s.soldier_id
           WHERE s.unit_id = ANY($1::int[]) 
           AND LOWER(u.role) != 'commander'`,
          [unitIds]
        );
        mappingSoldiers = soldierResult.rows;
        console.log(`[soldier-overview] Found ${mappingSoldiers.length} soldiers via mapping tables`);
      }
    } catch (err) {
      console.error('[soldier-overview] Error with mapping tables (may not exist):', err.message);
      // Continue with unit name fallback
    }

    // B2) Fallback: soldiers by unit name match (case-insensitive)
    let unitNameSoldiers = [];
    if (commanderUnit) {
      try {
        const unitName = commanderUnit.toLowerCase().trim();
        console.log(`[soldier-overview] Searching for soldiers with unit: "${commanderUnit}" (normalized: "${unitName}")`);
        const sr = await pool.query(
          `SELECT id, username, name, unit, status, photo, role
           FROM users
           WHERE LOWER(TRIM(unit)) = $1 
           AND LOWER(role) != 'commander'
           ORDER BY name ASC`,
          [unitName]
        );
        unitNameSoldiers = sr.rows;
        console.log(`[soldier-overview] Found ${unitNameSoldiers.length} soldiers by unit name: "${commanderUnit}"`);

        // Debug: Show what units actually exist for soldiers
        if (unitNameSoldiers.length === 0) {
          const debugResult = await pool.query(
            `SELECT DISTINCT unit FROM users WHERE LOWER(role) = 'soldier' AND unit IS NOT NULL ORDER BY unit`
          );
          console.log(`[soldier-overview] Available soldier units in database:`, debugResult.rows.map(r => `"${r.unit}"`));
        }
      } catch (err) {
        console.error('[soldier-overview] Error fetching by unit name:', err);
      }
    } else {
      console.warn('[soldier-overview] Commander has no unit name, cannot fetch by unit');
    }

    // Combine and deduplicate soldiers by id
    const combinedMap = new Map();
    [...mappingSoldiers, ...unitNameSoldiers].forEach(s => {
      if (s && !combinedMap.has(s.id)) combinedMap.set(s.id, s);
    });
    const soldiers = Array.from(combinedMap.values());
    console.log(`[soldier-overview] Total unique soldiers found: ${soldiers.length}`);

    if (soldiers.length === 0) {
      console.warn('[soldier-overview] No soldiers found for commander');
      return res.json([]);
    }

    // Enrich with latest location, health, and operation details
    const soldierIds = soldiers.map(s => s.id);

    const locationResult = await pool.query(
      `SELECT DISTINCT ON (user_id) user_id, latitude, longitude, recorded_at
       FROM user_location_history
       WHERE user_id = ANY($1::int[])
       ORDER BY user_id, recorded_at DESC`,
      [soldierIds]
    );
    const locationMap = {};
    locationResult.rows.forEach(row => { locationMap[row.user_id] = row; });

    const healthResult = await pool.query(
      `SELECT * FROM advanced_health_details WHERE user_id = ANY($1::int[])`,
      [soldierIds]
    );
    const healthMap = {};
    healthResult.rows.forEach(row => { healthMap[row.user_id] = row; });

    const opResult = await pool.query(
      `SELECT * FROM operation_details WHERE user_id = ANY($1::int[])`,
      [soldierIds]
    );
    const opMap = {};
    opResult.rows.forEach(row => { opMap[row.user_id] = row; });

    const overview = soldiers.map(soldier => ({
      id: soldier.id,
      username: soldier.username,
      name: soldier.name,
      unit: soldier.unit,
      status: soldier.status || 'offline',
      photo: soldier.photo || null,
      latitude: locationMap[soldier.id]?.latitude || null,
      longitude: locationMap[soldier.id]?.longitude || null,
      location: locationMap[soldier.id] || null,
      health: healthMap[soldier.id] || null,
      operation: opMap[soldier.id] || null,
    }));
    console.log(`[soldier-overview] Returning ${overview.length} soldiers with enriched data`);
    res.json(overview);
  } catch (err) {
    console.error('[soldier-overview] Error in /api/users/soldier-overview:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// PUT /api/users/update-tokens
// Kept for backward compatibility, but will not require DB columns
router.put('/update-tokens', async (req, res) => {
  // Accept and ignore without error so mobile can call it safely
  try {
    const { userId, fcmToken, expoToken } = req.body || {};
    if (userId && (fcmToken || expoToken)) {
      try {
        await pool.query(
          `UPDATE users SET 
            fcm_token = COALESCE($1, fcm_token), 
            expo_token = COALESCE($2, expo_token), 
            last_active = NOW()
           WHERE id = $3`,
          [fcmToken || null, expoToken || null, userId]
        );
      } catch (updateErr) {
        // If last_active column doesn't exist, update without it
        if (updateErr.code === '42703' || (updateErr.message && updateErr.message.includes('last_active'))) {
          await pool.query(
            `UPDATE users SET
              fcm_token = COALESCE($1, fcm_token),
              expo_token = COALESCE($2, expo_token)
             WHERE id = $3`,
            [fcmToken || null, expoToken || null, userId]
          );
        } else {
          throw updateErr;
        }
      }
      return res.json({ message: 'Tokens updated' });
    }
    res.json({ message: 'Accepted' });
  } catch (err) {
    res.status(200).json({ message: 'Accepted' });
  }
});

// POST /api/users/subscribe-topic   { fcmToken, topic }
router.post('/subscribe-topic', async (req, res) => {
  try {
    const { fcmToken, topic = 'alerts' } = req.body || {};
    console.log('📱 Subscribing FCM token to topic:', { fcmToken: fcmToken ? '***' + fcmToken.slice(-10) : null, topic });

    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    const { subscribeTokenToTopic } = require('../services/firebaseService');
    const out = await subscribeTokenToTopic(fcmToken, topic);
    console.log('✅ Successfully subscribed to topic:', out);
    res.json(out);
  } catch (err) {
    console.error('❌ Error subscribing to topic:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/users/unsubscribe-topic   { fcmToken, topic }
router.post('/unsubscribe-topic', async (req, res) => {
  try {
    const { fcmToken, topic = 'alerts' } = req.body || {};
    console.log('📱 Unsubscribing FCM token from topic:', { fcmToken: fcmToken ? '***' + fcmToken.slice(-10) : null, topic });

    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    const { unsubscribeTokenFromTopic } = require('../services/firebaseService');
    const out = await unsubscribeTokenFromTopic(fcmToken, topic);
    console.log('✅ Successfully unsubscribed from topic:', out);
    res.json(out);
  } catch (err) {
    console.error('❌ Error unsubscribing from topic:', err);
    res.status(400).json({ error: err.message });
  }
});

// --- Registration Requests ---
const { v4: uuidv4 } = require('uuid');

// POST /api/registration-requests
router.post('/registration-requests', async (req, res) => {
  console.log('POST /api/registration-requests', req.body); // Debug log
  const {
    username,
    password,
    name,
    role,
    email,
    unit_name,
    category,
    age,
    gender,
    height,
    weight,
    bp,
    phone_no,
    id_no,
    blood_group
  } = req.body || {};
  if (!username || !password || !role || !name || !id_no) {
    return res.status(400).json({ error: 'Missing required fields: username, password, role, name, and ID Number are required' });
  }
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      `INSERT INTO registration_requests (
        username, password, name, role, email, category, age, status, gender, height, weight, bp, id_no, blood_group, unit_name, phone, phone_no
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING id, username, name, role, email, unit_name, category, age, gender, height, weight, bp, id_no, blood_group, phone_no, status, created_at`,
      [
        username,
        hashedPassword,
        name,
        role,
        email,
        category,
        age ?? null,
        'pending',
        gender ?? null,
        height ?? null,
        weight ?? null,
        bp ?? null,
        id_no,
        blood_group ?? null,
        unit_name ?? null,
        phone_no ?? null,
        phone_no ?? null
      ]
    );
    res.status(201).json({ message: 'Registration request submitted', request: result.rows[0] });
  } catch (err) {
    console.error('[REGISTER] Backend error:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Duplicate pending registration for username/email/id_no' });
    } else {
      res.status(500).json({ error: err.message || 'Server error during registration' });
    }
  }
});

// GET /api/registration-requests (not allowed)
router.get('/registration-requests', (req, res) => {
  res.status(405).json({ error: 'GET not allowed on this endpoint. Use POST to register.' });
});

// POST /api/registration-requests/:id/accept
router.post('/registration-requests/:id/accept', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the request data
    const { rows } = await client.query(
      'SELECT * FROM registration_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registration request not found or already processed' });
    }

    const user = rows[0];

    // 2. Insert into users table
    const insertResult = await client.query(
      `INSERT INTO users (username, password, name, role, email, unit, category, age, gender, height, weight, bp, "MobileNumber", "EmployeeID", blood_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, username, name, role, email`,
      [
        user.username,
        user.password,
        user.name,
        user.role,
        user.email,
        user.unit_name,
        user.category,
        user.age,
        user.gender,
        user.height,
        user.weight,
        user.bp,
        user.phone_no,
        user.id_no,
        user.blood_group
      ]
    );

    // 3. Update registration status
    await client.query(
      'UPDATE registration_requests SET status = $1 WHERE id = $2',
      ['accepted', id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'User accepted and added to system', user: insertResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting registration:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/registration-requests/:id/reject
router.post('/registration-requests/:id/reject', async (req, res) => {
  try {
    await pool.query(
      `UPDATE registration_requests SET status = 'rejected', processed_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Request rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PARAMETERIZED ROUTES (must come after specific routes) =====

// PUT /api/users/:id - update soldier details (name, email, unit, MobileNumber, role)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, unit, MobileNumber, role } = req.body || {};

  // Normalize placeholder/null-like values to actual nulls to avoid strings like "[null]"
  const normalizeNullish = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === '' || s === 'null' || s === '[null]' || s === 'undefined' || s === 'na' || s === 'n/a') return null;
    return v;
  };

  try {
    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        unit = COALESCE($3, unit),
        "MobileNumber" = COALESCE($4, "MobileNumber"),
        role = COALESCE($5, role)
       WHERE id = $6
       RETURNING id, username, name, role, email, unit, "MobileNumber"`,
      [
        normalizeNullish(name),
        normalizeNullish(email),
        normalizeNullish(unit),
        normalizeNullish(MobileNumber),
        normalizeNullish(role),
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/location
router.put('/:id/location', async (req, res) => {
  const userIdParam = req.params.id;
  const { latitude, longitude, heading } = req.body;
  const safeHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;

  console.log('--- BACKEND /users/:id/location ---');
  console.log(`Received location update for userId: ${userIdParam}`);
  console.log(`Payload: { latitude: ${latitude}, longitude: ${longitude}, heading: ${safeHeading} }`);

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    console.error('Validation Error: latitude and longitude must be numbers.');
    return res.status(400).json({ error: 'latitude and longitude must be numbers' });
  }

  // Convert userId to integer
  const userId = parseInt(userIdParam, 10);
  if (isNaN(userId)) {
    console.error('Validation Error: userId must be a valid integer.');
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const client = await pool.connect();
  let transactionActive = false;

  // Helper function to start transaction safely
  const startTransaction = async () => {
    if (!transactionActive) {
      await client.query('BEGIN');
      transactionActive = true;

      // Try to disable triggers (optional, may fail on hosted DBs)
      try {
        await client.query("SET LOCAL session_replication_role = 'replica'");
      } catch (triggerError) {
        // If this fails, rollback and restart
        try {
          await client.query('ROLLBACK');
        } catch { }
        transactionActive = false;
        await client.query('BEGIN');
        transactionActive = true;
      }
    }
  };

  // Helper function to recover from transaction abort
  const recoverTransaction = async () => {
    if (transactionActive) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback errors
      }
      transactionActive = false;
    }
    await startTransaction();
  };

  try {
    // Start transaction
    await startTransaction();

    // Step 1: Update users table
    let result;
    try {
      // Try with last_active first
      try {
        result = await client.query(
          'UPDATE users SET latitude = $1, longitude = $2, heading = $3, last_active = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
          [latitude, longitude, safeHeading, userId]
        );
        console.log(`Location updated in users table (with last_active) for userId: ${userId}`);
      } catch (updateErr) {
        // Check if transaction is aborted or last_active column error
        const isTransactionAborted = updateErr.code === '25P02';
        const isLastActiveError = updateErr.code === '42703' ||
          (updateErr.message && updateErr.message.includes('last_active')) ||
          (updateErr.message && updateErr.message.includes('column') && updateErr.message.includes('does not exist'));

        if (isTransactionAborted || isLastActiveError) {
          // ALWAYS recover transaction when we get these errors - they abort the transaction
          console.log('Transaction aborted or last_active column error, recovering transaction...');
          await recoverTransaction();

          // Retry without last_active in the fresh transaction
          result = await client.query(
            'UPDATE users SET latitude = $1, longitude = $2, heading = $3 WHERE id = $4 RETURNING *',
            [latitude, longitude, safeHeading, userId]
          );
          console.log(`Location updated in users table (without last_active) for userId: ${userId}`);
        } else {
          throw updateErr;
        }
      }
    } catch (updateErr) {
      console.error('Failed to update users table:', updateErr);
      if (transactionActive) {
        try {
          await client.query('ROLLBACK');
        } catch { }
      }
      client.release();
      return res.status(500).json({ error: 'Failed to update user location', details: updateErr.message });
    }

    if (!result || result.rows.length === 0) {
      if (transactionActive) {
        try {
          await client.query('ROLLBACK');
        } catch { }
      }
      client.release();
      console.error('User not found for id:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 2: Ensure locations table exists (skip if table already exists to avoid warnings)
    // Note: We don't create the table here since it already exists with a specific schema
    // Just verify the table exists by checking if it's accessible
    try {
      // Try a simple query to verify table exists (this won't fail if table exists)
      await client.query('SELECT 1 FROM locations LIMIT 1');
    } catch (tableCheckErr) {
      // If table doesn't exist, try to create it with the actual schema
      if (tableCheckErr.code === '42P01') {
        try {
          await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
              id SERIAL PRIMARY KEY,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              lat DECIMAL(10, 8),
              lng DECIMAL(11, 8),
              heading DOUBLE PRECISION,
              username VARCHAR(100),
              role VARCHAR(50),
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await client.query('CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);');
          await client.query('CREATE INDEX IF NOT EXISTS idx_locations_updated_at ON locations(updated_at);');
        } catch (createErr) {
          // Table might have been created by another process, ignore
          if (createErr.code !== '42P07') {
            console.log('Locations table create warning:', createErr.message);
          }
        }
      } else {
        // Other error - might be transaction abort
        if (tableCheckErr.code === '25P02') {
          await recoverTransaction();
        }
      }
    }

    // Step 3: Insert into locations table
    const updatedUser = result.rows[0];
    const userUsername = updatedUser.username || null;
    const userRole = updatedUser.role || null;
    let inserted = false;

    try {
      // Try with lat/lng columns first (matching actual table schema)
      try {
        await client.query(
          'INSERT INTO locations (user_id, lat, lng, heading, username, role, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
          [userId, latitude, longitude, safeHeading, userUsername, userRole]
        );
        inserted = true;
        console.log(`✅ Location inserted into locations table (lat/lng) for userId: ${userId}`);
      } catch (insertErr) {
        // Check if transaction aborted or column error
        const isTransactionAborted = insertErr.code === '25P02';
        const isColumnError = insertErr.code === '42703' ||
          (insertErr.message && insertErr.message.includes('column'));

        if (isTransactionAborted) {
          console.log('Transaction aborted during location insert, recovering...');
          await recoverTransaction();

          // Retry with lat/lng after recovery
          try {
            await client.query(
              'INSERT INTO locations (user_id, lat, lng, heading, username, role, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
              [userId, latitude, longitude, safeHeading, userUsername, userRole]
            );
            inserted = true;
            console.log(`✅ Location inserted into locations table (lat/lng, after recovery) for userId: ${userId}`);
          } catch (retryErr) {
            // If still fails, try latitude/longitude as fallback
            const isRetryColumnError = retryErr.code === '42703' ||
              (retryErr.message && retryErr.message.includes('column'));

            if (isRetryColumnError) {
              console.log('lat/lng columns not found, trying latitude/longitude columns...');
              try {
                await client.query(
                  'INSERT INTO locations (user_id, latitude, longitude, heading, username, role, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
                  [userId, latitude, longitude, safeHeading, userUsername, userRole]
                );
                inserted = true;
                console.log(`✅ Location inserted into locations table (latitude/longitude, fallback) for userId: ${userId}`);
              } catch (fallbackErr) {
                console.error(`❌ Could not insert location with either column naming:`, fallbackErr.message);
                throw fallbackErr;
              }
            } else {
              throw retryErr;
            }
          }
        } else if (isColumnError) {
          console.log('Column name mismatch detected, trying latitude/longitude columns...');

          // Recover transaction if aborted (column errors can abort transactions)
          if (insertErr.code === '25P02') {
            await recoverTransaction();
          }

          // Try latitude/longitude as fallback
          try {
            await client.query(
              'INSERT INTO locations (user_id, latitude, longitude, heading, username, role, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
              [userId, latitude, longitude, safeHeading, userUsername, userRole]
            );
            inserted = true;
            console.log(`✅ Location inserted into locations table (latitude/longitude, fallback) for userId: ${userId}`);
          } catch (fallbackErr) {
            console.error(`❌ Could not insert location with either column naming:`, fallbackErr.message);
            throw fallbackErr;
          }
        } else {
          throw insertErr;
        }
      }
    } catch (insertErr) {
      console.error(`❌ Could not insert location history for userId ${userId}:`, insertErr.message);
      console.error(`❌ Error code: ${insertErr.code}, Error details:`, {
        message: insertErr.message,
        code: insertErr.code
      });
      // Don't fail the entire request if history insert fails, but log it
    }

    // Commit transaction
    if (transactionActive) {
      await client.query('COMMIT');
      transactionActive = false;
    }

    console.log(`✅ Location update successful for userId: ${userId}, users table updated: true, locations table updated: ${inserted}`);
    client.release();
    return res.status(200).json({
      success: true,
      user: result.rows[0],
      historyInserted: inserted
    });

  } catch (err) {
    console.error('Database error during location update:', err);

    // Rollback if transaction is active
    if (transactionActive) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback errors
      }
    }

    client.release();
    return res.status(500).json({ error: 'Database error during location update', details: err.message });
  }
});

// PUT /api/users/:id/photo
// Accepts JSON { photoBase64: string } where string can be raw base64 or a data URI (e.g., data:image/jpeg;base64,....)
router.put('/:id/photo', async (req, res) => {
  const userId = req.params.id;
  let { photoBase64 } = req.body || {};
  try {
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return res.status(400).json({ error: 'photoBase64 is required' });
    }

    // Debug: log payload size (not data) and enforce a max size to avoid overloads
    const approxLen = photoBase64.length;
    const estimatedSizeMB = Math.round((approxLen * 3) / 4 / 1024 / 1024 * 100) / 100; // Convert base64 to approximate bytes
    console.log(`[PHOTO] userId=${userId} payloadLen=${approxLen} estimatedSize=${estimatedSizeMB}MB`);

    // Increased limit to 15MB to accommodate higher quality images and base64 overhead
    // Increased limit to 50MB to accommodate high quality images and base64 overhead
    if (approxLen > 50 * 1024 * 1024) {
      return res.status(413).json({
        error: 'Image too large',
        details: `Image size (${estimatedSizeMB}MB) exceeds maximum allowed size (50MB). Please compress the image and try again.`,
        maxSize: '50MB',
        currentSize: `${estimatedSizeMB}MB`
      });
    }

    // Normalize: strip data URI header if present to store raw base64 only (smaller DB, consistent reads)
    const normalized = photoBase64.startsWith('data:')
      ? photoBase64.substring(photoBase64.indexOf(',') + 1)
      : photoBase64;

    const result = await pool.query(
      'UPDATE users SET photo = $1 WHERE id = $2 RETURNING id, username, name, role, email, unit, photo',
      [normalized, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Error updating user photo:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/users/:id/tasks
router.get('/:id/tasks', async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT "ID" as id, "ZONE_ID" as zone_id, "ASSIGNED_BY" as assigned_by, "CREATED_BY" as created_by
       FROM "ZONE_ASSIGNMENT"
       WHERE "SOULDER_ID" = $1
       ORDER BY "ID" DESC`,
      [userId]
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Error fetching tasks for user', userId, err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router; 