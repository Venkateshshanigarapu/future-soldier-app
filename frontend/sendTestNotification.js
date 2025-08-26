import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './utils/i18n';

// Function to send a local test notification
export const sendLocalNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || i18n.t('testNotification'),
        body: body || 'This is a test notification',
        data: {
          type: data.type || 'info',
          soldierId: data.soldierId || null,
          ...data
        },
      },
      trigger: { seconds: 1 },
    });
    
    console.log('Local notification scheduled');
    return true;
  } catch (error) {
    console.error('Error sending local notification:', error);
    return false;
  }
};

// Function to simulate a Firebase notification
export const simulateFirebaseNotification = async (title, body, data = {}) => {
  try {
    // Create notification object
    const notification = {
      id: `firebase-sim-${Date.now()}`,
      title: title || i18n.t('testNotification'),
      message: body || 'This is a simulated Firebase notification',
      type: data.type || 'info',
      soldierId: data.soldierId || null,
      timestamp: new Date().toISOString(),
      read: false,
      source: 'firebase-simulated'
    };
    
    // Add to AsyncStorage
    const storedNotifications = await AsyncStorage.getItem('notifications');
    let notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
    notifications = [notification, ...notifications];
    await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
    
    console.log('Simulated Firebase notification added');
    return true;
  } catch (error) {
    console.error('Error simulating Firebase notification:', error);
    return false;
  }
};

// Function to send an emergency alert
export const sendEmergencyAlert = async (message, location = null) => {
  return sendLocalNotification(
    '🚨 EMERGENCY ALERT',
    message || 'Emergency situation reported',
    { 
      type: 'emergency',
      location,
      timestamp: new Date().toISOString()
    }
  );
};

// Function to send a warning notification
export const sendWarningNotification = async (message, data = {}) => {
  return sendLocalNotification(
    '⚠️ Warning',
    message || 'Warning notification',
    { 
      type: 'warning',
      ...data
    }
  );
};

// Function to send an info notification
export const sendInfoNotification = async (message, data = {}) => {
  return sendLocalNotification(
    'ℹ️ Information',
    message || 'Information notification',
    { 
      type: 'info',
      ...data
    }
  );
};

// Function to send a zone breach notification
export const sendZoneBreachNotification = async (soldierId, zoneName) => {
  return sendLocalNotification(
    '🚫 Zone Breach Alert',
    `Soldier ${soldierId} has breached restricted zone: ${zoneName}`,
    { 
      type: 'zone_breach',
      soldierId,
      zoneName
    }
  );
};

// Function to send an offline status notification
export const sendOfflineStatusNotification = async (soldierId, lastSeen) => {
  return sendLocalNotification(
    '📵 Soldier Offline',
    `Soldier ${soldierId} has gone offline. Last seen: ${lastSeen}`,
    { 
      type: 'offline',
      soldierId,
      lastSeen
    }
  );
};

// Function to check if notifications are working properly
export const checkNotificationStatus = async () => {
  try {
    // Check if notifications are enabled on the device
    const { status } = await Notifications.getPermissionsAsync();
    
    // Check if we have any stored notifications
    const storedNotifications = await AsyncStorage.getItem('notifications');
    const hasStoredNotifications = storedNotifications && JSON.parse(storedNotifications).length > 0;
    
    // Check if we have a push token
    const pushToken = await AsyncStorage.getItem('pushToken');
    
    return {
      permissionsGranted: status === 'granted',
      hasStoredNotifications,
      hasPushToken: !!pushToken,
      status
    };
  } catch (error) {
    console.error('Error checking notification status:', error);
    return {
      permissionsGranted: false,
      hasStoredNotifications: false,
      hasPushToken: false,
      error: error.message
    };
  }
};

export default {
  sendLocalNotification,
  simulateFirebaseNotification,
  sendEmergencyAlert,
  sendWarningNotification,
  sendInfoNotification,
  sendZoneBreachNotification,
  sendOfflineStatusNotification,
  checkNotificationStatus
}; 