import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function PasswordChangeModal({ visible, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  const t = useCallback((key, fallback, options) => {
    const value = i18n.t(key, options);
    if (typeof value === 'string' && value !== key) return value;
    return fallback ?? key;
  }, [currentLanguage]);

  const handlePasswordChange = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(
        t('passwordModal.alerts.errorTitle', 'Error'),
        t('passwordModal.messages.fillAllFields', 'Please fill in all fields')
      );
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('passwordModal.alerts.errorTitle', 'Error'),
        t('passwordModal.messages.mismatch', 'New passwords do not match')
      );
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert(
        t('passwordModal.alerts.errorTitle', 'Error'),
        t('passwordModal.messages.minLength', 'New password must be at least 6 characters')
      );
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        t('passwordModal.alerts.errorTitle', 'Error'),
        t('passwordModal.messages.sameAsCurrent', 'New password must be different from current password')
      );
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get current user data
      const currentUserData = await AsyncStorage.getItem('currentUser');
      if (!currentUserData) {
        Alert.alert(
          t('passwordModal.alerts.errorTitle', 'Error'),
          t('passwordModal.messages.userNotFound', 'User not found. Please login again.')
        );
        return;
      }
      
      const userData = JSON.parse(currentUserData);
      if (!userData.id) {
        Alert.alert(
          t('passwordModal.alerts.errorTitle', 'Error'),
          t('passwordModal.messages.invalidUser', 'Invalid user data. Please login again.')
        );
        return;
      }
      
      // Show loading indicator
      Alert.alert(
        t('passwordModal.alerts.changingTitle', 'Changing Password'),
        t('passwordModal.messages.changing', 'Please wait while your password is being updated...'),
        [],
        { cancelable: false }
      );
      
      // Make API call to change password
      await apiService.changePassword(userData.id, currentPassword, newPassword);
      
      // Success - reset form and close modal
      Alert.alert(
        t('passwordModal.alerts.successTitle', 'Success'),
        t('passwordModal.messages.success', 'Password changed successfully')
      );
      resetForm();
      onClose();
      
    } catch (error) {
      console.error('Error changing password:', error);
      
      // Handle specific error types
      if (error.message && error.message.includes('401')) {
        Alert.alert(
          t('passwordModal.alerts.errorTitle', 'Error'),
          t('passwordModal.messages.incorrectCurrent', 'Current password is incorrect')
        );
      } else if (error.message && error.message.includes('404')) {
        Alert.alert(
          t('passwordModal.alerts.errorTitle', 'Error'),
          t('passwordModal.messages.userNotFound', 'User not found. Please login again.')
        );
      } else if (error.message && error.message.includes('Network')) {
        Alert.alert(
          t('passwordModal.alerts.errorTitle', 'Error'),
          t('passwordModal.messages.network', 'Network error. Please check your connection and try again.')
        );
      } else {
        Alert.alert(
          t('passwordModal.alerts.errorTitle', 'Error'),
          error?.message || t('passwordModal.messages.genericError', 'Failed to change password. Please try again.')
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('passwordModal.title', 'Change Password')}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.passwordInputContainer}>
              <Icon name="lock-closed" size={20} color="#2E3192" style={styles.passwordIcon} />
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                placeholder={t('passwordModal.placeholders.current', 'Current Password')}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Icon 
                  name={showCurrentPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#757575" 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.passwordInputContainer}>
              <Icon name="key" size={20} color="#2E3192" style={styles.passwordIcon} />
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholder={t('passwordModal.placeholders.new', 'New Password')}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Icon 
                  name={showNewPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#757575" 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.passwordInputContainer}>
              <Icon name="key" size={20} color="#2E3192" style={styles.passwordIcon} />
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder={t('passwordModal.placeholders.confirm', 'Confirm New Password')}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Icon 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#757575" 
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.requirementsText}>
              {t('passwordModal.requirements.minLength', 'Password must be at least 6 characters long')}
            </Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, isLoading && styles.disabledButton]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>{t('passwordModal.buttons.cancel', 'Cancel')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.disabledButton]}
              onPress={handlePasswordChange}
              disabled={isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading
                  ? t('passwordModal.buttons.changing', 'Changing...')
                  : t('passwordModal.buttons.submit', 'Change Password')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  passwordIcon: {
    marginRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  requirementsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2E3192',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
