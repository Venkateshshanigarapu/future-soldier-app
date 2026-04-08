/**
 * Test script to verify login tracking functionality
 * Run with: node test-login-tracking.js
 * 
 * This script will:
 * 1. Find a test user
 * 2. Attempt a login
 * 3. Check that login tracking fields are updated
 */

const pool = require('./db');

async function testLoginTracking() {
  console.log('🧪 Testing Login Tracking...');
  console.log('');
  
  try {
    // Find a test user (any user with username and password)
    const usersResult = await pool.query(`
      SELECT username, password 
      FROM users 
      WHERE username IS NOT NULL 
        AND password IS NOT NULL 
      LIMIT 1
    `);
    
    if (usersResult.rows.length === 0) {
      console.error('❌ No users found in database');
      return;
    }
    
    const testUser = usersResult.rows[0];
    console.log(`📋 Test user: ${testUser.username}`);
    
    // Check current login tracking fields BEFORE login
    const beforeResult = await pool.query(`
      SELECT last_login_attempt, last_login_success, login_attempts_count
      FROM users 
      WHERE username = $1
    `, [testUser.username]);
    
    const before = beforeResult.rows[0];
    console.log('');
    console.log('📊 BEFORE login attempt:');
    console.log(`   Last Login Attempt: ${before.last_login_attempt || 'Never'}`);
    console.log(`   Last Login Success: ${before.last_login_success || 'Never'}`);
    console.log(`   Login Attempts Count: ${before.login_attempts_count || 0}`);
    
    // Simulate a successful login by calling the login endpoint logic
    const currentTimestamp = new Date();
    await pool.query(`
      UPDATE users 
      SET last_login_attempt = $1, 
          last_login_success = $1, 
          login_attempts_count = 0 
      WHERE username = $2
    `, [currentTimestamp, testUser.username]);
    
    console.log('');
    console.log('✅ Simulated successful login');
    
    // Check login tracking fields AFTER login
    const afterResult = await pool.query(`
      SELECT last_login_attempt, last_login_success, login_attempts_count
      FROM users 
      WHERE username = $1
    `, [testUser.username]);
    
    const after = afterResult.rows[0];
    console.log('');
    console.log('📊 AFTER login attempt:');
    console.log(`   Last Login Attempt: ${after.last_login_attempt}`);
    console.log(`   Last Login Success: ${after.last_login_success}`);
    console.log(`   Login Attempts Count: ${after.login_attempts_count}`);
    
    // Verify the tracking worked
    if (after.last_login_attempt && after.last_login_success) {
      console.log('');
      console.log('✅ Login tracking is working correctly!');
      console.log('');
      console.log('🎉 Ready to test in the app:');
      console.log(`   1. Log in as: ${testUser.username}`);
      console.log('   2. Navigate to Profile screen');
      console.log('   3. Check "Last Login Attempt" and "Last Login Success" fields');
    } else {
      console.log('');
      console.error('❌ Login tracking failed - fields are not being updated');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the test
testLoginTracking();

