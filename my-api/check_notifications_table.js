
const pool = require('./db');

async function checkNotificationsTable() {
    try {
        const res = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);

        const exists = res.rows[0].exists;
        console.log(`Table "notifications" exists: ${exists}`);

        if (exists) {
            const countRes = await pool.query('SELECT COUNT(*) FROM notifications');
            console.log(`Row count: ${countRes.rows[0].count}`);

            const columnsRes = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'notifications';
            `);
            console.log('Columns:', columnsRes.rows.map(row => `${row.column_name} (${row.data_type})`));
        } else {
            console.log('Table does not exist.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error checking table:', err);
        process.exit(1);
    }
}

checkNotificationsTable();
