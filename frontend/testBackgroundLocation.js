/**
 * Test script for background location tracking
 * Run this to verify that background location tracking is working properly
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  startBackgroundLocation, 
  stopBackgroundLocation, 
  isBackgroundLocationRunning,
  retryFailedLocationUpdates 
} from './services/backgroundLocationService';

export const testBackgroundLocation = async () => {
  console.log('🧪 Starting background location tracking test...');
  
  try {
    // Test 1: Check if background location is running
    const isRunning = await isBackgroundLocationRunning();
    console.log('📍 Background location running:', isRunning);
    
    // Test 2: Start background location tracking
    console.log('🚀 Starting background location tracking...');
    const startResult = await startBackgroundLocation();
    console.log('✅ Start result:', startResult);
    
    // Test 3: Check if it's running after start
    const isRunningAfterStart = await isBackgroundLocationRunning();
    console.log('📍 Running after start:', isRunningAfterStart);
    
    // Test 4: Check for failed location updates
    console.log('🔄 Checking for failed location updates...');
    await retryFailedLocationUpdates();
    
    // Test 5: Check local storage for location history
    const locationHistory = await AsyncStorage.getItem('local_location_history');
    const historyCount = locationHistory ? JSON.parse(locationHistory).length : 0;
    console.log('📊 Local location history entries:', historyCount);
    
    // Test 6: Check for any errors
    const errorData = await AsyncStorage.getItem('background_location_error');
    if (errorData) {
      console.log('❌ Background location errors found:', JSON.parse(errorData));
    } else {
      console.log('✅ No background location errors found');
    }
    
    // Test 7: Check failed updates
    const failedUpdates = await AsyncStorage.getItem('failed_location_updates');
    const failedCount = failedUpdates ? JSON.parse(failedUpdates).length : 0;
    console.log('⚠️ Failed location updates:', failedCount);
    
    console.log('🎉 Background location test completed!');
    
    return {
      isRunning: isRunningAfterStart,
      startResult,
      historyCount,
      errorCount: errorData ? 1 : 0,
      failedCount
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { error: error.message };
  }
};

export const testLocationPermissions = async () => {
  console.log('🔐 Testing location permissions...');
  
  try {
    const { requestForegroundPermissionsAsync, requestBackgroundPermissionsAsync } = require('expo-location');
    
    const foregroundStatus = await requestForegroundPermissionsAsync();
    console.log('📍 Foreground permission:', foregroundStatus.status);
    
    const backgroundStatus = await requestBackgroundPermissionsAsync();
    console.log('📍 Background permission:', backgroundStatus.status);
    
    return {
      foreground: foregroundStatus.status,
      background: backgroundStatus.status
    };
  } catch (error) {
    console.error('❌ Permission test failed:', error);
    return { error: error.message };
  }
};

export const clearLocationData = async () => {
  console.log('🧹 Clearing location data...');
  
  try {
    await AsyncStorage.removeItem('local_location_history');
    await AsyncStorage.removeItem('failed_location_updates');
    await AsyncStorage.removeItem('background_location_error');
    await AsyncStorage.removeItem('no_user_logged_warning');
    
    console.log('✅ Location data cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear location data:', error);
    return false;
  }
};
