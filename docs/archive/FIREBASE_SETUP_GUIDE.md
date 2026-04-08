# 🔥 Firebase Integration Setup Guide
## Future Soldiers APK - Complete Notification System

This guide will walk you through setting up Firebase Cloud Messaging (FCM) for the Future Soldiers APK to enable:
- ✅ Zone Breach Alerts
- ✅ Emergency Alerts  
- ✅ Assignment Notifications
- ✅ Real-time Push Notifications
- ✅ Background Notifications

---

## 🚀 **Step 1: Create Firebase Project**

### 1.1 Go to Firebase Console
- Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
- Click "Create a project" or select existing project

### 1.2 Project Setup
- **Project name**: `future-soldiers-apk` (or your preferred name)
- **Enable Google Analytics**: Optional (recommended)
- **Analytics account**: Create new or use existing
- Click "Create project"

### 1.3 Add Android App
- Click "Android" icon to add Android app
- **Android package name**: `com.yourcompany.futuresoldiersapk`
- **App nickname**: `Future Soldiers APK`
- **Debug signing certificate**: Leave blank for now
- Click "Register app"

### 1.4 Download Configuration Files
- Download `google-services.json` file
- Place it in `frontend/android/app/` directory

---

## 📱 **Step 2: Configure Frontend (React Native)**

### 2.1 Update Firebase Config
Edit `frontend/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:android:abcdef123456"
};
```

### 2.2 Install Dependencies
```bash
cd frontend
npm install firebase @react-native-firebase/app @react-native-firebase/messaging
```

### 2.3 Update app.json
Add to `frontend/app.json`:

```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging"
    ],
    "android": {
      "googleServicesFile": "./android/app/google-services.json"
    }
  }
}
```

---

## 🖥️ **Step 3: Configure Backend (Node.js)**

### 3.1 Get Service Account Key
1. In Firebase Console, go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Rename to `firebase-service-account.json`
5. Place in `my-api/` directory

### 3.2 Update Environment Variables
Create `my-api/.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id","private_key_id":"key-id","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com"}

# Alternative: Use file path
# GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

### 3.3 Install Dependencies
```bash
cd my-api
npm install firebase-admin
```

---

## 🗄️ **Step 4: Database Setup**

### 4.1 Run Database Schema
```bash
cd my-api
psql -U postgres -d OCFA -f database-schema.sql
```

### 4.2 Verify Tables Created
```sql
\dt
-- Should show: alerts, notifications, zones, assignments, users, etc.
```

---

## 🔧 **Step 5: Test Firebase Integration**

### 5.1 Test Backend Connection
```bash
cd my-api
npm start
```

Check console for: `Firebase Admin SDK initialized successfully`

### 5.2 Test Frontend Connection
```bash
cd frontend
expo start
```

Check console for: `FCM Token: [token]`

### 5.3 Send Test Notification
Use the API endpoint:
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

## 📋 **Step 6: Notification Types Implementation**

### 6.1 Zone Breach Alerts
```javascript
// Frontend: Send zone breach
await notificationService.sendZoneBreachAlert({
  zoneId: 1,
  breachType: 'entry',
  latitude: 40.7128,
  longitude: -74.0060
});

// Backend: Automatically sends to commanders
POST /api/alerts/zone-breach
```

### 6.2 Emergency Alerts
```javascript
// Frontend: Send emergency
await notificationService.sendEmergencyAlert({
  title: 'Medical Emergency',
  message: 'Soldier requires immediate medical attention',
  severity: 'critical',
  affectedUnits: ['Alpha Company'],
  latitude: 40.7128,
  longitude: -74.0060
});

// Backend: Sends to all relevant personnel
POST /api/alerts
```

### 6.3 Assignment Notifications
```javascript
// Frontend: Send assignment
await notificationService.sendAssignmentNotification({
  assignedTo: 2,
  title: 'Patrol Duty',
  description: 'Night patrol in Sector A',
  priority: 'high',
  dueDate: '2024-01-15T20:00:00Z'
});

// Backend: Creates notification and sends push
POST /api/notifications
```

---

## 🎯 **Step 7: Advanced Features**

### 7.1 Notification Channels (Android)
The app automatically creates:
- **Default**: General notifications
- **Zone Breach**: Red alerts with vibration
- **Emergency**: Maximum priority with sound
- **Assignment**: High priority with custom color

### 7.2 Background Notifications
- Works even when app is minimized
- Requires custom build (not Expo Go)
- Uses Expo Task Manager for background processing

### 7.3 Notification Preferences
Users can customize:
- Zone breach alerts
- Assignment notifications
- Emergency alerts
- System notifications
- Quiet hours

---

## 🚨 **Troubleshooting**

### Common Issues:

#### 1. "Firebase Admin SDK not initialized"
- Check service account key in `.env`
- Verify file path is correct
- Ensure JSON is valid

#### 2. "No push tokens found"
- User hasn't granted notification permissions
- App needs to be rebuilt with custom dev client
- Check FCM token generation in console

#### 3. "Notifications not showing"
- Check notification permissions
- Verify notification channels are created
- Test with local notifications first

#### 4. "Backend connection failed"
- Check database connection
- Verify API endpoints
- Check CORS configuration

### Debug Commands:
```bash
# Check Firebase status
cd my-api && npm start

# Check frontend logs
cd frontend && expo start

# Test database
psql -U postgres -d OCFA -c "SELECT * FROM notifications LIMIT 5;"

# Check FCM tokens
psql -U postgres -d OCFA -c "SELECT username, fcm_token FROM users;"
```

---

## 📱 **Testing on Device**

### 1. Build Custom APK
```bash
cd frontend
eas build --platform android --profile development
```

### 2. Install APK
- Download and install APK on device
- Grant all permissions (especially location and notifications)
- Disable battery optimization for the app

### 3. Test Notifications
- Send test notification from backend
- Check if push notification appears
- Test different notification types
- Verify sound and vibration

---

## 🔒 **Security Considerations**

### 1. Service Account Key
- Never commit to version control
- Use environment variables
- Restrict access to production servers

### 2. API Endpoints
- Implement authentication middleware
- Validate user permissions
- Rate limit notification sending

### 3. Data Privacy
- Encrypt sensitive notification data
- Implement notification expiration
- Log notification delivery for audit

---

## 📊 **Monitoring & Analytics**

### 1. Firebase Console
- Monitor notification delivery rates
- Track user engagement
- Analyze notification performance

### 2. Backend Logs
- Notification delivery status
- Error tracking
- Performance metrics

### 3. Database Analytics
- User notification preferences
- Alert response times
- System usage patterns

---

## 🎉 **Success Checklist**

- [ ] Firebase project created
- [ ] Android app registered
- [ ] Service account key downloaded
- [ ] Frontend config updated
- [ ] Backend dependencies installed
- [ ] Database schema created
- [ ] Test notification sent
- [ ] Push notification received on device
- [ ] Zone breach alerts working
- [ ] Emergency alerts working
- [ ] Assignment notifications working

---

## 📞 **Support**

If you encounter issues:

1. **Check console logs** for error messages
2. **Verify Firebase configuration** matches project settings
3. **Test with simple notification** first
4. **Check device permissions** and notification settings
5. **Verify database connection** and table structure

---

**🎯 You now have a fully functional Firebase notification system for the Future Soldiers APK!**

The system will automatically:
- Send zone breach alerts to commanders
- Broadcast emergency alerts to relevant personnel
- Notify soldiers of new assignments
- Handle background notifications
- Manage user preferences
- Track delivery status
