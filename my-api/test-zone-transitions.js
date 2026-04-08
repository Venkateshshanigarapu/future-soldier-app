const { Pool } = require('pg');

// Test script to create a zone and simulate transitions
async function testZoneTransitions() {
  const pool = new Pool({
    user: 'postgres',
    host: '117.251.19.107',
    database: 'ATMS',
    password: '123456',
    port: 5433
  });

  try {
    console.log('Testing zone transitions...');

    // Create a test zone
    const zoneResult = await pool.query(`
      INSERT INTO zones (name, description, zone_type, center_lat, center_lng, radius_meters, unit, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (name) DO UPDATE SET
        center_lat = EXCLUDED.center_lat,
        center_lng = EXCLUDED.center_lng,
        radius_meters = EXCLUDED.radius_meters
      RETURNING *
    `, [
      'Test Zone',
      'Test zone for transition testing',
      'operation',
      17.4822, // Inside zone
      78.4790,
      1000, // 1km radius
      'Unit Delhi',
      true
    ]);

    const zone = zoneResult.rows[0];
    console.log('Test zone created:', zone);

    // Get a test user
    const userResult = await pool.query(`
      SELECT id, username, unit FROM users WHERE unit = 'Unit Delhi' LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('No users found for Unit Delhi. Creating test user...');
      const newUserResult = await pool.query(`
        INSERT INTO users (username, password, name, role, unit, email)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        'test_soldier',
        '$2b$10$example.hash.here',
        'Test Soldier',
        'soldier',
        'Unit Delhi',
        'test@example.com'
      ]);
      console.log('Test user created:', newUserResult.rows[0]);
    }

    const user = userResult.rows[0];
    console.log('Test user:', user);

    // Test coordinates
    const testCoordinates = [
      { lat: 17.4822, lng: 78.4790, desc: 'Inside zone' },
      { lat: 17.5000, lng: 78.5000, desc: 'Outside zone' },
      { lat: 17.4822, lng: 78.4790, desc: 'Back inside zone' }
    ];

    console.log('\nTesting transitions:');
    for (const coord of testCoordinates) {
      console.log(`\nTesting: ${coord.desc} (${coord.lat}, ${coord.lng})`);

      // Call the API endpoint
      const response = await fetch('http://117.251.19.107:3001/api/zones/check-breach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          latitude: coord.lat,
          longitude: coord.lng,
          heading: 0
        })
      });

      const result = await response.json();
      console.log('API Response:', result);

      if (result.transitions > 0) {
        console.log('Transitions detected:', result.details);
      }

      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check zone membership
    const membershipResult = await pool.query(`
      SELECT * FROM zone_membership WHERE user_id = $1
    `, [user.id]);

    console.log('\nZone membership:', membershipResult.rows);

    // Check alerts
    const alertsResult = await pool.query(`
      SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC
    `, [user.id]);

    console.log('\nRecent alerts:', alertsResult.rows);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testZoneTransitions();
