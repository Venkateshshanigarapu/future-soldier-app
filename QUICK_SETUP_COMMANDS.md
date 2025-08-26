# 🚀 Quick Setup Commands
## Future Soldiers APK - Firebase Integration

Follow these commands step-by-step to get your Firebase notification system running.

---

## 📱 **Frontend Setup**

### 1. Install Firebase Dependencies
```bash
cd frontend
npm install firebase @react-native-firebase/app @react-native-firebase/messaging
```

### 2. Place Configuration Files
```bash
# For Android
cp google-services.json frontend/android/app/

# For iOS (if you have iOS setup)
cp GoogleService-Info.plist frontend/ios/
```

### 3. Start Frontend
```bash
cd frontend
expo start
```

**Look for in console:**
```
FCM Token: [your-fcm-token]
```

---

## 🖥️ **Backend Setup**

### 1. Install Dependencies
```bash
cd my-api
npm install firebase-admin
```

### 2. Get Firebase Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **future-soldiers** project
3. Go to **Project Settings** → **Service accounts**
4. Click **Generate new private key**
5. Download the JSON file

### 3. Create Environment File
```bash
cd my-api
cp env.example .env
```

**Edit `.env` file with your actual values:**
```env
FIREBASE_PROJECT_ID=future-soldiers
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"future-soldiers","private_key_id":"YOUR_ACTUAL_PRIVATE_KEY_ID","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@future-soldiers.iam.gserviceaccount.com","client_id":"YOUR_ACTUAL_CLIENT_ID","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40future-soldiers.iam.gserviceaccount.com"}
```

### 4. Create Database Tables
```bash
cd my-api
psql -U postgres -d OCFA -f database-schema.sql
```

### 5. Start Backend
```bash
cd my-api
npm start
```

**Look for in console:**
```
Firebase Admin SDK initialized successfully
Server running on http://localhost:3001
```

---

## 🧪 **Testing**

### 1. Test Backend Connection
```bash
curl http://localhost:3001/api/ping
```

**Expected response:**
```json
{"success": true, "message": "API is reachable"}
```

### 2. Test Database Connection
```bash
curl http://localhost:3001/api/dbtest
```

**Expected response:**
```json
{"success": true, "time": "2024-01-15T10:30:00.000Z"}
```

### 3. Send Test Notification
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

---

## 🔧 **Troubleshooting Commands**

### Check Environment Variables
```bash
cd my-api
node -e "console.log('Project ID:', process.env.FIREBASE_PROJECT_ID)"
```

### Test Firebase Connection
```bash
cd my-api
node -e "
const admin = require('firebase-admin');
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
}
"
```

### Check Database Tables
```bash
psql -U postgres -d OCFA -c "\dt"
```

### Check FCM Tokens
```bash
psql -U postgres -d OCFA -c "SELECT username, fcm_token FROM users LIMIT 5;"
```

---

## 📱 **Device Testing**

### 1. Build Custom APK (Required for notifications)
```bash
cd frontend
eas build --platform android --profile development
```

### 2. Install APK
- Download and install APK on device
- Grant all permissions (especially notifications)
- Disable battery optimization

### 3. Test Notifications
- Send test notification from backend
- Check if push notification appears
- Verify sound and vibration

---

## ✅ **Success Checklist**

- [ ] Frontend shows FCM token in console
- [ ] Backend shows "Firebase Admin SDK initialized successfully"
- [ ] Database tables created successfully
- [ ] Test notification API responds
- [ ] Push notification received on device
- [ ] Zone breach alerts working
- [ ] Emergency alerts working
- [ ] Assignment notifications working

---

## 🚨 **Common Issues & Solutions**

### Issue: "Firebase Admin SDK not initialized"
**Solution:** Check your service account key in `.env` file

### Issue: "No push tokens found"
**Solution:** Ensure user has granted notification permissions

### Issue: "Notifications not showing"
**Solution:** Build custom APK (Expo Go doesn't support background notifications)

### Issue: "Database connection failed"
**Solution:** Check PostgreSQL is running and credentials are correct

---

## 📞 **Need Help?**

1. **Check console logs** for error messages
2. **Verify Firebase configuration** matches project settings
3. **Test with simple notification** first
4. **Check device permissions** and notification settings

---

**🎯 Follow these commands step-by-step and you'll have a fully functional Firebase notification system!**
