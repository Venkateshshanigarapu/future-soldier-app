/**
 * Test script to verify API URL fix for background location
 */

import { updateCachedUserData } from './services/backgroundLocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const testApiUrlFix = async () => {
  console.log('🧪 Testing API URL fix for background location...');
  
  try {
    // Test 1: Update cached user data (this should cache the API URL)
    console.log('📡 Updating cached user data...');
    await updateCachedUserData();
    
    // Test 2: Check if API URL is cached
    const cachedUrl = await AsyncStorage.getItem('cached_api_base_url');
    console.log('✅ Cached API URL:', cachedUrl);
    
    // Test 3: Check if user data is cached
    const userData = await AsyncStorage.getItem('currentUser');
    console.log('👤 User data cached:', !!userData);
    
    if (cachedUrl && userData) {
      console.log('🎉 API URL fix is working correctly!');
      return { success: true, cachedUrl, hasUserData: !!userData };
    } else {
      console.log('❌ API URL fix needs attention');
      return { success: false, cachedUrl, hasUserData: !!userData };
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
};

export const clearApiUrlCache = async () => {
  try {
    await AsyncStorage.removeItem('cached_api_base_url');
    console.log('🧹 API URL cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
    return false;
  }
};
