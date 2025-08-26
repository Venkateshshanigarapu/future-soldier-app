import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendLocalNotification } from './sendTestNotification';
import { apiService } from './services/api';
import i18n from './utils/i18n';

// Create the notification context
const NotificationContext = createContext();

// Custom hook to use the notification context
export const useNotifications = () => useContext(NotificationContext);

// Add a flag to indicate if a database is linked
const isDatabaseLinked = true; // Set to true when backend is connected

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firebaseToken, setFirebaseToken] = useState(null);

  // Load notifications from database or clear if not linked
  useEffect(() => {
    if (isDatabaseLinked) {
    loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  // Load notifications function - made reusable
  const loadNotifications = useCallback(async () => {
    try {
      if (isDatabaseLinked) {
        // Load from backend API
        const notifications = await apiService.getNotifications();
        setNotifications(notifications);
        updateUnreadCount(notifications);
      } else {
        const storedNotifications = await AsyncStorage.getItem('notifications');
        if (storedNotifications) {
          const parsedNotifications = JSON.parse(storedNotifications);
          setNotifications(parsedNotifications);
          updateUnreadCount(parsedNotifications);
        }
        // Load Firebase token if available
        const token = await AsyncStorage.getItem('pushToken');
        if (token) {
          setFirebaseToken(token);
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  // Save notifications to AsyncStorage whenever they change
  useEffect(() => {
    if (isDatabaseLinked) {
    const saveNotifications = async () => {
      try {
        await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
        updateUnreadCount(notifications);
      } catch (error) {
        console.error('Failed to save notifications:', error);
      }
    };
    saveNotifications();
    } else {
      setUnreadCount(0);
    }
  }, [notifications]);

  // Update unread count
  const updateUnreadCount = (notificationsList) => {
    if (!isDatabaseLinked) {
      setUnreadCount(0);
      return;
    }
    const count = notificationsList.filter(notification => !notification.read).length;
    setUnreadCount(count);
  };

  // Add a new notification
  const addNotification = useCallback((notification) => {
    if (!isDatabaseLinked) return;
    // Check if notification already exists to prevent duplicates
    const isDuplicate = notifications.some(
      n => n.id === notification.id || 
          (n.title === notification.title && 
           n.message === notification.message && 
           Math.abs(new Date(n.timestamp) - new Date()) < 10000) // Within 10 seconds
    );
    
    if (isDuplicate) return;
    
    const newNotification = {
      id: notification.id || Date.now().toString(),
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false,
      ...notification,
    };
    
    setNotifications(prev => [newNotification, ...prev]);

    // Also trigger a local device notification
    sendLocalNotification(
      newNotification.title || i18n.t('newNotification'),
      newNotification.message || '',
      {
        type: newNotification.type,
        soldierId: newNotification.soldierId,
        ...newNotification
      }
    );
  }, [notifications]);

  // Add a Firebase notification
  const addFirebaseNotification = useCallback((message) => {
    if (!isDatabaseLinked) return;
    // Extract data from Firebase message
    const notification = {
      id: message.messageId || Date.now().toString(),
      title: message.notification?.title || i18n.t('newNotification'),
      message: message.notification?.body || '',
      type: message.data?.type || 'info',
      soldierId: message.data?.soldierId || null,
      timestamp: new Date().toISOString(),
      read: false,
      source: 'firebase'
    };
    
    addNotification(notification);
  }, [addNotification]);

  // Mark a notification as read
  const markAsRead = useCallback((id) => {
    if (!isDatabaseLinked) return;
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    if (!isDatabaseLinked) return;
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    if (!isDatabaseLinked) return;
    setNotifications([]);
  }, []);

  // Clear read notifications
  const clearRead = useCallback(() => {
    if (!isDatabaseLinked) return;
    setNotifications(prev => prev.filter(notification => !notification.read));
  }, []);

  // Mark filtered notifications as read
  const markFilteredAsRead = useCallback((filterType) => {
    if (!isDatabaseLinked) return;
    setNotifications(prev => 
      prev.map(notification => {
        if (filterType === 'all' || notification.type === filterType) {
          return { ...notification, read: true };
        }
        return notification;
      })
    );
  }, []);

  // Clear read notifications from specific filter
  const clearFilteredRead = useCallback((filterType) => {
    if (!isDatabaseLinked) return;
    setNotifications(prev => 
      prev.filter(notification => {
        // Keep unread notifications
        if (!notification.read) return true;
        // Remove read notifications that match the filter
        if (filterType === 'all') return false;
        return notification.type !== filterType;
      })
    );
  }, []);

  // Clear all notifications from specific filter
  const clearFilteredAll = useCallback((filterType) => {
    if (!isDatabaseLinked) return;
    setNotifications(prev => 
      prev.filter(notification => {
        if (filterType === 'all') return false;
        return notification.type !== filterType;
      })
    );
  }, []);

  // Update Firebase token
  const updateFirebaseToken = useCallback((token) => {
    setFirebaseToken(token);
    AsyncStorage.setItem('pushToken', token);
  }, []);

  // Force refresh notifications from storage
  const refreshNotifications = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        firebaseToken,
        addNotification,
        addFirebaseNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        clearRead,
        markFilteredAsRead,
        clearFilteredRead,
        clearFilteredAll,
        updateFirebaseToken,
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext; 