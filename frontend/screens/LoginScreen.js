import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, Image, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform, ToastAndroid, ScrollView, KeyboardAvoidingView, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { apiService } from '../services/api';
import * as Location from 'expo-location';
import { startBackgroundLocation, updateCachedUserData } from '../services/backgroundLocationService';
import i18n from '../utils/i18n';

const { width, height } = Dimensions.get('window');

const showRoleToast = (role) => {
  const message = role === 'commander' ? 'Welcome Commander' : 'Welcome Soldier';
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // Fallback for iOS: use Alert with a timeout
    const alert = Alert.alert(message);
    setTimeout(() => {
      // Dismiss alert after 1.5s (not natively supported, but Alert is modal)
      // On iOS, Alert will disappear after user taps OK
    }, 1500);
  }
};

export default function LoginScreen({ navigation }) {
  const [serviceId, setServiceId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const isDatabaseLinked = true; // Always use backend

  // CAPTCHA state
  const [captcha, setCaptcha] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');

  // Generate a random 5-character CAPTCHA with mixed case and numbers
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(result);
    setCaptchaInput('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleLogin = async () => {
    if (serviceId && password) {
      // CAPTCHA validation
      if (captchaInput.trim() !== captcha) {
        Alert.alert('You entered the wrong CAPTCHA');
        generateCaptcha();
        return;
      }
      setLoading(true);
      try {
        // Use backend API for login only
        console.log('[LOGIN] Attempting login...');
        const user = await apiService.login({ serviceId, password });
        console.log('[LOGIN] Login successful. User data:', JSON.stringify(user, null, 2));

        await AsyncStorage.setItem('currentUser', JSON.stringify(user));
        setLoading(false);
        showRoleToast(user.role); // Show toast based on user role
        
        // After login, capture and update location
        console.log('[LOGIN] Now attempting to update location...');
        try {
          console.log('[LOGIN] Requesting location permission...');
          let { status } = await Location.requestForegroundPermissionsAsync();
          console.log(`[LOGIN] Location permission status: ${status}`);
          
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Location permission was denied. Cannot update location.');
            console.error('[LOGIN] Location permission denied.');
            navigation.navigate('MainApp');
            return;
          }

          console.log('[LOGIN] Getting current position...');
          const loc = await Location.getCurrentPositionAsync({});
          console.log('[LOGIN] Got location:', JSON.stringify(loc.coords));

          const latitude = loc.coords.latitude;
          const longitude = loc.coords.longitude;
          const heading = (typeof loc.coords.heading === 'number' && !isNaN(loc.coords.heading)) ? loc.coords.heading : 0;

          if (!user || !user.id) {
              console.error('[LOGIN] Cannot update location: User Login ID is missing from login response.');
              Alert.alert('Error', 'Could not update location: User Login ID is missing.');
          } else {
              console.log(`[LOGIN] Sending location update for userId: ${user.id}`);
              await apiService.updateUserLocation(user.id, latitude, longitude, heading);
              console.log('[LOGIN] Location update API call successful.');
          }

        } catch (err) {
          Alert.alert('Location Error', 'Could not fetch or update location after login.');
          console.error('[LOGIN] An error occurred during location update:', err);
        }

        // Start background location tracking after successful login
        try {
          console.log('[LOGIN] Starting background location tracking...');
          await updateCachedUserData();
          const success = await startBackgroundLocation();
          if (success) {
            console.log('[LOGIN] Background location tracking started successfully');
          } else {
            console.warn('[LOGIN] Failed to start background location tracking');
          }
        } catch (error) {
          console.error('[LOGIN] Error starting background location:', error);
        }

        navigation.navigate('MainApp');
      } catch (error) {
        setLoading(false);
        Alert.alert('Error', 'Invalid credentials or server error');
        console.error('[LOGIN] An error occurred during login:', error);
      }
    } else {
      Alert.alert('Error', 'Please enter your User Login ID and password');
    }
  };
  
  return (
    <View style={styles.rootContainer}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#ffffff" 
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          enabled={true}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            bounces={true}
            alwaysBounceVertical={false}
            overScrollMode="always"
            nestedScrollEnabled={true}
          >
            <View style={styles.container}>
              {/* Header Section */}
              <View style={styles.headerSection}>
                <Text style={styles.headerText}>Military Asset Tracker</Text>
                <View style={styles.logoWrapper}>
                  <Image 
                    source={require('../assets/3.jpg')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>Secure Login</Text>
              </View>

              {/* Modern Card Container for Login Form and Actions */}
              <View style={styles.cardContainer}>
                {/* Section: User Login ID */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>User Login ID <Text style={styles.required}>*</Text></Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={i18n.t('enterUserId')}
                      placeholderTextColor="#666666"
                      value={serviceId}
                      onChangeText={setServiceId}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="username"
                      selectionColor="#2A6F2B"
                    />
                    <Icon name="shield-outline" size={20} color="#2A6F2B" style={styles.inputIcon} />
                  </View>
                </View>

                {/* Section: Password */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={i18n.t('enterPassword')}
                      placeholderTextColor="#666666"
                      secureTextEntry={secureTextEntry}
                      value={password}
                      onChangeText={setPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      selectionColor="#2A6F2B"
                    />
                    <TouchableOpacity
                      style={styles.eyeIconOverlay}
                      onPress={() => setSecureTextEntry(!secureTextEntry)}
                      activeOpacity={0.7}
                    >
                      <Icon 
                        name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'} 
                        size={22} 
                        color="#2E3192" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Section: CAPTCHA */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>CAPTCHA Verification <Text style={styles.required}>*</Text></Text>
                  <View style={styles.captchaContainer}>
                    <View style={styles.captchaDisplay}>
                      <Text style={styles.captchaText}>{captcha}</Text>
                    </View>
                    <TextInput
                      style={styles.captchaInput}
                      placeholder={i18n.t('enterCaptcha')}
                      placeholderTextColor="#666666"
                      value={captchaInput}
                      onChangeText={setCaptchaInput}
                      autoCapitalize="characters"
                      maxLength={5}
                      selectionColor="#2A6F2B"
                    />
                    <TouchableOpacity 
                      onPress={generateCaptcha} 
                      style={styles.refreshButton}
                      activeOpacity={0.7}
                    >
                      <Icon name="refresh" size={20} color="#2A6F2B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Login Button */}
                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    loading && styles.loginButtonDisabled
                  ]} 
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                  )}
                </TouchableOpacity>

                {/* Register and Forgot Password Links */}
                <TouchableOpacity
                  style={styles.registerLink}
                  onPress={() => navigation.navigate('Register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerLinkText}>
                    Don't have an account? <Text style={styles.registerWord}>Register</Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.forgotLink}
                  onPress={() => navigation.navigate('PasswordRecovery')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotLinkText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              
              {/* Security Notice */}
              <View style={styles.securityNotice}>
                <Icon name="shield-checkmark" size={16} color="#666" />
                <Text style={styles.securityText}>
                  This is a secure military application. All activities are logged and monitored.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingBottom: Platform.OS === 'android' ? 0 : 0,
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, // Account for home indicator
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    minHeight: '100%',
  },
  headerSection: {
    alignItems: 'center',
    marginVertical: 10, // reduced from 20
    paddingTop: Platform.OS === 'ios' ? 6 : 10, // reduced
  },
  logoWrapper: {
    alignItems: 'center',
    marginVertical: 8, // reduced from 20
  },
  logo: {
    width: Math.min(width * 0.3, 120),
    height: Math.min(width * 0.3, 120),
    borderRadius: Math.min(width * 0.15, 60),
  },
  headerText: {
    fontSize: Math.min(width * 0.07, 28),
    fontWeight: 'bold',
    marginBottom: 8, // reduced from 20
    textAlign: 'center',
    color: '#2E3192',
  },
  title: {
    fontSize: Math.min(width * 0.06, 24),
    fontWeight: 'bold',
    marginBottom: 8, // reduced from 20
    textAlign: 'center',
    color: '#2E3192',
  },
  formContainer: {
    width: '100%',
    marginTop: 12,
    marginBottom: 20,
  },
  sectionContainer: {
    backgroundColor: '#f8f8ff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: Math.min(width * 0.04, 16),
    fontWeight: '500',
    color: '#2E3192',
    marginBottom: 6,
    marginLeft: 2,
    textAlign: 'left',
  },
  required: {
    color: '#FF0000',
    fontWeight: 'bold',
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
    marginBottom: 18,
  },
  input: {
    width: '100%',
    height: Math.max(48, height * 0.056),
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingRight: 50,
    marginBottom: 18,
    backgroundColor: '#f8f9fa',
    fontSize: Math.min(width * 0.04, 16),
    color: '#2E3192',
    fontWeight: '500',
    textAlignVertical: 'center',
    includeFontPadding: false,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    ...(Platform.OS === 'android' && {
      textAlign: 'left',
      textAlignVertical: 'center',
      paddingVertical: 0,
    }),
  },
  inputIcon: {
    position: 'absolute',
    right: 14,
    top: 12,
    zIndex: 2,
  },
  eyeIconOverlay: {
    position: 'absolute',
    right: 14,
    top: 12,
    zIndex: 2,
    padding: 4,
    minWidth: 30,
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 4,
  },
  captchaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
  },
  captchaDisplay: {
    backgroundColor: '#f8f9fa',
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  captchaText: {
    fontSize: Math.min(width * 0.04, 16),
    fontWeight: 'bold',
    color: '#2E3192',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  captchaInput: {
    flex: 1,
    height: Math.max(48, height * 0.056),
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    backgroundColor: '#f8f9fa',
    fontSize: Math.min(width * 0.04, 16),
    color: '#2E3192',
    fontWeight: '500',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    ...(Platform.OS === 'android' && {
      textAlignVertical: 'center',
      paddingVertical: 0,
    }),
  },
  refreshButton: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    marginTop: 10,
    marginBottom: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#2A6F2B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: 55,
  },
  loginButtonDisabled: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: Math.min(width * 0.045, 18),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 8, // reduced gap
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  registerLinkText: {
    fontSize: Math.min(width * 0.04, 16),
    color: '#2A6F2B', // default color for the sentence
  },
  registerWord: {
    color: '#007AFF', // blue
    textDecorationLine: 'underline',
  },
  forgotLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 5,
    backgroundColor: 'transparent',
  },
  forgotLinkText: {
    color: '#2E3192',
    fontSize: Math.min(width * 0.035, 14),
    fontWeight: 'bold',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  securityText: {
    color: '#666',
    marginLeft: 8,
    fontSize: Math.min(width * 0.032, 13),
    textAlign: 'center',
    flex: 1,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    marginTop: 6, // reduced from 8
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  fieldContainer: {
    marginBottom: 10, // reduced gap
  },
  label: {
    fontSize: Math.min(width * 0.04, 16),
    fontWeight: '500',
    color: '#2E3192',
    marginBottom: 2, // reduced gap
    marginLeft: 2,
    textAlign: 'left',
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#2A6F2B',
    borderRadius: 12,
    paddingVertical: 14, // slightly reduced
    alignItems: 'center',
    marginBottom: 10, // reduced gap
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: 50, // slightly reduced
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 8, // reduced gap
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  forgotLink: {
    alignItems: 'center',
    paddingVertical: 6, // reduced gap
    marginTop: 2,
    backgroundColor: 'transparent',
  },
});
