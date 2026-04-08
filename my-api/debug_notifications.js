
const pool = require('./db');

async function debugNotifications() {
    try {
        console.log('--- DEBUG START ---');

        // Check Notifications Count
        const countRes = await pool.query('SELECT COUNT(*) FROM notifications');
        console.log(`Notifications Table Row Count: ${countRes.rows[0].count}`);

        // Check last 5 notifications
        if (parseInt(countRes.rows[0].count) > 0) {
            const rows = await pool.query('SELECT id, user_id, title, created_at FROM notifications ORDER BY id DESC LIMIT 5');
            console.log('Last 5 Notifications:', rows.rows);
        }

        // Check Users with potential roles
        const usersRes = await pool.query(`
        SELECT id, username, role, unit, fcm_token, expo_token 
        FROM users 
        WHERE role IN ('commander', 'supervisor')
    `);
        console.log(`Found ${usersRes.rows.length} Commanders/Supervisors:`);
        usersRes.rows.forEach(u => {
            console.log(`- ID: ${u.id}, User: ${u.username}, Role: ${u.role}, Unit: ${u.unit}, Has Token: ${!!(u.fcm_token || u.expo_token)}`);
        });

        console.log('--- DEBUG END ---');
        process.exit(0);
    } catch (err) {
        console.error('Debug script error:', err);
        process.exit(1);
    }
}

debugNotifications();
