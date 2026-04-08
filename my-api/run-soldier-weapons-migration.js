/**
 * Helper script to run the soldier-weapons migration
 * Run with: node run-soldier-weapons-migration.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
  console.log('🔄 Starting soldier-weapons migration...');
  
  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create-soldier-weapons-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Created table: soldier_weapons');
    console.log('Added relationships:');
    console.log('  - Links soldiers to weapons');
    console.log('  - Tracks assignment details');
    console.log('  - Supports status management');
    console.log('');
    
    // Verify the table was created
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'soldier_weapons'
      ORDER BY ordinal_position;
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful - Table exists with columns:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('⚠️  Warning: Table not found after migration');
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

