# Industrial-Standard Push Notification System

## Overview

This implementation provides a complete, production-ready push notification system for the Future Soldiers APK. The system automatically sends push notifications whenever a new alert is inserted into the PostgreSQL database, with comprehensive error handling, retry logic, and user targeting.

## Features

### ✅ Always Active Notifications
- **Background Delivery**: Notifications work even when the app is killed or in background
- **Foreground Display**: Notifications show while app is active with proper handling
- **Sound & Vibration**: Each notification type has appropriate sound and vibration patterns
- **Click Interaction**: Users can tap notifications to navigate to relevant screens

### ✅ Database-Triggered Notifications
- **PostgreSQL LISTEN/NOTIFY**: Real-time database monitoring for alert inserts
- **Automatic Push**: Instant push notification delivery on database changes
- **Fallback Mechanisms**: Multiple delivery methods ensure reliability

### ✅ Industrial Standards
- **Retry Logic**: Exponential backoff for failed deliveries
- **Rate Limiting**: Prevents API quota exhaustion
- **Error Handling**: Comprehensive logging and error recovery
- **Scalable Architecture**: Supports multiple users with unique device tokens

## Architecture

### Backend (Node.js/Express + PostgreSQL)

#### 1. Database Trigger
```sql
-- Automatically fires on every alerts table insert
CREATE OR REPLACE FUNCTION notify_alerts_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('alerts_inserted', row_to_json(NEW)::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_insert_trigger
AFTER INSERT ON alerts
FOR EACH ROW
EXECUTE FUNCTION notify_alerts_insert();
```

#### 2. Server Listener
- **Real-time Monitoring**: Listens to PostgreSQL `alerts_inserted` channel
- **Automatic Reconnection**: Handles database disconnections gracefully
- **Smart Targeting**: Routes notifications based on user_id, unit, or role

#### 3. Firebase Integration
- **FCM Primary**: Uses Firebase Cloud Messaging for reliable delivery
- **Expo Fallback**: Expo push service as backup for broader compatibility
- **Multi-platform**: Supports Android, iOS, and Web platforms

### Frontend (React Native + Expo)

#### 1. Token Registration
- **Automatic Registration**: Gets FCM and Expo tokens on app startup
- **Server Sync**: Sends tokens to backend for storage
- **Permission Handling**: Requests and manages notification permissions

#### 2. Notification Channels (Android)
- **Emergency**: Highest priority, bypasses DND, public lockscreen
- **Zone Breach**: High priority, public lockscreen
- **Assignment**: Default priority, private lockscreen
- **System**: Low priority, minimal interruption

#### 3. Background Handling
- **Foreground**: Shows banner with sound and navigation
- **Background**: Displays system notification with tap handling
- **Killed State**: Launches app and navigates to relevant screen

## Setup Instructions

### 1. Backend Setup

#### Database Configuration
```bash
# Run the database schema to create triggers
psql -d your_database -f database-schema.sql
```

#### Environment Variables
```bash
# Firebase Admin SDK credentials
FIREBASE_PROJECT_ID=future-soldiers
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

#### Install Dependencies
```bash
cd my-api
npm install firebase-admin pg socket.io
```

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install expo-notifications @react-native-async-storage/async-storage
```

#### Configure app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#10B981",
          "sounds": ["./assets/notification-sound.wav"],
          "mode": "production"
        }
      ]
    ]
  }
}
```

#### Firebase Configuration
- Add `google-services.json` to `frontend/` for Android
- Configure Firebase project in Firebase Console
- Enable Cloud Messaging API

### 3. Testing

#### Test Endpoints
```bash
# Test basic push notification
curl -X POST http://localhost:3001/api/alerts/test-push \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "type": "test", "message": "Test notification"}'

# Test emergency notification
curl -X POST http://localhost:3001/api/alerts/test-emergency \
  -H "Content-Type: application/json" \
  -d '{"severity": "critical", "message": "Emergency test"}'

# Test unit-wide notification
curl -X POST http://localhost:3001/api/alerts/test-push \
  -H "Content-Type: application/json" \
  -d '{"unit": "Alpha", "type": "zone_breach", "message": "Zone breach detected"}'
```

#### Manual Database Test
```sql
-- Insert test alert to trigger notification
INSERT INTO alerts (category, message, severity, status, user_id, unit)
VALUES ('test', 'Manual test alert', 'medium', 'active', 1, 'Alpha');
```

## Usage Examples

### 1. Send to Specific User
```javascript
// Backend
const alert = await pool.query(
  `INSERT INTO alerts (category, message, severity, status, user_id)
   VALUES ($1, $2, $3, $4, $5) RETURNING *`,
  ['assignment', 'New task assigned', 'medium', 'active', userId]
);
// Automatically triggers push notification to user
```

### 2. Send to Unit
```javascript
// Backend
const alert = await pool.query(
  `INSERT INTO alerts (category, message, severity, status, unit)
   VALUES ($1, $2, $3, $4, $5) RETURNING *`,
  ['zone_breach', 'Zone breach detected', 'high', 'active', 'Alpha']
);
// Automatically triggers push to all users in Alpha unit
```

### 3. Emergency Broadcast
```javascript
// Backend
const alert = await pool.query(
  `INSERT INTO alerts (category, message, severity, status)
   VALUES ($1, $2, $3, $4) RETURNING *`,
  ['emergency', 'Critical situation', 'critical', 'active']
);
// Automatically triggers push to all commanders and supervisors
```

## Notification Types

### 1. Emergency Alerts
- **Priority**: Highest
- **Sound**: Emergency tone
- **Vibration**: Intense pattern
- **Target**: All commanders and supervisors
- **Bypass DND**: Yes

### 2. Zone Breach Alerts
- **Priority**: High
- **Sound**: Default with urgency
- **Vibration**: Distinctive pattern
- **Target**: Unit commanders and security
- **Navigation**: Geospatial screen

### 3. Assignment Notifications
- **Priority**: Default
- **Sound**: Standard notification
- **Vibration**: Light pattern
- **Target**: Assigned user
- **Navigation**: Assignment screen

### 4. System Notifications
- **Priority**: Low
- **Sound**: Minimal or none
- **Vibration**: Light
- **Target**: All users or specific roles
- **Navigation**: Notifications screen

## Error Handling

### Backend Errors
- **Database Connection**: Automatic reconnection with exponential backoff
- **FCM Failures**: Retry logic with fallback to Expo
- **Token Invalid**: Automatic cleanup of invalid tokens
- **Rate Limiting**: Batch processing with delays

### Frontend Errors
- **Permission Denied**: Graceful degradation with in-app notifications
- **Token Generation**: Retry with user feedback
- **Network Issues**: Offline queue with sync on reconnection
- **Navigation Errors**: Fallback to main screen

## Monitoring & Logging

### Backend Logs
```javascript
// Success logs
console.log('✅ FCM notification sent successfully to user 123 (john_doe)');
console.log('📊 Bulk notification complete: 45 successful, 2 failed out of 47 total');

// Error logs
console.error('❌ FCM notification failed for user 123:', error.message);
console.log('🔄 Retrying FCM notification for user 123 (attempt 2/3)');
```

### Frontend Logs
```javascript
// Success logs
console.log('✅ Push notification registration completed successfully');
console.log('📱 Local notification scheduled: Emergency Alert');

// Error logs
console.error('❌ Error registering for push notifications:', error);
console.log('⚠️ No FCM token available for Android');
```

## Performance Optimization

### Backend
- **Connection Pooling**: Efficient database connections
- **Batch Processing**: Rate-limited bulk notifications
- **Caching**: User preferences and tokens caching
- **Async Processing**: Non-blocking notification delivery

### Frontend
- **Lazy Loading**: Notification handlers loaded on demand
- **Memory Management**: Automatic cleanup of old notifications
- **Battery Optimization**: Minimal background processing
- **Network Efficiency**: Compressed payloads and efficient sync

## Security Considerations

### Token Security
- **Encrypted Storage**: Tokens stored securely in database
- **Token Rotation**: Automatic token refresh
- **Access Control**: User-specific token access
- **Audit Logging**: All notification attempts logged

### Data Privacy
- **User Consent**: Explicit permission requests
- **Data Minimization**: Only necessary data in notifications
- **Secure Transmission**: HTTPS for all API calls
- **Local Storage**: Sensitive data encrypted locally

## Troubleshooting

### Common Issues

#### 1. Notifications Not Received
```bash
# Check backend logs
tail -f my-api/logs/app.log

# Verify database trigger
psql -d database -c "SELECT * FROM pg_trigger WHERE tgname = 'alerts_insert_trigger';"

# Test manual notification
curl -X POST http://localhost:3001/api/alerts/test-push -H "Content-Type: application/json" -d '{"userId": 1}'
```

#### 2. Permission Issues
```javascript
// Check permission status
const { status } = await Notifications.getPermissionsAsync();
console.log('Permission status:', status);

// Request permissions
const { status: newStatus } = await Notifications.requestPermissionsAsync();
```

#### 3. Token Issues
```javascript
// Verify token generation
const expoToken = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-project-id'
});
console.log('Expo token:', expoToken.data);
```

### Debug Mode
```javascript
// Enable debug logging
const DEBUG_MODE = true;

if (DEBUG_MODE) {
  console.log('🔍 Debug: Notification payload:', payload);
  console.log('🔍 Debug: User tokens:', userTokens);
}
```

## Production Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/prod_db
FIREBASE_PROJECT_ID=prod-future-soldiers
```

### Monitoring
- **Health Checks**: `/api/ping` endpoint for uptime monitoring
- **Metrics**: Notification delivery rates and failure tracking
- **Alerts**: Automated alerts for system failures
- **Logs**: Centralized logging with error tracking

### Scaling
- **Load Balancing**: Multiple server instances
- **Database**: Read replicas for notification queries
- **Caching**: Redis for user preferences and tokens
- **CDN**: Static assets delivery optimization

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend and frontend logs
3. Test with the provided test endpoints
4. Verify Firebase configuration
5. Check database trigger status

## License

This push notification system is part of the Future Soldiers APK project and follows industrial best practices for reliability, security, and performance.
