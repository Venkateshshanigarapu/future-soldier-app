import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { sendLocalNotification } from './sendTestNotification';
import { apiService } from './services/api';
import i18n from './utils/i18n';

// Create the notification context
export const NotificationContext = createContext();

// Custom hook to use the notification context
export const useNotifications = () => useContext(NotificationContext);

// Add a flag to indicate if a database is linked
const isDatabaseLinked = true; // Set to true when backend is connected

// Sound mappings - defaulting to expected paths. 
// Note: These require the actual files to exist in assets/sounds/
const ALERT_SOUNDS = {
  zone_breach: require('./assets/sounds/alarm-301729.mp3'),
  medical: require('./assets/sounds/med.mp3'),
  default: require('./assets/sounds/die.mp3')
};

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firebaseToken, setFirebaseToken] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Ref to keep track of the current sound instance to stop it later
  const currentSound = useRef(null);
  const currentSoundType = useRef(null);

  // Sound Queue System
  const soundQueue = useRef([]);
  const isPlaying = useRef(false);
  const lastSoundFinishedAt = useRef(0);
  const soundTimeout = useRef(null);
  const MAX_PLAY_DURATION_MS = 10000;
  const WAIT_BETWEEN_SOUNDS_MS = 0;
  const rotationTypesRef = useRef([]);
  const rotationIndexRef = useRef(0);
  const zoneActiveRef = useRef(false);
  const medicalActiveRef = useRef(false);
  const dieActiveRef = useRef(false);

  // Load notifications from database or clear if not linked
  useEffect(() => {
    if (isDatabaseLinked) {
      loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  // Load sound preference
  useEffect(() => {
    const loadSoundPreference = async () => {
      try {
        const enabled = await AsyncStorage.getItem('soundEnabled');
        if (enabled !== null) {
          setSoundEnabled(JSON.parse(enabled));
        }
      } catch (e) {
        console.log('Failed to load sound preference');
      }
    };
    loadSoundPreference();
  }, []);

  // Configure Audio on mount
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
      } catch (e) {
        console.log('Error configuring audio:', e);
      }
    };
    configureAudio();

    return () => {
      // Cleanup sound on unmount via helper
      stopAlertSound();
    };
  }, []);

  // Toggle sound setting
  const toggleSound = useCallback(async () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    if (!newState) {
      stopAlertSound();
    }
    await AsyncStorage.setItem('soundEnabled', JSON.stringify(newState));
  }, [soundEnabled]);

  // Stop currently playing sound
  const stopAlertSound = async () => {
    // Clear queue on stop (user intervention or safety return)
    soundQueue.current = [];

    if (soundTimeout.current) {
      clearTimeout(soundTimeout.current);
      soundTimeout.current = null;
    }

    if (currentSound.current) {
      console.log('[Sound] Stopping active alert sound');
      try {
        await currentSound.current.stopAsync();
        await currentSound.current.unloadAsync();
      } catch (e) {
        console.log('Error stopping sound:', e);
      }
      currentSound.current = null;
      currentSoundType.current = null;
    }

    // Mark finished now so cooldown starts
    isPlaying.current = false;
    lastSoundFinishedAt.current = Date.now();
    zoneActiveRef.current = false;
    medicalActiveRef.current = false;
    dieActiveRef.current = false;
  };

  // Process the next sound in the queue
  const processQueue = useCallback(async () => {
    if (isPlaying.current) return;
    const now = Date.now();
    const timeSinceLast = now - lastSoundFinishedAt.current;
    if (WAIT_BETWEEN_SOUNDS_MS > 0 && timeSinceLast < WAIT_BETWEEN_SOUNDS_MS) {
      const waitTime = WAIT_BETWEEN_SOUNDS_MS - timeSinceLast;
      if (soundTimeout.current) clearTimeout(soundTimeout.current);
      soundTimeout.current = setTimeout(() => {
        soundTimeout.current = null;
        processQueue();
      }, waitTime);
      return;
    }

    if (soundQueue.current.length === 0) return;

    const nextSoundType = soundQueue.current.shift();
    await playSoundNow(nextSoundType);
  }, []);

  // Internal function to play sound immediately
  const playSoundNow = async (type) => {
    if (!soundEnabled) return;

    isPlaying.current = true;

    // Determine sound file
    let soundFile;
    if (['zone_breach', 'zone_warning', 'exit', 'unauthorized_entry'].includes(type) || (type && type.includes('zone'))) {
      soundFile = ALERT_SOUNDS.zone_breach;
    } else if (['emergency', 'critical', 'medical'].includes(type) || type === 'medical') {
      soundFile = ALERT_SOUNDS.medical;
    } else {
      soundFile = ALERT_SOUNDS.default; // die.mp3
    }

    try {
      console.log(`[Sound] Playing sound for type: ${type}`);
      const { sound } = await Audio.Sound.createAsync(
        soundFile,
        { isLooping: true, shouldPlay: true }
      );
      currentSound.current = sound;
      currentSoundType.current = type;
      if (soundTimeout.current) {
        clearTimeout(soundTimeout.current);
        soundTimeout.current = null;
      }
      soundTimeout.current = setTimeout(async () => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (e) { }
        currentSound.current = null;
        currentSoundType.current = null;
        isPlaying.current = false;
        lastSoundFinishedAt.current = Date.now();
        soundTimeout.current = null;

        // Build the list of satisfied conditions in stable order
        const isZoneType = type === 'zone_breach' || type === 'zone_return' || (type && String(type).includes('zone'));
        let zoneSatisfied = zoneActiveRef.current || isZoneType;

        let bpSatisfiedMedical = false;
        let bpSatisfiedDefault = false;
        try {
          let uid = null;
          try {
            const userData = await AsyncStorage.getItem('currentUser');
            uid = userData ? JSON.parse(userData).id : null;
          } catch {}
          if (uid) {
            try {
              const vitals = await apiService.getHealthVitals(uid);
              let systolic = null;
              const bpStr = vitals?.bp || vitals?.blood_pressure || vitals?.bloodPressure;
              if (bpStr) {
                const parts = String(bpStr).split('/');
                if (parts.length >= 1) {
                  const s = parseInt(parts[0], 10);
                  if (!isNaN(s)) systolic = s;
                }
              }
              if (systolic == null && typeof vitals?.systolic === 'number') systolic = vitals.systolic;
              if (systolic === 0) {
                bpSatisfiedDefault = true;
              } else if (systolic != null && systolic < 80) {
                bpSatisfiedMedical = true;
              }

              // Emit notifications for medical/die conditions once per state transition
              try {
                if (systolic === 0) {
                  if (!dieActiveRef.current) {
                    dieActiveRef.current = true;
                    addNotification({
                      title: i18n.t('dieAlert') || 'Critical Vitals',
                      message: i18n.t('dieMessage') || 'No pulse or blood pressure detected. Immediate attention required.',
                      type: 'die_event',
                      priority: 'urgent',
                      source: 'vitals_monitor',
                      userId: uid,
                      data: { systolic }
                    });
                  }
                } else {
                  dieActiveRef.current = false;
                }

                if (systolic != null && systolic < 80 && systolic !== 0) {
                  if (!medicalActiveRef.current) {
                    medicalActiveRef.current = true;
                    addNotification({
                      title: i18n.t('medicalAlert') || 'Medical Alert',
                      message: i18n.t('medicalMessage') || 'Critical low blood pressure detected.',
                      type: 'medical',
                      priority: 'urgent',
                      source: 'vitals_monitor',
                      userId: uid,
                      data: { systolic }
                    });
                  }
                } else {
                  medicalActiveRef.current = false;
                }
              } catch {}
            } catch {}
          }
        } catch {}

        const typesArr = [];
        if (zoneSatisfied) typesArr.push('zone_breach');
        if (bpSatisfiedMedical) typesArr.push('medical');
        if (bpSatisfiedDefault) typesArr.push('die_event');

        if (typesArr.length === 0) {
          // Nothing satisfied, stop looping
          rotationTypesRef.current = [];
          rotationIndexRef.current = 0;
          return;
        }

        const prev = rotationTypesRef.current || [];
        const changed = prev.length !== typesArr.length || prev.some((v, i) => v !== typesArr[i]);
        if (changed) {
          rotationTypesRef.current = typesArr;
          rotationIndexRef.current = 0;
        } else {
          rotationIndexRef.current = (rotationIndexRef.current + 1) % rotationTypesRef.current.length;
        }
        const nextType = rotationTypesRef.current[rotationIndexRef.current];
        soundQueue.current = [nextType];
        processQueue();
      }, MAX_PLAY_DURATION_MS);
    } catch (e) {
      console.log('Error playing alert sound (file might be missing):', e);
      isPlaying.current = false;
      lastSoundFinishedAt.current = Date.now();
      // Try next if this failed
      processQueue();
    }
  };

  // Play alert sound based on type
  const playAlertSound = async (type) => {
    if (!soundEnabled) return;

    // Prevent duplicated concurrent requests for same sound
    if (isPlaying.current && currentSoundType.current === type) {
      return;
    }

    console.log(`[Sound] Queueing sound request: ${type}`);
    const isZoneType = (['zone_breach', 'zone_warning', 'exit', 'unauthorized_entry'].includes(type) || (type && String(type).includes('zone')));
    if (isZoneType) {
      soundQueue.current.unshift(type);
      zoneActiveRef.current = true;
    } else {
      soundQueue.current.push(type);
    }

    processQueue();
  };

  // Load notifications function - made reusable
  const loadNotifications = useCallback(async () => {
    try {
      if (isDatabaseLinked) {
        // Get current user ID
        const userData = await AsyncStorage.getItem('currentUser');
        const user = userData ? JSON.parse(userData) : null;

        // Load from backend API
        const notifications = await apiService.getNotifications(user?.id);
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
  const addNotification = useCallback(async (notification) => {
    if (!isDatabaseLinked) return;

    // Check if notification already exists to prevent duplicates in local state
    const isDuplicate = notifications.some(
      n => String(n.id) === String(notification.id) ||
        (n.title === notification.title &&
          n.message === notification.message &&
          Math.abs(new Date(n.timestamp) - new Date()) < 10000) // Within 10 seconds
    );

    if (isDuplicate) return;

    try {
      // Trigger sound if high priority or specific type
      let soundType = notification.type;

      // Check for specific BP conditions if data exists
      try {
        const isZoneType = (notification.type === 'zone_breach' || notification.type === 'zone_return' || (notification.type && String(notification.type).includes('zone')));
        if (notification.data && !isZoneType) {
          // Normalize keys (handle bp, blood_pressure, bloodPressure, etc)
          const data = notification.data || {};
          const bpString = data.bp || data.blood_pressure || data.bloodPressure;

          if (bpString) {
            // Parse BP string "120/80"
            const parts = String(bpString).split('/');
            if (parts.length >= 1) {
              const systolic = parseInt(parts[0], 10);

              if (!isNaN(systolic)) {
                if (systolic === 0) {
                  // "Die person bp is 0" -> Default sound (die.mp3)
                  // Overwrite type for sound selection purposes, though we keep original type for display
                  soundType = 'die_event'; // Will map to default/die.mp3
                } else if (systolic < 80) {
                  // "Below average" -> Medical sound
                  soundType = 'medical';
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('Error parsing BP for sound logic:', e);
      }

      const shouldPlaySound =
        notification.type === 'zone_breach' ||
        notification.type === 'emergency' ||
        notification.type === 'critical' ||
        notification.priority === 'urgent' ||
        notification.priority === 'high' ||
        soundType === 'medical' ||
        soundType === 'die_event';

      if (shouldPlaySound) {
        playAlertSound(soundType || notification.type);
      }

      // Get current user ID if not provided in the notification object
      let userId = notification.userId || notification.user_id;
      if (!userId) {
        const userData = await AsyncStorage.getItem('currentUser');
        userId = userData ? JSON.parse(userData).id : null;
      }

      const newNotification = {
        id: notification.id || Date.now().toString(),
        timestamp: notification.timestamp || new Date().toISOString(),
        read: false,
        ...notification,
        userId: userId
      };

      // Add to local state immediately for responsiveness
      setNotifications(prev => [newNotification, ...prev]);

      // Persist to backend if we have a userId
      if (userId) {
        try {
          const saved = await apiService.createNotification({
            userId: userId,
            title: newNotification.title,
            message: newNotification.message,
            type: newNotification.type || 'info',
            category: newNotification.category || 'system',
            priority: newNotification.priority || 'normal',
            source: newNotification.source || 'app',
            data: newNotification.data || {},
            sendPush: false // We are already in the app, usually don't need a push for local alerts
          });

          // Update the localized ID with the server-generated one if available
          if (saved && saved.id) {
            setNotifications(prev =>
              prev.map(n => String(n.id) === String(newNotification.id) ? { ...n, id: String(saved.id) } : n)
            );
          }
        } catch (saveError) {
          console.warn('Failed to persist notification to server:', saveError);
        }
      }

      // Also trigger a local device notification (de-duplicated in sender)
      sendLocalNotification(
        newNotification.title || i18n.t('newNotification'),
        newNotification.message || '',
        {
          type: newNotification.type,
          soldierId: newNotification.soldierId,
          ...newNotification
        }
      );
    } catch (err) {
      console.error('Error in addNotification:', err);
    }
  }, [notifications, soundEnabled]); // Added soundEnabled dependency

  useEffect(() => {
    let interval = null;
    const checkVitals = async () => {
      try {
        const raw = await AsyncStorage.getItem('currentUser');
        const uid = raw ? JSON.parse(raw).id : null;
        if (!uid) return;
        const vitals = await apiService.getHealthVitals(uid);
        let systolic = null;
        const bpStr = vitals?.bp || vitals?.blood_pressure || vitals?.bloodPressure;
        if (bpStr) {
          const parts = String(bpStr).split('/');
          if (parts.length >= 1) {
            const s = parseInt(parts[0], 10);
            if (!isNaN(s)) systolic = s;
          }
        }
        if (systolic == null && typeof vitals?.systolic === 'number') systolic = vitals.systolic;
        if (systolic === 0) {
          if (!dieActiveRef.current) {
            dieActiveRef.current = true;
            addNotification({
              title: i18n.t('dieAlert') || 'Critical Vitals',
              message: i18n.t('dieMessage') || 'No pulse or blood pressure detected. Immediate attention required.',
              type: 'die_event',
              priority: 'urgent',
              source: 'vitals_monitor',
              userId: uid,
              data: { systolic }
            });
          }
        } else {
          dieActiveRef.current = false;
        }
        if (systolic != null && systolic < 80 && systolic !== 0) {
          if (!medicalActiveRef.current) {
            medicalActiveRef.current = true;
            addNotification({
              title: i18n.t('medicalAlert') || 'Medical Alert',
              message: i18n.t('medicalMessage') || 'Critical low blood pressure detected.',
              type: 'medical',
              priority: 'urgent',
              source: 'vitals_monitor',
              userId: uid,
              data: { systolic }
            });
          }
        } else {
          medicalActiveRef.current = false;
        }
      } catch {}
    };
    checkVitals();
    interval = setInterval(checkVitals, 15000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [addNotification]);

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
  const markAsRead = useCallback(async (id) => {
    if (!isDatabaseLinked) return;

    // Stop sound when marking as read (user interaction)
    stopAlertSound();

    try {
      // Get current user ID
      const userData = await AsyncStorage.getItem('currentUser');
      const userId = userData ? JSON.parse(userData).id : null;

      if (userId) {
        // Call backend API to mark as read
        await apiService.markNotificationAsRead(id, userId);
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          String(notification.id) === String(id)
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Still update local state even if backend call fails
      setNotifications(prev =>
        prev.map(notification =>
          String(notification.id) === String(id)
            ? { ...notification, read: true }
            : notification
        )
      );
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    if (!isDatabaseLinked) return;

    // Stop sound
    stopAlertSound();

    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!isDatabaseLinked) return;

    // Stop sound
    stopAlertSound();

    // Delete all alerts from database (notifications are stored in alerts table)
    const alertIds = notifications.map(n => n.id).filter(Boolean);

    if (alertIds.length > 0) {
      console.log(`[NotificationContext] Clearing ${alertIds.length} linked alerts`);
      for (const alertId of alertIds) {
        try {
          await apiService.deleteAlert(alertId);
        } catch (err) {
          console.warn(`Failed to delete alert ${alertId}:`, err);
        }
      }
    }

    setNotifications([]);
  }, [notifications]);

  // Clear read notifications
  const clearRead = useCallback(async () => {
    if (!isDatabaseLinked) return;

    stopAlertSound();

    // Delete read alerts from database (notifications are stored in alerts table)
    const readNotifications = notifications.filter(n => n.read);
    const alertIds = readNotifications.map(n => n.id).filter(Boolean);

    if (alertIds.length > 0) {
      console.log(`[NotificationContext] Clearing ${alertIds.length} read alerts`);
      for (const alertId of alertIds) {
        try {
          await apiService.deleteAlert(alertId);
        } catch (err) {
          console.warn(`Failed to delete alert ${alertId}:`, err);
        }
      }
    }

    setNotifications(prev => prev.filter(notification => !notification.read));
  }, [notifications]);

  // Delete an individual notification
  const deleteNotification = useCallback(async (id) => {
    if (!isDatabaseLinked) return;

    // Stop sound if we are deleting the active alert
    stopAlertSound();

    try {
      // Find the notification to get the alert ID
      const target = notifications.find(n => String(n.id) === String(id));

      // Update local state immediately for responsiveness
      setNotifications(prev => prev.filter(notification => String(notification.id) !== String(id)));

      // Delete from alerts table (notifications are stored there)
      if (target) {
        console.log(`[NotificationContext] Deleting alert: ${id}`);
        await apiService.deleteAlert(id);
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [notifications]);

  // Mark filtered notifications as read
  const markFilteredAsRead = useCallback((filterType) => {
    if (!isDatabaseLinked) return;

    stopAlertSound();

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
  const clearFilteredRead = useCallback(async (filterType) => {
    if (!isDatabaseLinked) return;

    stopAlertSound();

    // Find notifications to delete
    const toDelete = notifications.filter(notification => {
      if (!notification.read) return false;
      if (filterType === 'all') return true;
      return notification.type === filterType;
    });

    // Delete alerts from database (notifications are stored in alerts table)
    const alertIds = toDelete.map(n => n.id).filter(Boolean);

    if (alertIds.length > 0) {
      console.log(`[NotificationContext] Clearing ${alertIds.length} filtered read alerts`);
      for (const alertId of alertIds) {
        try {
          await apiService.deleteAlert(alertId);
        } catch (err) {
          console.warn(`Failed to delete alert ${alertId}:`, err);
        }
      }
    }

    setNotifications(prev =>
      prev.filter(notification => {
        // Keep unread notifications
        if (!notification.read) return true;
        // Remove read notifications that match the filter
        if (filterType === 'all') return false;
        return notification.type !== filterType;
      })
    );
  }, [notifications]);

  // Clear all notifications from specific filter
  const clearFilteredAll = useCallback(async (filterType) => {
    if (!isDatabaseLinked) return;

    stopAlertSound();

    // Find notifications to delete
    const toDelete = notifications.filter(notification => {
      if (filterType === 'all') return true;
      return notification.type === filterType;
    });

    // Delete alerts from database (notifications are stored in alerts table)
    const alertIds = toDelete.map(n => n.id).filter(Boolean);

    if (alertIds.length > 0) {
      console.log(`[NotificationContext] Clearing ${alertIds.length} filtered alerts`);
      for (const alertId of alertIds) {
        try {
          await apiService.deleteAlert(alertId);
        } catch (err) {
          console.warn(`Failed to delete alert ${alertId}:`, err);
        }
      }
    }

    setNotifications(prev =>
      prev.filter(notification => {
        if (filterType === 'all') return false;
        return notification.type !== filterType;
      })
    );
  }, [notifications]);

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
        soundEnabled,
        toggleSound,
        addNotification,
        addFirebaseNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        clearRead,
        deleteNotification,
        markFilteredAsRead,
        clearFilteredRead,
        clearFilteredAll,
        updateFirebaseToken,
        refreshNotifications,
        stopAlertSound
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext; 