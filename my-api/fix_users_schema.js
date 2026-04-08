
const pool = require('./db');

async function fixUsersTable() {
    try {
        const client = await pool.connect();

        console.log('Checking users table columns...');

        // Add fcm_token if missing
        try {
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT');
            console.log('✅ Added fcm_token column');
        } catch (e) {
            console.log('⚠️ Error adding fcm_token:', e.message);
        }

        // Add expo_token if missing
        try {
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_token TEXT');
            console.log('✅ Added expo_token column');
        } catch (e) {
            console.log('⚠️ Error adding expo_token:', e.message);
        }

        // Verify
        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const columns = res.rows.map(r => r.column_name);
        console.log('Current Columns:', columns.sort().join(', '));

        client.release();
        process.exit(0);
    } catch (err) {
        console.error('Error fixing users table:', err);
        process.exit(1);
    }
}

fixUsersTable();
