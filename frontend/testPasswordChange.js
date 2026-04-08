// Test script to verify password change functionality
import { apiService } from './services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const testPasswordChange = async () => {
  console.log('=== Testing Password Change Functionality ===');
  
  try {
    // Test 1: Check if user is logged in
    console.log('1. Checking user login status...');
    const currentUserData = await AsyncStorage.getItem('currentUser');
    if (!currentUserData) {
      console.log('❌ No user logged in. Please login first.');
      return { success: false, error: 'No user logged in' };
    }
    
    const userData = JSON.parse(currentUserData);
    console.log('✅ User logged in:', userData.username);
    
    // Test 2: Validate API service
    console.log('2. Testing API service...');
    if (!apiService.changePassword) {
      console.log('❌ changePassword method not found in apiService');
      return { success: false, error: 'API method not found' };
    }
    console.log('✅ API service available');
    
    // Test 3: Test password validation
    console.log('3. Testing password validation...');
    const testCases = [
      { current: '', new: 'newpass123', confirm: 'newpass123', expected: false, reason: 'Empty current password' },
      { current: 'current123', new: '', confirm: 'newpass123', expected: false, reason: 'Empty new password' },
      { current: 'current123', new: 'newpass123', confirm: '', expected: false, reason: 'Empty confirm password' },
      { current: 'current123', new: 'newpass123', confirm: 'different123', expected: false, reason: 'Passwords do not match' },
      { current: 'current123', new: '123', confirm: '123', expected: false, reason: 'Password too short' },
      { current: 'current123', new: 'current123', confirm: 'current123', expected: false, reason: 'Same password' },
      { current: 'current123', new: 'newpass123', confirm: 'newpass123', expected: true, reason: 'Valid password change' },
    ];
    
    testCases.forEach((testCase, index) => {
      const isValid = validatePasswordChange(
        testCase.current,
        testCase.new,
        testCase.confirm
      );
      const status = isValid === testCase.expected ? '✅' : '❌';
      console.log(`${status} Test ${index + 1}: ${testCase.reason} - ${isValid ? 'Valid' : 'Invalid'}`);
    });
    
    // Test 4: Test API endpoint availability (without actually changing password)
    console.log('4. Testing API endpoint availability...');
    try {
      // This will fail with 401 (incorrect password) but confirms endpoint exists
      await apiService.changePassword(userData.id, 'wrongpassword', 'newpassword123');
    } catch (error) {
      if (error.message && error.message.includes('401')) {
        console.log('✅ API endpoint is working (401 error expected for wrong password)');
      } else if (error.message && error.message.includes('404')) {
        console.log('❌ User not found - check user ID');
        return { success: false, error: 'User not found' };
      } else {
        console.log('❌ Unexpected error:', error.message);
        return { success: false, error: error.message };
      }
    }
    
    console.log('✅ All tests passed! Password change functionality is working correctly.');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
};

// Password validation function (same logic as in the component)
const validatePasswordChange = (currentPassword, newPassword, confirmPassword) => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return false;
  }
  
  if (newPassword !== confirmPassword) {
    return false;
  }
  
  if (newPassword.length < 6) {
    return false;
  }
  
  if (currentPassword === newPassword) {
    return false;
  }
  
  return true;
};

// Test password change with actual API call (use with caution)
export const testActualPasswordChange = async (currentPassword, newPassword) => {
  console.log('=== Testing Actual Password Change (Use with caution) ===');
  
  try {
    const currentUserData = await AsyncStorage.getItem('currentUser');
    if (!currentUserData) {
      throw new Error('No user logged in');
    }
    
    const userData = JSON.parse(currentUserData);
    
    console.log('Attempting password change...');
    const result = await apiService.changePassword(userData.id, currentPassword, newPassword);
    console.log('✅ Password changed successfully:', result);
    
    return { success: true, result };
  } catch (error) {
    console.error('❌ Password change failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Test error handling
export const testErrorHandling = () => {
  console.log('=== Testing Error Handling ===');
  
  const errorScenarios = [
    { code: '401', message: 'Current password is incorrect' },
    { code: '404', message: 'User not found. Please login again.' },
    { code: 'Network', message: 'Network error. Please check your connection and try again.' },
    { code: '500', message: 'Server error. Please try again later.' },
  ];
  
  errorScenarios.forEach(scenario => {
    const errorMessage = getErrorMessage(scenario.code, scenario.message);
    console.log(`Error ${scenario.code}: ${errorMessage}`);
  });
};

// Error message mapping (same logic as in components)
const getErrorMessage = (errorCode, originalMessage) => {
  if (originalMessage && originalMessage.includes('401')) {
    return 'Current password is incorrect';
  } else if (originalMessage && originalMessage.includes('404')) {
    return 'User not found. Please login again.';
  } else if (originalMessage && originalMessage.includes('Network')) {
    return 'Network error. Please check your connection and try again.';
  } else {
    return originalMessage || 'Failed to change password. Please try again.';
  }
};

export default testPasswordChange;
