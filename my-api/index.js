const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const pool = require('./db');
const { 
  sendFirebaseNotification, 
  sendNotificationsByFilter, 
  sendTopicNotification,
  sendBulkFirebaseNotifications 
} = require('./services/firebaseService');
// Import routes
const notificationsRouter = require('./routes/notifications');
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const zonesRouter = require('./routes/zones');
const unitsRouter = require('./routes/units');
const alertsRouter = require('./routes/alerts');
const assignmentsRouter = require('./routes/assignments');
const healthRouter = require('./routes/health');
const locationsRouter = require('./routes/locations');
const weaponsRouter = require('./routes/weapons');
const ammunitionRouter = require('./routes/ammunition');
const supplyRequestsRouter = require('./routes/supplyRequests');
const damagedRequestsRouter = require('./routes/damagedRequests');
const vehiclesRouter = require('./routes/vehicles');
const operationalDetailsRouter = require('./routes/operationalDetails');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://117.251.19.107:3000", "http://192.168.1.100:3000", "http://ocfa.onrender.com", "http://117.251.19.107:8090"], // Add your frontend URLs
    methods: ["GET", "POST"]
  }
});

// Server configuration for hosting environments
const PORT = process.env.PORT || 8090;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://117.251.19.107:3000,http://192.168.1.100:3000,http://ocfa.onrender.com,http://117.251.19.107:8090";

// Middleware
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/api/users/register') {
    console.log('DEBUG: Received POST /api/users/register', req.body);
  }
  if (req.method === 'POST' && req.url === '/api/users/registration-requests') {
    console.log('DEBUG: Received POST /api/users/registration-requests', req.body);
  }
  console.log('Incoming request:', req.method, req.url, req.originalUrl || req.url);
  if (req.url && req.url.includes('/health')) {
    console.log('[Middleware] Health route detected:', req.method, req.url);
  }
  next();
});

const path = require('path');
// Serve static map tiles
app.use('/map', express.static(path.join(__dirname, '../map_data')));

// Security: Removed duplicate /api/assignments route - all assignment requests must go through router which enforces unitId filtering

app.use('/api/notifications', notificationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/units', unitsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/health', healthRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/weapons', weaponsRouter);
app.use('/api/ammunition', ammunitionRouter);
app.use('/api/supply-requests', supplyRequestsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/damaged-requests', damagedRequestsRouter);
app.use('/api/operational-details', operationalDetailsRouter);
// Alias without /api in case of reverse proxy path rewrites
app.use('/assignments', assignmentsRouter);

app.get('/api/dbtest', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a test endpoint for connectivity
app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'API is reachable' });
});

// Test notification endpoint using Expo push service
app.post('/api/test-expo', async (req, res) => {
  try {
    const message = {
      to: 'ExponentPushToken[QqVF_1GDZAsvhQL04Md7Vg]',
      sound: 'default',
      title: 'Test Notification',
      body: 'This is a test from your API'
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    const result = await response.text();
    console.log('Expo push response:', result);
    res.json({ success: true, response: result });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Make io available to routes
app.set('io', io);

// Ensure base tables exist to avoid startup failures on empty DBs
(async () => {
  try {
    // Minimal users table so downstream ALTERs won't fail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        email VARCHAR(255),
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'soldier',
        unit VARCHAR(100),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        heading DECIMAL(5,2),
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT');
    console.log('Ensured users table and users.photo column exist');

    // Minimal alerts table so listener setup and routes won't fail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'low',
        status VARCHAR(20) DEFAULT 'active',
        user_id INTEGER,
        unit VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Ensured alerts table exists');


    // Damaged requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS damaged_requests (
        id SERIAL PRIMARY KEY,
        soldier_id INTEGER REFERENCES users(id),
        category VARCHAR(50) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        item_identifier VARCHAR(255),
        urgency VARCHAR(20) DEFAULT 'low',
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Ensured damaged_requests table exists');

    // Zone membership table for breach/return detection
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zone_membership (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        zone_id INTEGER NOT NULL,
        last_state VARCHAR(20) NOT NULL DEFAULT 'unknown',
        last_event_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_push_at TIMESTAMP,
        last_state_change_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, zone_id)
      );
    `);

    // Create indexes for zone_membership
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_zone_membership_user_id ON zone_membership(user_id);
      CREATE INDEX IF NOT EXISTS idx_zone_membership_zone_id ON zone_membership(zone_id);
      CREATE INDEX IF NOT EXISTS idx_zone_membership_last_state ON zone_membership(last_state);
      CREATE INDEX IF NOT EXISTS idx_zone_membership_last_event_at ON zone_membership(last_event_at);
    `);
    console.log('Ensured zone_membership table and indexes exist');
  } catch (err) {
    console.error('Failed to ensure base tables:', err.message);
  }
})();

// Ensure alerts read-status columns exist to avoid runtime errors
(async () => {
  try {
    await pool.query(`
      ALTER TABLE alerts 
      ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS read_by INTEGER REFERENCES users(id);

      CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
      CREATE INDEX IF NOT EXISTS idx_alerts_read_by ON alerts(read_by);
    `);
    console.log('Ensured alerts read-status columns and indexes exist');
  } catch (err) {
    console.error('Failed to ensure alerts read-status columns:', err.message);
  }
})();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle unit room joining for assignment updates
  socket.on('joinUnit', ({ unitId }) => {
    if (unitId) {
      socket.join(`unit:${unitId}`);
      console.log(`Socket ${socket.id} joined unit room: unit:${unitId}`);
    }
  });

  socket.on('userLocationUpdate', async (data) => {
    const { user_id, latitude, longitude, heading } = data;
    try {
      // Convert user_id to integer
      const userId = parseInt(user_id, 10);
      if (isNaN(userId)) {
        console.error('Invalid user_id in socket location update:', user_id);
        return;
      }

      // Fetch last known coordinates and user info
      const userRes = await pool.query('SELECT latitude, longitude, heading, username, role FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        console.warn('User not found for socket location update:', userId);
        return; // User not found
      }

      const user = userRes.rows[0];
      const safeHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;

      // If new coordinates are different, update
      if (
        user.latitude !== latitude ||
        user.longitude !== longitude ||
        user.heading !== safeHeading
      ) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Update users table with new location
          // Try with last_active first, fallback without it if column doesn't exist
          try {
            await client.query(
              `UPDATE users SET latitude = $1, longitude = $2, heading = $3, last_active = CURRENT_TIMESTAMP WHERE id = $4`,
              [latitude, longitude, safeHeading, userId]
            );
          } catch (updateErr) {
            // If last_active column doesn't exist, try without it
            if (updateErr.code === '42703' || (updateErr.message && updateErr.message.includes('last_active'))) {
              await client.query(
                `UPDATE users SET latitude = $1, longitude = $2, heading = $3 WHERE id = $4`,
                [latitude, longitude, safeHeading, userId]
              );
            } else {
              throw updateErr;
            }
          }

          // Ensure locations table exists
          try {
            await client.query(`
              CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                heading DECIMAL(5, 2),
                username VARCHAR(100),
                role VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `);
            await client.query('CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);');
            await client.query('CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp);');
          } catch (tableErr) {
            // Table might already exist
            if (tableErr.code !== '42P07') {
              console.log('Locations table check/create (socket):', tableErr.message);
            }
          }

          // Insert into locations table for history
          try {
            // Try with latitude/longitude columns
            await client.query(
              'INSERT INTO locations (user_id, latitude, longitude, heading, username, role, timestamp) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
              [userId, latitude, longitude, safeHeading, user.username || null, user.role || null]
            );
            console.log(`✅ Socket: Location inserted into locations table for userId: ${userId}`);
          } catch (locErr) {
            // If column error, try with lat/lng columns
            const isColumnError = locErr.code === '42703' ||
              (locErr.message && locErr.message.includes('column') &&
                (locErr.message.includes('latitude') || locErr.message.includes('longitude')));

            if (isColumnError) {
              try {
                // Try to add columns if they don't exist
                try {
                  await client.query('ALTER TABLE locations ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);');
                  await client.query('ALTER TABLE locations ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);');
                } catch (alterErr) {
                  // Columns might already exist
                }

                await client.query(
                  'INSERT INTO locations (user_id, lat, lng, heading, username, role, timestamp) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
                  [userId, latitude, longitude, safeHeading, user.username || null, user.role || null]
                );
                console.log(`✅ Socket: Location inserted (lat/lng) for userId: ${userId}`);
              } catch (secondErr) {
                console.error(`❌ Socket: Could not insert location history for userId ${userId}:`, secondErr.message);
                console.error('   Error code:', secondErr.code);
              }
            } else {
              console.error(`❌ Socket: Could not insert location history for userId ${userId}:`, locErr.message);
              console.error('   Error code:', locErr.code);
            }
          }

          await client.query('COMMIT');
          console.log(`Socket location update successful for userId: ${userId}`);
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      }
    } catch (err) {
      console.error('Error handling userLocationUpdate:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://117.251.19.107:${PORT}`);
});

// Enhanced PostgreSQL LISTEN/NOTIFY for alerts inserts with comprehensive error handling
(async () => {
  let client = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 5000; // 5 seconds

  const setupAlertsListener = async () => {
    try {
      // Close existing connection if any
      if (client) {
        try {
          await client.end();
        } catch (e) {
          console.warn('Error closing existing client:', e.message);
        }
      }

      // Create new client for LISTEN
      client = await pool.connect();

      // Ensure trigger and function exist to publish NOTIFY on inserts
      try {
        await client.query(`
          CREATE OR REPLACE FUNCTION notify_alerts_inserted() RETURNS trigger AS $$
          BEGIN
            PERFORM pg_notify('alerts_inserted', json_build_object(
              'id', NEW.id,
              'category', NEW.category,
              'message', NEW.message,
              'severity', NEW.severity,
              'status', NEW.status,
              'user_id', NEW.user_id,
              'unit', NEW.unit,
              'created_at', NEW.created_at,
              'data', NEW.data
            )::text);
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;

          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_trigger
              WHERE tgname = 'alerts_insert_trigger'
            ) THEN
              CREATE TRIGGER alerts_insert_trigger
              AFTER INSERT ON alerts
              FOR EACH ROW
              EXECUTE FUNCTION notify_alerts_inserted();
            END IF;
          END$$;
        `);
        console.log('✅ Standardized alerts insert trigger ensured');
      } catch (e) {
        console.warn('⚠️ Could not ensure alerts insert trigger:', e.message);
      }

      // Start listening
      await client.query('LISTEN alerts_inserted');
      console.log('🎧 Listening on channel alerts_inserted for new alerts');

      // Reset reconnect attempts on successful connection
      reconnectAttempts = 0;

      // Handle notifications
      client.on('notification', async (msg) => {
        if (msg.channel !== 'alerts_inserted') return;

        try {
          console.log('📨 Received alert notification:', msg.payload);
          const payload = JSON.parse(msg.payload || '{}');

          const {
            id,
            category,
            message,
            severity,
            status,
            user_id,
            unit,
            created_at,
            data
          } = payload;

          // --- STEP 1: Determine Recipients ---
          let recipients = [];
          const isEmergency = category === 'emergency' || category === 'sos';
          const isZoneBreach = category === 'zone_breach' || category === 'zone_return';

          if (user_id && !isEmergency && !isZoneBreach) {
            // Individual alert (e.g. assignment)
            recipients = [user_id];
          } else if (isZoneBreach) {
            // Zone breach/return: notify relevant commanders and supervisors
            const unitToFilter = unit || null;
            const cmdRes = await pool.query(
              `SELECT id FROM users 
             WHERE role IN('commander', 'supervisor', 'security') 
             ${unitToFilter ? 'AND (unit = $1 OR unit IS NULL)' : ''} `,
              unitToFilter ? [unitToFilter] : []
            );
            recipients = cmdRes.rows.map(r => r.id);
            // Also include the involved soldier so they see it in their history
            if (user_id) recipients.push(user_id);
          } else if (isEmergency) {
            // Emergency: notify ALL commanders and supervisors regardless of unit
            const cmdRes = await pool.query(
              "SELECT id FROM users WHERE role IN ('commander', 'supervisor', 'security')"
            );
            recipients = cmdRes.rows.map(r => r.id);
            // If affected units/users were in data, add them (logic from firebaseService)
            if (data) {
              if (data.affectedUsers) recipients.push(...data.affectedUsers);
              if (data.affectedUnits) {
                const unitRes = await pool.query("SELECT id FROM users WHERE unit = ANY($1)", [data.affectedUnits]);
                recipients.push(...unitRes.rows.map(r => r.id));
              }
            }
          } else {
            // Default: Commanders
            const cmdRes = await pool.query("SELECT id FROM users WHERE role IN ('commander', 'supervisor')");
            recipients = cmdRes.rows.map(r => r.id);
          }

          // CRITICAL: Always include the involved user so it's saved in their history
          if (user_id && !recipients.includes(user_id)) {
            recipients.push(Number(user_id));
          }

          // Deduplicate
          recipients = [...new Set(recipients)];

          if (recipients.length === 0) {
            console.log(`⚠️ No recipients found for alert ${id}.`);
            return;
          }

          // Fetch soldier name if missing
          let soldierName = data?.soldierName || data?.username || data?.user?.username;
          if (!soldierName && user_id) {
            try {
              const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [user_id]);
              if (userRes.rows.length > 0) soldierName = userRes.rows[0].username;
            } catch (e) {
              console.warn('⚠️ Failed to fetch username for notification:', e.message);
            }
          }

          // --- STEP 2: Save to History (notifications table) ---
          const historyTitle = getAlertTitle(category, severity);
          const notificationData = {
            ...data,
            alertId: String(id),
            severity,
            category,
            timestamp: created_at,
            soldierName: soldierName || null // Ensure soldierName is available for UI
          };

          for (const uid of recipients) {
            try {
              const insertResult = await pool.query(
                `INSERT INTO notifications (user_id, title, message, type, category, priority, source, data, sent_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [
                  uid,
                  historyTitle,
                  message,
                  isZoneBreach ? 'zone_breach' : category,
                  category,
                  severity === 'critical' ? 'urgent' : (severity === 'high' ? 'high' : 'normal'),
                  'system',
                  notificationData,
                  created_at
                ]
              );
              const newNotifId = insertResult.rows[0].id;
              console.log(`✅ Saved history for user ${uid} (ID: ${newNotifId})`);
            } catch (dbErr) {
              console.error(`❌ Failed to save history for user ${uid}:`, dbErr.message);
            }
          }

          // --- STEP 3: Send Push Notifications ---
          const pushPayload = {
            title: historyTitle,
            body: message,
            data: notificationData
          };

          console.log(`� Sending push notifications to ${recipients.length} recipients for alert ${id}`);
          try {
            // Only send push to recipients who have tokens (sendBulkFirebaseNotifications handles this)
            await sendBulkFirebaseNotifications(recipients, pushPayload);
          } catch (pushError) {
            console.error(`❌ Bulk push failed for alert ${id}:`, pushError.message);
          }

        } catch (err) {
          console.error('❌ Failed to handle alerts_inserted notification:', err.message);
        }
      });

      // Handle client errors
      client.on('error', (err) => {
        console.error('❌ Database client error:', err.message);
        scheduleReconnect();
      });

      // Handle client end
      client.on('end', () => {
        console.log('📴 Database client disconnected');
        scheduleReconnect();
      });

    } catch (err) {
      console.error('❌ Failed to setup alerts LISTEN:', err.message);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`🔄 Scheduling reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
      setTimeout(setupAlertsListener, reconnectDelay);
    } else {
      console.error('❌ Max reconnect attempts reached. Alerts listener disabled.');
    }
  };

  // Helper function to generate alert titles
  const getAlertTitle = (category, severity) => {
    const emoji = {
      'emergency': '🚨',
      'zone_breach': '🚫',
      'assignment': '📋',
      'system': '⚙️'
    }[category] || '📢';

    const severityText = severity === 'critical' ? 'CRITICAL' :
      severity === 'high' ? 'HIGH' :
        severity === 'medium' ? 'MEDIUM' : 'LOW';

    return `${emoji} ${severityText} ${category.toUpperCase().replace('_', ' ')}`;
  };

  // Start the listener
  await setupAlertsListener();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down alerts listener...');
    if (client) {
      try {
        await client.end();
        console.log('✅ Database client closed');
      } catch (e) {
        console.error('❌ Error closing database client:', e.message);
      }
    }
    process.exit(0);
  });

})();