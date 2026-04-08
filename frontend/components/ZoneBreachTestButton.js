import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../utils/i18n';

export default function ZoneBreachTestButton() {
  const [testing, setTesting] = useState(false);

  const testZoneBreach = async () => {
    try {
      setTesting(true);
      
      // Get current user data
      const userData = await AsyncStorage.getItem('currentUser');
      if (!userData) {
        Alert.alert(i18n.t('error'), i18n.t('noUserLoggedIn'));
        setTesting(false);
        return;
      }

      const user = JSON.parse(userData);
      
      // Test with a location outside any zone (you can modify these coordinates)
      const testLocation = {
        user_id: user.id,
        latitude: 40.7128, // New York coordinates (modify as needed)
        longitude: -74.0060,
        heading: 0
      };

      console.log('[ZoneBreachTest] Testing zone breach with location:', testLocation);

      const response = await apiService.checkZoneBreach(testLocation);
      
      if (response.transitions > 0) {
        Alert.alert(
          i18n.t('zoneTransitionDetectedTitle'),
          i18n.t('zoneTransitionDetectedMessage', { count: response.transitions }),
          [{ text: i18n.t('ok') }]
        );
      } else {
        Alert.alert(
          i18n.t('noZoneTransitionsTitle'),
          i18n.t('noZoneTransitionsMessage'),
          [{ text: i18n.t('ok') }]
        );
      }
    } catch (error) {
      console.error('[ZoneBreachTest] Error:', error);
      Alert.alert(i18n.t('error'), error?.message || i18n.t('failedToTestZoneBreach'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, testing && styles.buttonDisabled]}
      onPress={testZoneBreach}
      disabled={testing}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        <Icon 
          name={testing ? "hourglass" : "location"} 
          size={16} 
          color="#FFFFFF" 
        />
        <Text style={styles.buttonText}>
          {testing ? i18n.t('testing') : i18n.t('testZoneBreach')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
