import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { apiService } from '../services/api';

/**
 * Custom hook to sync user location with backend every 10 seconds.
 * @param {string} userId - The user's ID.
 * @param {function} [setMapPosition] - Optional callback to update map marker.
 */
export function useLocationSync(userId, setMapPosition) {
  const lastLocationRef = useRef(null);
  const intervalRef = useRef(null);

  // Request location permission
  const requestLocationPermission = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === 'granted';
  };

  useEffect(() => {
    if (!userId) return; // Prevent running if userId is not set
    let isMounted = true;

    const fetchAndSyncLocation = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      let loc;
      try {
        loc = await ExpoLocation.getCurrentPositionAsync({});
      } catch (error) {
        console.error('[LocationSync] Could not get location:', error);
        Alert.alert('Location Error', 'Could not get your current location. Make sure location services are enabled.');
        return;
      }

      if (!loc || !loc.coords) {
        console.error('[LocationSync] Location object is null or missing coords.');
        Alert.alert('Location Error', 'Location unavailable. Try again later.');
        return;
      }

      const { latitude, longitude, heading } = loc.coords;
      const safeHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;
      const last = lastLocationRef.current;

      // Always update current location in users table using apiService
      try {
        await apiService.updateUserLocation(userId, latitude, longitude, safeHeading);
      } catch (err) {
        console.error('[LocationSync] Failed to update user location:', err);
        Alert.alert('Network Error', 'Could not update your location. Check your network connection.');
      }

      // Only move last location to locations table if location changed
      if (!last || last.latitude !== latitude || last.longitude !== longitude) {
        if (last) {
          // TODO: Implement move-location logic in apiService if needed
          // Example:
          // await apiService.moveLastLocation(userId, last.latitude, last.longitude, last.timestamp);
        }

        // Update marker on map if callback provided
        if (setMapPosition) {
          setMapPosition({ latitude, longitude });
        }

        // Save current as last location for next check
        lastLocationRef.current = {
          latitude,
          longitude,
          timestamp: Date.now(),
        };
      }
    };

    // Start polling
    intervalRef.current = setInterval(fetchAndSyncLocation, 10000);
    // Run immediately on mount
    fetchAndSyncLocation();

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, setMapPosition]);
} 