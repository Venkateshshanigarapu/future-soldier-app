import { Platform, Alert, Linking } from 'react-native';
import { requestPermissionsAsync, getPermissionsAsync } from 'expo-location';

/**
 * Check and request battery optimization permissions for Android
 * This is crucial for background location tracking to work when app is killed
 */
export const checkBatteryOptimization = async () => {
  if (Platform.OS !== 'android') {
    return true; // Not needed on iOS
  }

  try {
    // Check if we have background location permission
    const { status } = await getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await requestPermissionsAsync();
      if (newStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required for background tracking. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
    }

    // Show battery optimization alert for Android
    Alert.alert(
      'Battery Optimization',
      'For background location tracking to work when the app is closed, please disable battery optimization for this app in your device settings.',
      [
        { text: 'Skip', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => {
            // Open battery optimization settings
            Linking.openSettings();
          }
        }
      ]
    );

    return true;
  } catch (error) {
    console.error('[BatteryOptimization] Error checking permissions:', error);
    return false;
  }
};

/**
 * Check if background location is properly configured
 */
export const checkBackgroundLocationSetup = async () => {
  try {
    const { status } = await getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[BackgroundLocation] Error checking setup:', error);
    return false;
  }
};
