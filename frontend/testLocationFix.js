// Test script to verify background location fix
import { AppState } from 'react-native';
import { startBackgroundLocation, isBackgroundLocationRunning, queueLocationStart } from './services/backgroundLocationService';

export const testLocationFix = async () => {
  console.log('=== Testing Background Location Fix ===');
  
  // Test 1: Check current app state
  console.log('Current app state:', AppState.currentState);
  
  // Test 2: Check if location is already running
  const isRunning = await isBackgroundLocationRunning();
  console.log('Location tracking running:', isRunning);
  
  // Test 3: Try to start location tracking
  console.log('Attempting to start location tracking...');
  const success = await startBackgroundLocation();
  console.log('Start result:', success);
  
  // Test 4: If failed, test queueing mechanism
  if (!success) {
    console.log('Location start failed, testing queue mechanism...');
    queueLocationStart();
    console.log('Location start queued for when app becomes active');
  }
  
  // Test 5: Check final status
  const finalStatus = await isBackgroundLocationRunning();
  console.log('Final location status:', finalStatus);
  
  console.log('=== Test Complete ===');
  return {
    appState: AppState.currentState,
    initialRunning: isRunning,
    startSuccess: success,
    finalRunning: finalStatus
  };
};

// Test app state changes
export const testAppStateChanges = () => {
  console.log('=== Testing App State Changes ===');
  
  const handleAppStateChange = (nextAppState) => {
    console.log('App state changed to:', nextAppState);
  };
  
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Return cleanup function
  return () => {
    subscription.remove();
  };
};

export default testLocationFix;
