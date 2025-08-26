# Background Location Tracking Troubleshooting Guide

## Overview
This guide helps resolve issues with background location tracking in the Future Soldiers APK.

## Common Issues and Solutions

### 1. Location Not Updating When App is Closed

**Symptoms:**
- Location updates stop when app is minimized/closed
- No location data in backend logs when app is backgrounded
- Background location permission granted but not working

**Solutions:**

#### A. Check App Configuration
1. **Verify app.json configuration:**
   ```json
   {
     "ios": {
       "infoPlist": {
         "UIBackgroundModes": ["location", "background-processing"],
         "NSLocationAlwaysAndWhenInUseUsageDescription": "Allow location tracking in background"
       }
     },
     "android": {
       "permissions": [
         "ACCESS_FINE_LOCATION",
         "ACCESS_COARSE_LOCATION", 
         "ACCESS_BACKGROUND_LOCATION",
         "FOREGROUND_SERVICE",
         "WAKE_LOCK"
       ]
     }
   }
   ```

2. **Ensure you're using a custom build, NOT Expo Go:**
   ```bash
   # Build custom development client
   eas build --profile development --platform android
   
   # Or build production APK
   eas build --platform android
   ```

#### B. Check Device Settings
1. **Android:**
   - Go to Settings > Apps > Future Soldiers > Permissions
   - Ensure "Location" is set to "Allow all the time"
   - Go to Settings > Apps > Future Soldiers > Battery
   - Disable "Battery optimization" for the app
   - Enable "Allow background activity"

2. **iOS:**
   - Go to Settings > Privacy & Security > Location Services > Future Soldiers
   - Set to "Always"
   - Go to Settings > General > Background App Refresh
   - Ensure it's enabled for Future Soldiers

#### C. Check Background Task Implementation
1. **Verify TaskManager.defineTask is called:**
   ```javascript
   // This should be called at app startup
   TaskManager.defineTask('background-location-task', async ({ data, error }) => {
     // Your location handling code
   });
   ```

2. **Check location update intervals:**
   ```javascript
   await Location.startLocationUpdatesAsync('background-location-task', {
     accuracy: Location.Accuracy.Balanced,
     timeInterval: 30000, // 30 seconds
     distanceInterval: 10, // 10 meters
     showsBackgroundLocationIndicator: true,
   });
   ```

### 2. Network Connectivity Issues

**Symptoms:**
- Location updates work but don't reach backend
- Network errors in console logs
- Location data not appearing in database

**Solutions:**

1. **Check API URL configuration:**
   ```javascript
   // In backgroundLocationService.js
   const API_BASE_URL = 'http://192.168.1.18:3001/api;
   ```

2. **Add network connectivity check:**
   ```javascript
   const isNetworkAvailable = async () => {
     const state = await NetInfo.fetch();
     return state.isConnected && state.isInternetReachable;
   };
   ```

3. **Implement retry logic:**
   ```javascript
   const sendLocationUpdate = async (userId, latitude, longitude, heading) => {
     const maxRetries = 3;
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(`${API_BASE_URL}/users/${userId}/location`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ latitude, longitude, heading }),
         });
         if (response.ok) break;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
       }
     }
   };
   ```

### 3. Permission Issues

**Symptoms:**
- App crashes when requesting location
- Permission dialogs don't appear
- "Permission denied" errors

**Solutions:**

1. **Request permissions in correct order:**
   ```javascript
   // First request foreground permission
   const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
   if (foregroundStatus !== 'granted') {
     throw new Error('Foreground location permission denied');
   }

   // Then request background permission
   const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
   if (backgroundStatus !== 'granted') {
     throw new Error('Background location permission denied');
   }
   ```

2. **Handle permission changes:**
   ```javascript
   useEffect(() => {
     const checkPermissions = async () => {
       const { status } = await Location.getForegroundPermissionsAsync();
       if (status !== 'granted') {
         // Re-request permissions
         await startBackgroundLocation();
       }
     };
     checkPermissions();
   }, []);
   ```

### 4. Battery Optimization Issues

**Symptoms:**
- Location updates work initially but stop after some time
- App gets killed by system
- Inconsistent background behavior

**Solutions:**

1. **Android Battery Optimization:**
   - Guide users to disable battery optimization
   - Add a notification to remind users
   ```javascript
   const checkBatteryOptimization = async () => {
     if (Platform.OS === 'android') {
       // Show dialog to guide user to battery settings
       Alert.alert(
         'Battery Optimization',
         'Please disable battery optimization for this app to ensure background location tracking works properly.',
         [
           { text: 'Cancel', style: 'cancel' },
           { text: 'Open Settings', onPress: () => openAppSettings() }
         ]
       );
     }
   };
   ```

2. **Use Foreground Service (Android):**
   ```javascript
   await Location.startLocationUpdatesAsync('background-location-task', {
     foregroundService: {
       notificationTitle: 'Location Tracking',
       notificationBody: 'Your location is being tracked in the background.',
       notificationColor: '#4CAF50',
     },
   });
   ```

### 5. Debugging Steps

#### A. Enable Debug Logging
```javascript
// Add to backgroundLocationService.js
const DEBUG = true;

const log = (message, data) => {
  if (DEBUG) {
    console.log(`[BackgroundLocation] ${message}`, data || '');
  }
};
```

#### B. Test Background Location
1. **Use the BackgroundLocationStatus component:**
   - Navigate to Profile screen
   - Check if status shows "Running"
   - Toggle tracking on/off

2. **Monitor backend logs:**
   ```bash
   # Check your backend logs for location updates
   tail -f backend-logs.log | grep "location"
   ```

3. **Test with app in background:**
   - Start location tracking
   - Minimize app
   - Move around
   - Check backend logs for updates

#### C. Common Debug Commands
```bash
# Check if background location is running
adb shell dumpsys location | grep "Future Soldiers"

# Check app permissions
adb shell dumpsys package com.vikram662.My | grep permission

# Monitor app logs
adb logcat | grep "BackgroundLocation"
```

### 6. Testing Checklist

- [ ] App built with custom development client (not Expo Go)
- [ ] All permissions granted (foreground + background)
- [ ] Battery optimization disabled
- [ ] Network connectivity available
- [ ] Background app refresh enabled (iOS)
- [ ] Location services enabled on device
- [ ] App has proper background modes configured
- [ ] TaskManager.defineTask is called at app startup
- [ ] Location updates are being sent to backend
- [ ] Backend is receiving and processing location data

### 7. Emergency Fixes

If background location still doesn't work:

1. **Rebuild the app:**
   ```bash
   cd frontend
   eas build --profile development --platform android --clear-cache
   ```

2. **Clear app data and reinstall**

3. **Test on a different device**

4. **Check if the issue is device-specific or app-wide**

## Support

If you're still experiencing issues after following this guide:

1. Check the console logs for specific error messages
2. Verify your backend is running and accessible
3. Test with a simple location update (not background)
4. Contact the development team with specific error details
