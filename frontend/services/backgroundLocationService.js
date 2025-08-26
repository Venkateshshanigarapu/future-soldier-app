import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getApiBaseUrl } from './api';
import { Platform } from 'react-native';
import i18n from '../utils/i18n';
import logger from '../utils/logger';

const LOCATION_TASK_NAME = 'background-location-task';

// Store the last known user data to avoid repeated AsyncStorage calls
let cachedUserData = null;

// Initialize cached user data
const initializeCachedUserData = async () => {
  try {
    const userData = await AsyncStorage.getItem('currentUser');
    if (userData) {
      cachedUserData = JSON.parse(userData);
    }
  } catch (error) {
    console.error('[BackgroundLocation] Failed to initialize cached user data:', error);
  }
};

// Update cached user data when user logs in/out
export const updateCachedUserData = async () => {
  await initializeCachedUserData();
};

// Check network connectivity
const isNetworkAvailable = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable;
  } catch (error) {
    console.error('[BackgroundLocation] Network check failed:', error);
    return false;
  }
};

// Send location update to backend
const sendLocationUpdate = async (userId, latitude, longitude, heading) => {
  try {
    const networkAvailable = await isNetworkAvailable();
    if (!networkAvailable) {
      console.log('[BackgroundLocation] Network not available, skipping location update');
      return;
    }

    const API_BASE_URL = getApiBaseUrl();
    const response = await fetch(`${API_BASE_URL}/users/${userId}/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, heading }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logger.debug('Location update sent successfully');
  } catch (error) {
    console.error('[BackgroundLocation] Failed to send location update:', error);
  }
};

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocation] Task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      try {
        // Use cached user data if available, otherwise fetch from storage
        let userData = cachedUserData;
        if (!userData) {
          await initializeCachedUserData();
          userData = cachedUserData;
        }

        if (userData && userData.id) {
          const { latitude, longitude, heading } = locations[0].coords;

          // Use throttled logging to reduce console spam
          logger.locationUpdate({
            userId: userData.id,
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            heading: heading?.toFixed(1) || 'N/A',
            timestamp: new Date().toISOString(),
          });

          await sendLocationUpdate(userData.id, latitude, longitude, heading);
        } else {
          // Only log this once per session to reduce spam
          const noUserLogged = await AsyncStorage.getItem('no_user_logged_warning');
          if (!noUserLogged) {
            logger.warn('No user data available for location tracking');
            await AsyncStorage.setItem('no_user_logged_warning', 'true');
          }
        }
      } catch (err) {
        console.error('[BackgroundLocation] Failed to process location update:', err);
      }
    }
  }
});

// Start background location tracking
export const startBackgroundLocation = async () => {
  try {
    console.log('[BackgroundLocation] Starting background location tracking...');

    // Request permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] Foreground location permission not granted');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] Background location permission not granted');
      return false;
    }

    // Check if task is already running
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isStarted) {
      console.log('[BackgroundLocation] Task already running');
      return true;
    }

    // Balanced config to reduce battery drain and logging frequency
    const locationConfig = {
      accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      timeInterval: 15000, // 15 seconds (increased from 5)
      distanceInterval: 10, // 10 meters (increased from 5)
      pausesUpdatesAutomatically: false, // iOS: keep updating when locked
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: i18n.t('locationTracking'),
        notificationBody: 'Your location is being tracked in the background.',
        notificationColor: '#4CAF50',
      },
      // Android specific
      deferredUpdatesDistance: 0,
      deferredUpdatesInterval: 0,
    };

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, locationConfig);

    console.log('[BackgroundLocation] Background location tracking started successfully');
    return true;
  } catch (error) {
    console.error('[BackgroundLocation] Failed to start background location tracking:', error);
    return false;
  }
};

// Stop background location tracking
export const stopBackgroundLocation = async () => {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('[BackgroundLocation] Background location tracking stopped');
    }
  } catch (error) {
    console.error('[BackgroundLocation] Failed to stop background location tracking:', error);
  }
};

// Check if background location is running
export const isBackgroundLocationRunning = async () => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (error) {
    console.error('[BackgroundLocation] Failed to check if running:', error);
    return false;
  }
};

// Initialize the service
initializeCachedUserData();
