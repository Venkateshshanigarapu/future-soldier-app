# 🔑 Firebase Service Account Setup Guide
## Future Soldiers APK - Backend Configuration

This guide will help you get the Firebase service account key needed for the backend to send push notifications.

---

## 🚀 **Step 1: Get Firebase Service Account Key**

### 1.1 Go to Firebase Console
- Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
- Select your **future-soldiers** project

### 1.2 Navigate to Service Accounts
- Click the **gear icon** (⚙️) next to "Project Overview"
- Select **Project settings**
- Go to **Service accounts** tab

### 1.3 Generate New Private Key
- Click **Generate new private key**
- Click **Generate key**
- Download the JSON file

### 1.4 File Structure
The downloaded file will look like this:
```json
{
  "type": "service_account",
  "project_id": "future-soldiers",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@future-soldiers.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40future-soldiers.iam.gserviceaccount.com"
}
```

---

## 📁 **Step 2: Configure Backend**

### 2.1 Option A: Use Environment Variable (Recommended)
Create `my-api/.env` file:

```env
# Database Configuration
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=123456
PGDATABASE=OCFA
PGPORT=5433

# Server Configuration
PORT=3001
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=future-soldiers
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"future-soldiers","private_key_id":"YOUR_ACTUAL_PRIVATE_KEY_ID","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@future-soldiers.iam.gserviceaccount.com","client_id":"YOUR_ACTUAL_CLIENT_ID","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40future-soldiers.iam.gserviceaccount.com"}

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000

# Logging
LOG_LEVEL=info
```

**⚠️ IMPORTANT:** Replace the placeholder values with your actual service account details from the downloaded JSON file.

### 2.2 Option B: Use Service Account File
1. Rename the downloaded JSON file to `firebase-service-account.json`
2. Place it in the `my-api/` directory
3. Update `my-api/.env`:

```env
# Use file path instead of inline JSON
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

---

## 🔒 **Security Notes**

### Never Commit Service Account Keys
- Add `.env` to your `.gitignore` file
- Never commit the service account JSON file
- Use environment variables in production

### Production Security
- Restrict service account permissions
- Use IAM roles with minimal required access
- Rotate keys regularly

---

## ✅ **Verification Steps**

### 1. Test Backend Connection
```bash
cd my-api
npm start
```

Look for this message in console:
```
Firebase Admin SDK initialized successfully
```

### 2. Test Notification Sending
```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "title": "Test Alert",
    "message": "Firebase is working!",
    "type": "info",
    "category": "system"
  }'
```

### 3. Check Database
```sql
-- Connect to your PostgreSQL database
psql -U postgres -d OCFA

-- Check if notifications table exists
\dt notifications

-- Check if FCM tokens are stored
SELECT username, fcm_token FROM users LIMIT 5;
```

---

## 🚨 **Troubleshooting**

### Common Issues:

#### 1. "Firebase Admin SDK not initialized"
- Check if service account key is valid
- Verify project ID matches
- Check file permissions

#### 2. "Invalid private key"
- Ensure private key includes newlines (`\n`)
- Check if key is properly escaped in .env
- Try using file path method instead

#### 3. "Permission denied"
- Verify service account has proper roles
- Check if project is active
- Ensure billing is enabled

### Debug Commands:
```bash
# Check environment variables
cd my-api
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# Test Firebase connection
node -e "
const admin = require('firebase-admin');
try {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error.message);
}
"
```

---

## 🎯 **Next Steps**

Once your service account is configured:

1. **Install Dependencies**: `npm install firebase-admin`
2. **Create Database Tables**: Run `database-schema.sql`
3. **Test Frontend**: Ensure FCM tokens are generated
4. **Send Test Notifications**: Verify end-to-end functionality

---

## 📞 **Support**

If you encounter issues:

1. **Check Firebase Console** for project status
2. **Verify Service Account** permissions and roles
3. **Test with Simple Example** first
4. **Check Console Logs** for detailed error messages

---

**🎯 Your Firebase service account is now configured for the Future Soldiers APK backend!**

The system will be able to:
- Send push notifications via Firebase Cloud Messaging
- Handle zone breach alerts
- Broadcast emergency notifications
- Manage assignment notifications
- Track delivery status
