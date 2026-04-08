import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  Pressable,
  Animated,
  TextInput
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { green } from '../theme';
import i18n, { setLocale } from '../utils/i18n';
import { apiService } from '../services/api';

import { useNotifications } from '../NotificationContext';

const { width, height } = Dimensions.get('window');

export default function SideDrawer({ visible, onClose, navigation }) {
  const [userData, setUserData] = useState(null);
  const { stopAlertSound, clearAll } = useNotifications();
  const translateX = useRef(new Animated.Value(width)).current;
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpSaving, setCpSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  // Refresh user data whenever the drawer is opened
  useEffect(() => {
    if (visible) {
      loadUserData();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      // Ensure it's off-screen when hidden
      translateX.setValue(width);
    }
  }, [visible, translateX]);

  const handleClose = () => {
    Animated.timing(translateX, {
      toValue: width,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose && onClose();
    });
  };

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const stored = JSON.parse(userData);
        let latest = stored;
        try {
          const username = stored?.username || stored?.serviceId;
          if (username) {
            const fresh = await apiService.getUserByUsername(username);
            if (fresh && fresh.name) {
              latest = { ...stored, ...fresh };
            }
          }
        } catch { }
        setUserData(latest);
        try {
          const lang = await AsyncStorage.getItem('appLanguage');
          if (lang && typeof lang === 'string') setSelectedLanguage(lang);
        } catch { }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const menuOptions = [
    {
      id: 'profile',
      title: 'Profile',
      icon: 'person-circle',
      color: '#2E3192',
      hasArrow: true,
      onPress: () => {
        onClose();
        navigation.navigate('MainApp', { screen: 'Profile' });
      }
    },
    {
      id: 'operation',
      title: 'Operation Details',
      icon: 'briefcase',
      color: '#4CAF50',
      hasArrow: true,
      onPress: () => {
        onClose();
        navigation.navigate('OperationDetails');
      }
    },
    {
      id: 'ammo',
      title: 'Ammo',
      icon: 'cube',
      color: '#10B981',
      hasArrow: true,
      onPress: () => {
        // Close drawer first
        onClose();
        
        // Small delay to ensure drawer is closed
        setTimeout(() => {
          try {
            console.log('Navigating to Ammo screen');
            // Navigate directly to Ammo (it's in Stack navigator)
            navigation.navigate('Ammo');
          } catch (error) {
            console.error('Failed to navigate to Ammo:', error);
            // Try alternative navigation
            try {
              navigation.navigate('MainApp', { screen: 'Ammo' });
            } catch (e) {
              Alert.alert('Error', 'Could not open Ammo screen. Please try again.');
            }
          }
        }, 300);
      }
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: 'document-text',
      color: '#1976d2',
      hasArrow: true,
      onPress: () => {
        onClose();
        navigation.navigate('Reports');
      },
    },
    {
      id: 'health',
      title: 'Advanced Health Details',
      icon: 'medical',
      color: '#F44336',
      hasArrow: true,
      onPress: () => {
        onClose();
        navigation.navigate('HealthDetails');
      }
    },
    {
      id: 'timeline',
      title: 'Timeline',
      icon: 'time',
      color: '#009688',
      hasArrow: true,
      onPress: () => {
        onClose();
        navigation.navigate('Timeline');
      }
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'notifications',
      color: '#E91E63',
      hasArrow: true,
      onPress: () => {
        onClose();
        navigation.navigate('Notifications');
      }
    },
    {
      id: 'password',
      title: 'Change Password',
      icon: 'lock-closed',
      color: '#9C27B0',
      hasArrow: true,
      onPress: () => {
        setChangePasswordVisible(true);
      }
    }
  ];

  // Stats section removed per request

  return (
    <>
      <Modal
        visible={visible}
        animationType="none"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          {/* Backdrop area to close on outside touch */}
          <Pressable style={styles.backdrop} onPress={handleClose} />
          <Animated.View style={[styles.drawerContainer, { transform: [{ translateX }] }]}>
            <SafeAreaView style={styles.safeArea}>
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                nestedScrollEnabled={true}
                overScrollMode="always"
                scrollEnabled={true}
                contentContainerStyle={{ paddingBottom: 24 }}
              >

                {/* User Profile Header */}
                <View style={styles.profileHeader}>
                  <View style={styles.avatarContainer}>
                    {(() => {
                      const raw = (userData && (userData.photo || userData.profileImage || userData.image || userData.profile_photo || userData.profilePhoto || userData.avatar)) || null;
                      const uri = (() => {
                        if (!raw || typeof raw !== 'string' || raw.length === 0) return null;
                        const v = raw.trim();
                        if (v.startsWith('data:')) return v; // data URI
                        if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('file://')) return v; // direct URL or file
                        // assume raw base64
                        return `data:image/jpeg;base64,${v}`;
                      })();
                      if (uri) {
                        return (
                          <Image source={{ uri }} style={styles.avatarImage} />
                        );
                      }
                      return (
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {userData?.name ? userData.name.charAt(0).toUpperCase() : 'S'}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.username}>{userData?.name || 'Soldier'}</Text>
                    <Text style={styles.userRole}>{userData?.role?.toUpperCase() || 'SOLDIER'}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.profileArrow}
                    onPress={() => {
                      onClose();
                      navigation.navigate('MainApp', { screen: 'Profile' });
                    }}
                  >
                    <Icon name="chevron-forward" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Stats Section removed */}

                {/* Menu Options */}
                <View style={styles.menuContainer}>
                  {menuOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={styles.menuItem}
                      onPress={option.onPress}
                    >
                      <View style={styles.menuItemLeft}>
                        <Icon name={option.icon} size={20} color={option.color} />
                        <Text style={styles.menuText}>{option.title}</Text>
                      </View>
                      {option.hasArrow && (
                        <Icon name="chevron-forward" size={16} color="#666" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Logout at bottom section */}
                <View style={styles.menuContainer}>
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomWidth: 0 }]}
                    onPress={() => setShowLogoutConfirm(true)}
                  >
                    <View style={styles.menuItemLeft}>
                      <Icon name="log-out" size={20} color="#F44336" />
                      <Text style={[styles.menuText, { color: '#F44336' }]}>Logout</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Disclaimer Section */}
                <View style={styles.disclaimerContainer}>
                  <View style={styles.disclaimerHeader}>
                    <Icon name="warning" size={16} color="#FF9800" />
                    <Text style={styles.disclaimerTitle}>Disclaimer</Text>
                  </View>
                  <Text style={styles.disclaimerText}>
                    This application is for military personnel tracking and operational use only.
                  </Text>
                </View>

              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      {/* Logout Confirm Modal */}
      <Modal visible={showLogoutConfirm} transparent animationType="fade" onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.logoutBackdrop}>
          <View style={styles.logoutCard}>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutSubtitle}>Are you sure you want to logout?</Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity style={[styles.logoutBtn, styles.logoutCancel]} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.logoutCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutBtn, styles.logoutConfirm]}
                onPress={async () => {
                  setShowLogoutConfirm(false);
                  try {
                    handleClose();
                    if (stopAlertSound) stopAlertSound();
                    if (clearAll) clearAll();
                    await AsyncStorage.removeItem('currentUser');
                    if (navigation && navigation.reset) {
                      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    } else if (navigation && navigation.navigate) {
                      navigation.navigate('Login');
                    }
                  } catch (e) { }
                }}
              >
                <Text style={styles.logoutConfirmText}>LOGOUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Sheet */}
      <Modal
        visible={changePasswordVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChangePasswordVisible(false)}
      >
        <Pressable style={styles.settingsOverlay} onPress={() => setChangePasswordVisible(false)}>
          <View style={styles.settingsSheet}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordVisible(false)}>
                <Icon name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled={true}
              overScrollMode="always"
              scrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={{ gap: 16 }}>
                <View style={styles.passwordInputContainer}>
                  <Icon name="lock-closed" size={20} color="#2E3192" style={styles.passwordIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    value={cpCurrent}
                    onChangeText={setCpCurrent}
                    secureTextEntry={!showCurrentPassword}
                    placeholderTextColor="#9CA3AF"
                    selectionColor={green.primary}
                    underlineColorAndroid="transparent"
                    autoCapitalize="none"
                    autoCorrect={false}
                    importantForAutofill="no"
                    placeholder="Current Password"
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
                    value={cpNew}
                    onChangeText={setCpNew}
                    secureTextEntry={!showNewPassword}
                    placeholderTextColor="#9CA3AF"
                    selectionColor={green.primary}
                    underlineColorAndroid="transparent"
                    autoCapitalize="none"
                    autoCorrect={false}
                    importantForAutofill="no"
                    placeholder="New Password"
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
                    value={cpConfirm}
                    onChangeText={setCpConfirm}
                    secureTextEntry={!showConfirmPassword}
                    placeholderTextColor="#9CA3AF"
                    selectionColor={green.primary}
                    underlineColorAndroid="transparent"
                    autoCapitalize="none"
                    autoCorrect={false}
                    importantForAutofill="no"
                    placeholder="Confirm New Password"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Icon
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#757575"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.settingsCloseBtn}
                disabled={cpSaving}
                onPress={async () => {
                  if (!cpCurrent || !cpNew || !cpConfirm) {
                    Alert.alert('Error', 'Please fill all fields');
                    return;
                  }
                  if (cpNew !== cpConfirm) {
                    Alert.alert('Error', 'New passwords do not match');
                    return;
                  }
                  if (cpNew.length < 6) {
                    Alert.alert('Error', 'New password must be at least 6 characters');
                    return;
                  }
                  try {
                    setCpSaving(true);
                    const stored = await AsyncStorage.getItem('currentUser');
                    const user = stored ? JSON.parse(stored) : null;
                    const userId = user?.id;
                    if (!userId) {
                      Alert.alert('Error', 'User not found. Please login again.');
                      return;
                    }

                    // Show loading indicator
                    Alert.alert('Changing Password', 'Please wait while your password is being updated...', [], { cancelable: false });

                    await apiService.changePassword(userId, cpCurrent, cpNew);
                    Alert.alert('Success', 'Password updated successfully');
                    setCpCurrent(''); setCpNew(''); setCpConfirm('');
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setChangePasswordVisible(false);
                  } catch (e) {
                    console.error('Password change error:', e);

                    // Handle specific error types
                    if (e.message && e.message.includes('401')) {
                      Alert.alert('Error', 'Current password is incorrect');
                    } else if (e.message && e.message.includes('404')) {
                      Alert.alert('Error', 'User not found. Please login again.');
                    } else if (e.message && e.message.includes('Network')) {
                      Alert.alert('Error', 'Network error. Please check your connection and try again.');
                    } else {
                      Alert.alert('Error', e?.message || 'Failed to change password. Please try again.');
                    }
                  } finally {
                    setCpSaving(false);
                  }
                }}
              >
                <Text style={styles.settingsCloseText}>{cpSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Settings Modal: Simple screen-level modal hosting App Settings (Language, etc.) */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <Pressable style={styles.settingsOverlay} onPress={() => setSettingsVisible(false)}>
          <View style={styles.settingsSheet}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>App Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Icon name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Language inside App Settings */}
            <View style={styles.settingsGroup}>
              <Text style={styles.settingsGroupTitle}>Language</Text>
              <View style={styles.langRow}>
                {['en', 'hi', 'ta'].map(code => (
                  <TouchableOpacity
                    key={code}
                    style={[styles.langChip, selectedLanguage === code && styles.langChipActive]}
                    onPress={async () => {
                      try {
                        // Only allow supported languages: English, Hindi, Tamil
                        const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'];
                        if (SUPPORTED_LANGUAGES.includes(code)) {
                          setSelectedLanguage(code);
                          await AsyncStorage.setItem('appLanguage', code);
                          setLocale(code);
                          setLanguageModalVisible(false);
                        }
                      } catch { }
                    }}
                  >
                    <Text style={[styles.langChipText, selectedLanguage === code && styles.langChipTextActive]}>
                      {code.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.settingsCloseBtn} onPress={() => setSettingsVisible(false)}>
              <Text style={styles.settingsCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: width * 0.85,
    height: '100%',
    backgroundColor: '#fff',
    marginLeft: 'auto',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  // Logout modal styles (consistent with other modals)
  logoutBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  logoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  logoutSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  logoutActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  logoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  logoutCancel: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  logoutConfirm: {
    borderColor: '#0EA5A4',
    backgroundColor: '#10B981',
  },
  logoutCancelText: {
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logoutConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsGroup: {
    marginTop: 10,
  },
  settingsGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  langChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  langChipActive: {
    backgroundColor: green.primary,
    borderColor: green.primary,
  },
  langChipText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 12,
  },
  langChipTextActive: {
    color: '#fff',
  },
  settingsCloseBtn: {
    marginTop: 12,
    backgroundColor: green.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: green.primary,
    padding: 20,
    paddingTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: green.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#eee'
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: green.primary,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  profileArrow: {
    padding: 8,
  },
  // Stats styles removed
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
    fontWeight: '500',
  },
  disclaimerContainer: {
    backgroundColor: '#f8f8f8',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
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
});
