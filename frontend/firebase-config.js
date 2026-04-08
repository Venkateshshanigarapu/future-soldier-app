import { initializeApp } from 'firebase/app';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './services/api';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwMNO1MhvHU3TumiYOUGWFK6mnIgHxTf8",
  authDomain: "future-soldiers.firebaseapp.com",
  projectId: "future-soldiers",
  storageBucket: "future-soldiers.firebasestorage.app",
  messagingSenderId: "108342925328",
  appId: Platform.OS === 'ios'
    ? "1:108342925328:ios:a42dc283074797fddb9295"
    : "1:108342925328:android:f95636b08c04eaf8db9295"
};

// Lazy init to avoid importing web messaging module on RN
let app;
let messaging = null;
let messagingMod = null; // Holds the dynamically imported firebase/messaging module when on web

function ensureFirebaseInitialized() {
  if (!app) {
    const { initializeApp } = require('firebase/app');
    app = initializeApp(firebaseConfig);
  }
  return app;
}

async function ensureMessagingIfWeb() {
  // Only enable Firebase web messaging on the web platform, never on native
  if (Platform.OS !== 'web') return null;
  if (!messagingMod) {
    messagingMod = await import('firebase/messaging');
  }
  if (!messaging) {
    const { getMessaging } = messagingMod;
    messaging = getMessaging(ensureFirebaseInitialized());
  }
  return messaging;
}

// Configure notification channels for Android with industrial standards
const createNotificationChannels = () => {
  if (Platform.OS === 'android') {
    // Emergency channel - highest priority
    Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#FF0000',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });

    // Zone breach channel - high priority
    Notifications.setNotificationChannelAsync('zone-breach', {
      name: 'Zone Breach Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#FF0000',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Assignment channel - default priority
    Notifications.setNotificationChannelAsync('assignment', {
      name: 'Assignment Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#FFA500',
      sound: 'default',
      enableVibrate: true,
      enableLights: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });

    // System channel - low priority
    Notifications.setNotificationChannelAsync('system', {
      name: 'System Notifications',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0, 100],
      lightColor: '#2196F3',
      sound: null,
      enableVibrate: false,
      enableLights: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });

    // Default channel for fallback
    Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#2196F3',
      sound: 'default',
      enableVibrate: true,
      enableLights: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
};

// Register for push notifications with comprehensive error handling
const registerForPushNotificationsAsync = async () => {
  try {
    console.log('🔔 Starting push notification registration...');

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('📋 Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push notification permissions!');
      return null;
    }

    console.log('✅ Notification permissions granted');

    // Create notification channels
    createNotificationChannels();

    // Get Expo push token
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: '906dc6f9-b8ef-4b03-91c1-3aeaeeed2c78',
    });
    console.log('📱 Expo Token:', expoToken.data);

    let fcmToken = null;

    // Get FCM token for Android
    if (Platform.OS === 'android') {
      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        fcmToken = devicePushToken?.data || null;
        if (fcmToken) {
          console.log('📱 Android FCM Token:', fcmToken);
        } else {
          console.log('⚠️ No FCM token available for Android');
        }
      } catch (err) {
        console.log('❌ Failed to get Android FCM token:', err?.message);
      }
    } else if (Platform.OS === 'ios') {
      // For iOS, we'll use Expo token as primary
      console.log('📱 Using Expo token for iOS');
    } else {
      // Web platform
      const webMessaging = await ensureMessagingIfWeb();
      if (webMessaging && messagingMod) {
        try {
          const { getToken } = messagingMod;
          fcmToken = await getToken(webMessaging, { vapidKey: 'YOUR_VAPID_KEY' });
          console.log('📱 Web FCM Token:', fcmToken);
        } catch (error) {
          console.log('❌ Web FCM token not available:', error.message);
        }
      }
    }

    // Send tokens to server
    await sendTokenToServer(expoToken.data, fcmToken);

    // Subscribe Android devices to 'alerts' topic via backend
    if (Platform.OS === 'android' && fcmToken) {
      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/users/subscribe-topic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken, topic: 'alerts' }),
        });
        const result = await response.json().catch(() => ({}));
        console.log('✅ Subscribed to topic alerts:', result?.topic || 'alerts');
      } catch (e) {
        console.log('⚠️ Topic subscribe failed (non-fatal):', e.message);
      }
    }

    console.log('✅ Push notification registration completed successfully');
    return { expoToken: expoToken.data, fcmToken };

  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return null;
  }
};

// Send tokens to server with retry logic
const sendTokenToServer = async (expoToken, fcmToken, retryCount = 0) => {
  const maxRetries = 2; // Reduced from 3 to 2
  const retryDelay = 2000; // Fixed delay instead of exponential backoff

  try {
    const userData = await AsyncStorage.getItem('currentUser');
    if (!userData) {
      console.log('⚠️ No user data found, skipping token update');
      return;
    }
    const user = JSON.parse(userData);

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/users/update-tokens`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        expoToken,
        fcmToken,
        deviceType: Platform.OS,
        appVersion: '1.0.0',
        platform: Platform.OS,
        timestamp: new Date().toISOString()
      }),
    });

    if (response.ok) {
      console.log('✅ Tokens updated on server successfully');
    } else {
      const errorText = await response.text();
      console.log('❌ Failed to update tokens on server:', errorText);
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error sending tokens to server:', error);

    // Retry logic with reduced attempts
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying token update (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return sendTokenToServer(expoToken, fcmToken, retryCount + 1);
    } else {
      console.log('⚠️ Token update failed after all retries, will retry on next app launch');
    }
  }
};

// Handle incoming notifications with comprehensive logic
const setupNotificationHandlers = () => {
  console.log('🎧 Setting up notification handlers...');

  // Foreground notification handler
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    const content = (notification && notification.request && notification.request.content) ? notification.request.content : {};
    const title = content && content.title ? content.title : '';
    const data = content && content.data ? content.data : {};
    console.log('📨 Foreground notification received:', title);

    // Avoid echo loop: if this was scheduled locally, skip
    if (data && data.__localEcho) {
      console.log('⚠️ Duplicate notification ignored');
      return;
    }

    const notificationData = {
      id: (notification && notification.request && notification.request.identifier) ? notification.request.identifier : Date.now().toString(),
      title,
      message: content && content.body ? content.body : '',
      data,
      timestamp: new Date().toISOString(),
      isRead: false,
      source: 'push'
    };

    // Save only; do not re-schedule a local notification while in foreground
    addNotificationToStorage(notificationData);
  });

  // Notification response handler (when user taps notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 Notification tapped:', response.notification.request.content.title);

    const data = response.notification.request.content.data;

    // Mark as read
    markNotificationAsRead(response.notification.request.identifier);

    // Navigate based on notification type
    handleNotificationNavigation(data);
  });

  // Optional: handle FCM foreground messages on web
  ensureMessagingIfWeb().then(webMessaging => {
    if (webMessaging && messagingMod) {
      const { onMessage } = messagingMod;
      onMessage(webMessaging, (payload) => {
        console.log('📨 FCM foreground message received:', payload);
        showLocalNotification({
          title: payload.notification?.title || 'New Message',
          body: payload.notification?.body || 'You have a new notification',
          data: payload.data || {}
        });
      });
    }
  });

  console.log('✅ Notification handlers setup completed');

  return () => {
    console.log('🧹 Cleaning up notification handlers...');
    foregroundSubscription?.remove();
    responseSubscription?.remove();
  };
};

// Show local notification with enhanced configuration
const showLocalNotification = async (notification) => {
  try {
    const channelId = getChannelId(notification.data?.type);
    const priority = getNotificationPriority(notification.data?.type);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.message,
        data: notification.data,
        sound: notification.data?.sound || 'default',
        priority: priority,
        badge: 1,
        autoDismiss: false,
        sticky: notification.data?.requiresAction || false,
      },
      trigger: null, // Show immediately
    });

    console.log(`📱 Local notification scheduled: ${notification.title}`);
  } catch (error) {
    console.error('❌ Error showing local notification:', error);
  }
};

// Add notification to local storage with deduplication
const addNotificationToStorage = async (notification) => {
  try {
    const existingNotifications = await AsyncStorage.getItem('notifications');
    let notifications = existingNotifications ? JSON.parse(existingNotifications) : [];

    // Check for duplicates (same title + message within 10 seconds)
    const isDuplicate = notifications.some(n =>
      n.title === notification.title &&
      n.message === notification.message &&
      Math.abs(new Date(n.timestamp) - new Date(notification.timestamp)) < 10000
    );

    if (!isDuplicate) {
      notifications.unshift(notification);
      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications = notifications.slice(0, 100);
      }
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      console.log('💾 Notification saved to local storage');
    } else {
      console.log('⚠️ Duplicate notification ignored');
    }
  } catch (error) {
    console.error('❌ Error saving notification to storage:', error);
  }
};

// Mark notification as read
const markNotificationAsRead = async (notificationId) => {
  try {
    const existingNotifications = await AsyncStorage.getItem('notifications');
    if (existingNotifications) {
      let notifications = JSON.parse(existingNotifications);
      notifications = notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      );
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
  }
};

// Handle notification navigation
const handleNotificationNavigation = (data) => {
  // Import navigation ref dynamically to avoid circular dependencies
  const { navigationRef } = require('./App');

  if (!navigationRef?.isReady()) {
    console.log('⚠️ Navigation not ready, deferring navigation');
    setTimeout(() => handleNotificationNavigation(data), 1000);
    return;
  }

  try {
    if (data?.type === 'zone-breach') {
      navigationRef.navigate('Geospatial');
    } else if (data?.type === 'assignment') {
      navigationRef.navigate('Assignment');
    } else if (data?.type === 'emergency') {
      navigationRef.navigate('Notifications');
    } else {
      navigationRef.navigate('Notifications');
    }
    console.log(`🧭 Navigated to screen based on notification type: ${data?.type}`);
  } catch (error) {
    console.error('❌ Error navigating from notification:', error);
  }
};

// Helper functions
const getChannelId = (type) => {
  switch (type) {
    case 'emergency':
      return 'emergency';
    case 'zone-breach':
    case 'zone_breach':
      return 'zone-breach';
    case 'assignment':
      return 'assignment';
    case 'system':
      return 'system';
    default:
      return 'default';
  }
};

const getNotificationPriority = (type) => {
  switch (type) {
    case 'emergency':
      return 'high';
    case 'zone-breach':
    case 'zone_breach':
      return 'high';
    case 'assignment':
      return 'default';
    default:
      return 'default';
  }
};

// Initialize Firebase notifications with comprehensive setup
const initializeFirebaseNotifications = async () => {
  try {
    console.log('🚀 Initializing Firebase notifications...');

    // Only proceed if a user is logged in
    const rawUser = await AsyncStorage.getItem('currentUser');
    if (!rawUser) {
      console.log('⚠️ Skip notifications init: no logged-in user');
      return () => { };
    }

    const user = JSON.parse(rawUser);
    console.log(`👤 Initializing notifications for user: ${user.username} (${user.id})`);

    // Register for push notifications
    const tokens = await registerForPushNotificationsAsync();
    if (tokens) {
      console.log('✅ Push notification tokens obtained:', {
        expoToken: tokens.expoToken ? '✓' : '✗',
        fcmToken: tokens.fcmToken ? '✓' : '✗'
      });
    } else {
      console.log('❌ Failed to obtain push notification tokens');
    }

    // Setup notification handlers
    const cleanup = setupNotificationHandlers();

    // Sync recent alerts to ensure visibility for existing rows
    await syncRecentAlerts();

    console.log('✅ Firebase notifications initialization completed');
    return cleanup;

  } catch (error) {
    console.error('❌ Error initializing Firebase notifications:', error);
    return () => { };
  }
};

// Sync recent alerts from server (only once per session)
const syncRecentAlerts = async () => {
  try {
    // Check if we've already synced this session
    const syncKey = 'alerts_synced_session';
    const alreadySynced = await AsyncStorage.getItem(syncKey);
    if (alreadySynced) {
      console.log('🔄 Alerts already synced this session, skipping...');
      return;
    }

    console.log('🔄 Syncing recent alerts...');
    const { apiService } = require('./services/api');
    const recent = await apiService.getAlerts({ limit: 5 });

    // Deduplicate by keeping a small seen set in storage
    const seenKey = 'recent_alert_ids';
    let seen = [];
    try {
      const raw = await AsyncStorage.getItem(seenKey);
      if (raw) seen = JSON.parse(raw);
    } catch { }

    const newOnes = Array.isArray(recent) ? recent.filter(a => !seen.includes(String(a.id))) : [];

    for (const alert of newOnes) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: alert.category || alert.title || 'Alert',
          body: alert.message || 'New alert',
          data: {
            type: (alert.category || alert.severity || 'alert'),
            alertId: String(alert.id || ''),
            source: 'history'
          },
          sound: 'default',
        },
        trigger: null,
      });
    }

    const merged = [...new Set([...(seen || []).map(String), ...newOnes.map(a => String(a.id))])].slice(-50);
    try {
      await AsyncStorage.setItem(seenKey, JSON.stringify(merged));
    } catch { }

    // Mark as synced for this session
    await AsyncStorage.setItem(syncKey, 'true');

    console.log(`✅ Synced ${newOnes.length} recent alerts`);
  } catch (e) {
    console.log('⚠️ Recent alerts sync skipped:', e.message);
  }
};

export {
  app,
  messaging,
  registerForPushNotificationsAsync,
  setupNotificationHandlers,
  showLocalNotification,
  addNotificationToStorage,
  initializeFirebaseNotifications
}; 