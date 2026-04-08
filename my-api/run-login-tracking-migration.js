/**
 * Helper script to run the login tracking migration
 * Run with: node run-login-tracking-migration.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
  console.log('🔄 Starting login tracking migration...');
  
  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-login-tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Added columns to users table:');
    console.log('  - last_login_attempt (TIMESTAMP)');
    console.log('  - last_login_success (TIMESTAMP)');
    console.log('  - login_attempts_count (INTEGER)');
    console.log('');
    
    // Verify the columns were added
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('last_login_attempt', 'last_login_success', 'login_attempts_count')
      ORDER BY column_name;
    `);
    
    if (verifyResult.rows.length === 3) {
      console.log('✅ Verification successful - All columns exist:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('⚠️  Warning: Expected 3 columns but found', verifyResult.rows.length);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Error details:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();

