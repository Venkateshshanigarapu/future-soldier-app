
const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function createNotificationsTable() {
    try {
        // We only need the notifications part, but running the whole schema with IF NOT EXISTS is safer/easier
        // However, to be precise, let's just run the CREATE TABLE part for notifications
        const createTableQuery = `
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'zone-breach', 'emergency', 'assignment'
        category VARCHAR(50), -- 'system', 'zone', 'assignment', 'emergency'
        priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
        is_read BOOLEAN DEFAULT false,
        source VARCHAR(50) DEFAULT 'system', -- 'system', 'firebase', 'expo', 'manual'
        data JSONB, -- Store additional data like zone_id, assignment_id, etc.
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        expires_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(sent_at);

    CREATE TABLE IF NOT EXISTS notification_delivery_log (
        id SERIAL PRIMARY KEY,
        notification_id INTEGER REFERENCES notifications(id),
        user_id INTEGER REFERENCES users(id),
        delivery_method VARCHAR(50) NOT NULL, -- 'push', 'email', 'sms'
        delivery_status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed', 'opened'
        fcm_message_id VARCHAR(255),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        opened_at TIMESTAMP
    );
    `;

        await pool.query(createTableQuery);
        console.log('✅ Notifications table (and delivery log) created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating table:', err);
        process.exit(1);
    }
}

createNotificationsTable();
