# Login Tracking Implementation

## Overview
This implementation adds login tracking functionality to the Future Soldiers APK. The system now tracks:
- Last Login Attempt: Timestamp of the most recent login attempt (successful or failed)
- Last Login Success: Timestamp of the most recent successful login
- Login Attempts Count: Counter for tracking consecutive failed login attempts

## Database Changes

### Migration File
**File**: `my-api/migrations/add-login-tracking.sql`

This migration adds three new columns to the `users` table:
1. `last_login_attempt` (TIMESTAMP): Records every login attempt
2. `last_login_success` (TIMESTAMP): Records only successful logins
3. `login_attempts_count` (INTEGER): Counter for failed attempts (optional, for future security features)

### How to Run Migration

#### Option 1: Using psql (Recommended)
```bash
psql -U your_username -d your_database -f my-api/migrations/add-login-tracking.sql
```

#### Option 2: Using pgAdmin or DBeaver
1. Open the SQL file in your database client
2. Execute the script

#### Option 3: Programmatically from Node.js
```javascript
const fs = require('fs');
const pool = require('./db');

async function runMigration() {
  const migrationSQL = fs.readFileSync('./migrations/add-login-tracking.sql', 'utf8');
  await pool.query(migrationSQL);
  console.log('Migration completed successfully');
}

runMigration();
```

## Backend Changes

### Updated File: `my-api/routes/users.js`

#### Login Endpoint Updates
The `/api/users/login` endpoint now:
1. **Tracks all attempts**: Updates `last_login_attempt` timestamp for every login attempt
2. **Tracks successes**: Updates `last_login_success` when login is successful
3. **Counts failures**: Increments `login_attempts_count` for failed attempts
4. **Resets counter**: Sets `login_attempts_count = 0` on successful login

#### Code Logic:
```javascript
// On successful login:
UPDATE users SET 
  last_login_attempt = NOW(),
  last_login_success = NOW(),
  login_attempts_count = 0
WHERE id = $1

// On failed login (if user exists):
UPDATE users SET 
  last_login_attempt = NOW(),
  login_attempts_count = COALESCE(login_attempts_count, 0) + 1
WHERE id = $1
```

## Frontend Integration

The frontend already has the UI components to display this information in `ProfileScreen.js`:

### Display Fields (Lines 606-623)
```javascript
<Text style={styles.infoLabel}>Last Login Attempt:</Text>
<Text style={styles.infoValue}>
  {userData && userData.last_login_attempt 
    ? new Date(userData.last_login_attempt).toLocaleDateString() + ' ' + 
      new Date(userData.last_login_attempt).toLocaleTimeString()
    : '-'
  }
</Text>

<Text style={styles.infoLabel}>Last Login Success:</Text>
<Text style={styles.infoValue}>
  {userData && userData.last_login_success 
    ? new Date(userData.last_login_success).toLocaleDateString() + ' ' + 
      new Date(userData.last_login_success).toLocaleTimeString()
    : '-'
  }
</Text>
```

### Data Fetching (Lines 1779-1802)
The ProfileScreen automatically fetches updated login information using:
```javascript
const freshUserData = await apiService.getUserByUsername(user.username || user.serviceId);
```

This calls the backend endpoint: `GET /api/users?username={username}` which returns all user data including the new login tracking fields.

## Testing

### 1. Run the Migration
```bash
cd my-api
psql -U postgres -d OCFA -f migrations/add-login-tracking.sql
```

### 2. Test Successful Login
1. Log in with valid credentials
2. Navigate to Profile screen
3. Check that "Last Login Attempt" and "Last Login Success" show current timestamp
4. Both timestamps should be the same

### 3. Test Failed Login
1. Attempt login with wrong password
2. Navigate to Profile screen (if possible) or check database
3. Verify "Last Login Attempt" is updated
4. Verify "Last Login Success" is NOT updated
5. Check `login_attempts_count` in database is incremented

### 4. Verify Database
```sql
SELECT 
  username,
  last_login_attempt,
  last_login_success,
  login_attempts_count
FROM users
ORDER BY last_login_attempt DESC
LIMIT 10;
```

## Database Queries for Monitoring

### Find Users with Recent Login Activity
```sql
SELECT 
  username,
  name,
  role,
  last_login_attempt,
  last_login_success,
  login_attempts_count
FROM users
WHERE last_login_attempt >= NOW() - INTERVAL '7 days'
ORDER BY last_login_attempt DESC;
```

### Find Users with Failed Login Attempts
```sql
SELECT 
  username,
  name,
  last_login_attempt,
  login_attempts_count
FROM users
WHERE login_attempts_count > 0
ORDER BY login_attempts_count DESC;
```

### Find Users Who Never Logged In
```sql
SELECT 
  username,
  name,
  role,
  created_at
FROM users
WHERE last_login_success IS NULL
ORDER BY created_at DESC;
```

## Future Enhancements

### Security Features Based on Login Tracking

1. **Account Lockout**: Implement automatic account lockout after X failed attempts
   ```javascript
   if (login_attempts_count >= 5) {
     return res.status(429).json({ 
       error: 'Account locked due to too many failed login attempts',
       lockedUntil: lockedUntil
     });
   }
   ```

2. **Rate Limiting**: Apply rate limiting per user based on login attempts
   ```javascript
   const recentAttempts = await pool.query(
     'SELECT COUNT(*) FROM users WHERE id = $1 AND last_login_attempt > NOW() - INTERVAL \'15 minutes\'',
     [userId]
   );
   ```

3. **Password Reset**: Suggest password reset after failed attempts
   ```javascript
   if (login_attempts_count >= 3) {
     sendPasswordResetEmail(user.email);
   }
   ```

4. **Audit Log**: Create a separate audit log table for security analysis
   ```sql
   CREATE TABLE login_audit_log (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     ip_address VARCHAR(45),
     user_agent TEXT,
     success BOOLEAN,
     failure_reason TEXT
   );
   ```

## Rollback (If Needed)

To rollback this feature, run:
```sql
-- Remove columns
ALTER TABLE users DROP COLUMN IF EXISTS last_login_attempt;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_success;
ALTER TABLE users DROP COLUMN IF EXISTS login_attempts_count;

-- Remove indexes
DROP INDEX IF EXISTS idx_users_last_login_success;
DROP INDEX IF EXISTS idx_users_last_login_attempt;
```

## Troubleshooting

### Issue: Login tracking fields showing as `null`
**Solution**: Ensure migration was run successfully. Check database schema:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('last_login_attempt', 'last_login_success', 'login_attempts_count');
```

### Issue: Frontend not displaying updated data
**Solution**: Clear AsyncStorage cache or restart the app. The ProfileScreen fetches fresh data on mount.

### Issue: Timestamps showing as NaN
**Solution**: Check database timestamp format. PostgreSQL TIMESTAMP should work with JavaScript Date constructor.

## Support

For issues or questions:
1. Check database schema to verify columns exist
2. Test backend endpoint directly: `GET /api/users?username=testuser`
3. Check server logs for SQL errors
4. Verify migration ran without errors

## Changelog

- **2025-01-XX**: Initial implementation of login tracking
  - Added database columns for login tracking
  - Updated login endpoint to track attempts and successes
  - Frontend UI already in place for displaying data

