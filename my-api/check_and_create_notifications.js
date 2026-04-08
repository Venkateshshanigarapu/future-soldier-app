const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'OCFA',
  password: '123456',
  port: 5432,
});

async function checkAndCreateTable() {
  const client = await pool.connect();
  try {
    // Check if table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);

    const tableExists = checkTable.rows[0].exists;

    if (!tableExists) {
      console.log('Creating notifications table...');
      await client.query(`
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          category VARCHAR(50),
          priority VARCHAR(20) DEFAULT 'normal',
          is_read BOOLEAN DEFAULT false,
          source VARCHAR(50) DEFAULT 'system',
          data JSONB,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP,
          expires_at TIMESTAMP
        );

        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX idx_notifications_type ON notifications(type);
        CREATE INDEX idx_notifications_created_at ON notifications(sent_at);
      `);
      console.log('✅ Notifications table created successfully');
    } else {
      console.log('✅ Notifications table already exists');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndCreateTable();
