// screens/RegisterScreen.js
import React, { useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, TextInput, StyleSheet, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, FlatList, SafeAreaView, KeyboardAvoidingView, Dimensions, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { apiService, API_BASE_URL, socket } from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

// Loaded from backend `/units`
const initialUnitOptions = [];
const genderOptions = ['Male', 'Female', 'Transgender'];
const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const roleOptions = ['commander', 'soldier'];

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bp, setBP] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unitOptions, setUnitOptions] = useState(initialUnitOptions);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showBloodGroupModal, setShowBloodGroupModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [focusedField, setFocusedField] = useState('');
  const [registeringLocation, setRegisteringLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  React.useEffect(() => {
    socket.on('connect', () => {
      console.log('[SOCKET.IO] Connected to backend socket server');
    });
    return () => {
      socket.off('connect');
    };
  }, []);

  // Load units from backend (reusable)
  const loadUnits = React.useCallback(async () => {
    try {
      const units = await apiService.getUnits?.();
      if (Array.isArray(units) && units.length > 0) {
        const names = units
          .map(u => (typeof u === 'string' ? u : (u.name || u.unit_name || u.unit || '')))
          .filter(Boolean);
        setUnitOptions(Array.from(new Set(names)).sort());
        return;
      }
    } catch {}

    // Fallbacks when /units unavailable or empty
    try {
      const users = await apiService.getAllUsers?.();
      const names = Array.from(new Set((users || [])
        .map(u => (u?.unit || u?.unit_name || '').toString().trim())
        .filter(Boolean)));
      setUnitOptions(names.sort());
    } catch {
      setUnitOptions([]);
    }
  }, []);

  // Initial load
  React.useEffect(() => { loadUnits(); }, [loadUnits]);

  // Refresh when screen comes into focus
  useFocusEffect(React.useCallback(() => {
    loadUnits();
  }, [loadUnits]));

  const validatePassword = (password) => {
    // Check minimum length
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    
    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter (A-Z)';
    }
    
    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter (a-z)';
    }
    
    // Check for number
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number (0-9)';
    }
    
    // Check for special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return 'Password must contain at least one special character (@, #, $, %, !, &, *)';
    }
    
    return null;
  };

  const validateField = (fieldName, value) => {
    const errors = { ...fieldErrors };
    
    switch (fieldName) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
          errors[fieldName] = 'Please enter a valid email address';
        } else {
          delete errors[fieldName];
        }
        break;
      case 'phone':
        const phoneRegex = /^\d{10,}$/;
        if (value && !phoneRegex.test(value.replace(/\s/g, ''))) {
          errors[fieldName] = 'Please enter a valid phone number';
        } else {
          delete errors[fieldName];
        }
        break;
      case 'idNumber':
        if (value && value.trim() === '') {
          errors[fieldName] = 'ID Number is required';
        } else if (value && value.trim().length < 3) {
          errors[fieldName] = 'ID Number must be at least 3 characters long';
        } else {
          delete errors[fieldName];
        }
        break;
      case 'password':
        const passwordError = validatePassword(value);
        if (passwordError) {
          errors[fieldName] = passwordError;
        } else {
          delete errors[fieldName];
        }
        break;
      case 'confirmPassword':
        if (value && value !== password) {
          errors[fieldName] = 'Passwords do not match';
        } else {
          delete errors[fieldName];
        }
        break;
    }
    
    setFieldErrors(errors);
  };

  const handleFieldChange = (fieldName, value, setter) => {
    setter(value);
    validateField(fieldName, value);
  };

  const getProgressPercentage = () => {
    const mandatoryFields = [name, phone, email, idNumber, category, unit, role, username, password, confirmPassword];
    const filledFields = mandatoryFields.filter(field => field && field.trim() !== '').length;
    return Math.round((filledFields / mandatoryFields.length) * 100);
  };

  const handleRegister = async () => {
    // Validation for mandatory fields
    const mandatoryFields = [
      { field: name, name: 'Full Name' },
      { field: phone, name: 'Phone Number' },
      { field: email, name: 'Email' },
      { field: idNumber, name: 'ID Number' },
      { field: category, name: 'Category/Division' },
      { field: unit, name: 'Unit' },
      { field: role, name: 'Role' },
      { field: username, name: 'User Login ID' },
      { field: password, name: 'Password' },
      { field: confirmPassword, name: 'Confirm Password' }
    ];

    for (const field of mandatoryFields) {
      if (!field.field || field.field.trim() === '') {
        Alert.alert('Error', `${field.name} is required`);
      return;
      }
    }

    // Check for field errors
    if (Object.keys(fieldErrors).length > 0) {
      Alert.alert('Error', 'Please fix the validation errors before proceeding');
      return;
    }

    setLoading(true);
    console.log('Sending registration data:', {
      username, password, name, role, email, unit_name: unit,
      category, phone_no: phone, id_no: idNumber, age, gender, height, weight, bp, blood_group: bloodGroup
    });
    try {
      const newUser = {
        username,
        password,
        name,
        role,
        email,
        unit_name: unit,
        category,
        phone_no: phone ? String(phone) : '',
        id_no: idNumber ? String(idNumber) : '',
        age: age ? parseInt(age) : null,
        gender: gender || null,
        height: height || null,
        weight: weight || null,
        bp: bp || null,
        blood_group: bloodGroup || null
      };
      const data = await apiService.register(newUser);
      setLoading(false);
      Alert.alert('Registration Request Submitted!', 'Your registration request has been submitted for approval. You will be notified once it is processed.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      setLoading(false);
      console.error('[REGISTER] An error occurred during registration:\n', err);
      Alert.alert('Registration Error', (err && err.message) ? err.message : 'Registration failed. Please try again.');
    }
  };

  const renderField = (label, value, onChangeText, placeholder, options = {}) => {
    const {
      keyboardType = 'default',
      secureTextEntry = false,
      autoCapitalize = 'none',
      autoCorrect = true,
      returnKeyType = 'next',
      maxLength,
      isRequired = false,
      fieldName = '',
      showEyeIcon = false,
      onEyePress = null
    } = options;

    const hasError = fieldErrors[fieldName];
    const isFocused = focusedField === fieldName;

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          {label} {isRequired && <Text style={styles.required}>*</Text>}
        </Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.input,
              isFocused && styles.inputFocused,
              hasError && styles.inputError
            ]}
            value={value}
            onChangeText={(text) => handleFieldChange(fieldName, text, onChangeText)}
            placeholder={placeholder}
            placeholderTextColor="#666666"
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            maxLength={maxLength}
            onFocus={() => setFocusedField(fieldName)}
            onBlur={() => setFocusedField('')}
            accessibilityLabel={`${label} input field`}
            textContentType={fieldName === 'email' ? 'emailAddress' :
                           fieldName === 'phone' ? 'telephoneNumber' :
                           fieldName === 'password' || fieldName === 'confirmPassword' ? 'password' :
                           fieldName === 'name' ? 'name' : 'none'}
            selectionColor="#2A6F2B"
          />
          {showEyeIcon && (
            <TouchableOpacity
              style={styles.eyeIconOverlay}
              onPress={onEyePress}
              activeOpacity={0.7}
            >
              <Icon 
                name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'} 
                size={22} 
                color="#2E3192" 
              />
            </TouchableOpacity>
          )}
        </View>
        {hasError && <Text style={styles.errorText}>{hasError}</Text>}
      </View>
    );
  };

  const renderDropdownField = (label, value, onPress, placeholder, isRequired = false) => {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          {label} {isRequired && <Text style={styles.required}>*</Text>}
        </Text>
        <TouchableOpacity
          style={[styles.dropdownSelector, focusedField === label && styles.inputFocused]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownText}>{value || placeholder}</Text>
          <Icon name="chevron-down" size={20} color="#2A6F2B" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
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
      <Text style={styles.title}>Register New Account</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${getProgressPercentage()}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
            </View>

            {/* Modern Card Container for Registration Form and Actions */}
            <View style={styles.cardContainer}>
              {/* Form Sections */}
              {/* Personal Information Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Icon name="person" size={20} color="#2A6F2B" />
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>
                {renderField(
                  'Full Name',
                  name,
                  setName,
                  'Enter your full name',
                  { autoCapitalize: 'words', fieldName: 'name', isRequired: true }
                )}
                {renderField(
                  'Phone Number',
                  phone,
                  setPhone,
                  'Enter your phone number',
                  { keyboardType: 'phone-pad', fieldName: 'phone', isRequired: true }
                )}
                {renderField(
                  'Email',
                  email,
                  setEmail,
                  'Enter your email address',
                  { keyboardType: 'email-address', fieldName: 'email', isRequired: true }
                )}
                {renderDropdownField(
                  'Gender',
                  gender,
                  () => setShowGenderModal(true),
                  'Select Gender'
                )}
                {renderField(
                  'Age',
                  age,
                  setAge,
                  'Enter your age',
                  { keyboardType: 'numeric', fieldName: 'age' }
                )}
                {renderDropdownField(
                  'Blood Group',
                  bloodGroup,
                  () => setShowBloodGroupModal(true),
                  'Select Blood Group'
                )}
              </View>
              {/* Medical Information Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Icon name="medical" size={20} color="#2A6F2B" />
                  <Text style={styles.sectionTitle}>Medical Information</Text>
                </View>
                {renderField(
                  'Height',
                  height,
                  setHeight,
                  'e.g., 170cm',
                  { fieldName: 'height' }
                )}
                {renderField(
                  'Weight',
                  weight,
                  setWeight,
                  'e.g., 70kg',
                  { fieldName: 'weight' }
                )}
                {renderField(
                  'Blood Pressure',
                  bp,
                  setBP,
                  'e.g., 120/80',
                  { fieldName: 'bp' }
                )}
              </View>
              {/* Military Information Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Icon name="shield" size={20} color="#2A6F2B" />
                  <Text style={styles.sectionTitle}>Military Information</Text>
                </View>
                {renderField(
                  'Employee ID',
                  idNumber,
                  setIdNumber,
                  'Enter your employee ID',
                  { fieldName: 'idNumber', isRequired: true }
                )}
                {renderField(
                  'Category/Division',
                  category,
                  setCategory,
                  'Enter your category/division',
                  { autoCapitalize: 'words', fieldName: 'category', isRequired: true }
                )}
                {renderDropdownField(
                  'Unit',
                  unit,
                  async () => { await loadUnits(); setShowUnitModal(true); },
                  'Select Unit',
                  true
                )}
                {renderDropdownField(
                  'Role',
                  role,
                  () => setShowRoleModal(true),
                  'Select Role',
                  true
                )}
              </View>
              {/* Account Information Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Icon name="lock-closed" size={20} color="#2A6F2B" />
                  <Text style={styles.sectionTitle}>Account Information</Text>
                </View>
                {renderField(
                  'User Login ID',
                  username,
                  setUsername,
                  'Choose a unique user login ID',
                  { fieldName: 'username', isRequired: true }
                )}
                {renderField(
                  'Password',
                  password,
                  setPassword,
                  'Create a strong password',
                  { 
                    secureTextEntry: secureTextEntry,
                    fieldName: 'password',
                    isRequired: true,
                    showEyeIcon: true,
                    onEyePress: () => setSecureTextEntry(!secureTextEntry)
                  }
                )}
                <View style={styles.passwordRequirementsContainer}>
                  <Text style={styles.passwordRequirementsTitle}>Password Requirements:</Text>
                  <View style={styles.passwordRequirementsGrid}>
                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementLabel}>Length:</Text>
                      <Text style={styles.requirementValue}>6+ characters</Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementLabel}>Uppercase:</Text>
                      <Text style={styles.requirementValue}>A-Z</Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementLabel}>Lowercase:</Text>
                      <Text style={styles.requirementValue}>a-z</Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementLabel}>Numbers:</Text>
                      <Text style={styles.requirementValue}>0-9</Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementLabel}>Special:</Text>
                      <Text style={styles.requirementValue}>@#$%!&*</Text>
                    </View>
                  </View>
                </View>
                {renderField(
                  'Confirm Password',
                  confirmPassword,
                  setConfirmPassword,
                  'Confirm your password',
                  { 
                    secureTextEntry: secureConfirmTextEntry,
                    fieldName: 'confirmPassword',
                    isRequired: true,
                    showEyeIcon: true,
                    onEyePress: () => setSecureConfirmTextEntry(!secureConfirmTextEntry)
                  }
                )}
              </View>
              {/* Register Button */}
              <TouchableOpacity
                style={[
                  styles.registerButton,
                  (loading || Object.keys(fieldErrors).length > 0) && styles.registerButtonDisabled
                ]} 
                onPress={handleRegister}
                disabled={loading || Object.keys(fieldErrors).length > 0}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
              {/* Login Link */}
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginWord}>Login</Text>
                </Text>
              </TouchableOpacity>
            </View>
      
            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Icon name="shield-checkmark" size={16} color="#666" />
              <Text style={styles.securityText}>
                VERSION 1.0
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Modals */}
        <Modal visible={showGenderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Gender</Text>
            <FlatList
                data={genderOptions}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                  onPress={() => {
                      setGender(item);
                      setShowGenderModal(false);
                    }}
                  activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCancelButton} 
              onPress={() => setShowGenderModal(false)} 
              activeOpacity={0.7}
            >
                <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBloodGroupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Blood Group</Text>
            <FlatList
              data={bloodGroupOptions}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setBloodGroup(item);
                    setShowBloodGroupModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCancelButton} 
              onPress={() => setShowBloodGroupModal(false)} 
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
        <Modal visible={showUnitModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Unit</Text>
            <FlatList
                data={unitOptions}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                  onPress={() => {
                    setUnit(item);
                      setShowUnitModal(false);
                    }}
                  activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCancelButton} 
              onPress={() => setShowUnitModal(false)} 
              activeOpacity={0.7}
            >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
        <Modal visible={showRoleModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Role</Text>
              <FlatList
                data={roleOptions}
                keyExtractor={item => item}
                renderItem={({ item }) => (
            <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setRole(item);
                      setShowRoleModal(false);
                    }}
                  activeOpacity={0.7}
                  >
                  <Text style={styles.modalItemText}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                  </TouchableOpacity>
                )}
              />
            <TouchableOpacity 
              style={styles.modalCancelButton} 
              onPress={() => setShowRoleModal(false)} 
              activeOpacity={0.7}
            >
                <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
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
  headerText: {
    fontSize: Math.min(width * 0.07, 28),
    fontWeight: 'bold',
    marginBottom: 8, // reduced from 20
    textAlign: 'center',
    color: '#2E3192',
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
  title: {
    fontSize: Math.min(width * 0.06, 24),
    fontWeight: 'bold',
    marginBottom: 8, // reduced from 20
    textAlign: 'center',
    color: '#2E3192',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E3192',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 5,
    fontSize: Math.min(width * 0.04, 16),
    color: '#2E3192',
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
    marginTop: 12,
    marginBottom: 20,
  },
  actionContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginTop: 10,
    marginBottom: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: Math.min(width * 0.045, 18),
    fontWeight: 'bold',
    color: '#2E3192',
    marginLeft: 8,
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
  required: {
    color: '#FF0000',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    height: Math.max(48, height * 0.056),
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
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
  inputFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    elevation: 3,
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  inputError: {
    borderColor: '#FF0000',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: Math.max(48, height * 0.056),
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dropdownText: {
    fontSize: Math.min(width * 0.04, 16),
    color: '#2E3192',
    fontWeight: '500',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderColor: '#2A6F2B',
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 18,
    paddingHorizontal: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  eyeIcon: {
    marginLeft: 8,
  },
  registerButton: {
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
  registerButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: Math.min(width * 0.045, 18),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8, // reduced gap
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  loginLinkText: {
    fontSize: Math.min(width * 0.04, 16),
    color: '#2A6F2B', // default color for the sentence
  },
  loginWord: {
    color: '#007AFF', // blue
    textDecorationLine: 'underline',
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
  },
  securityText: {
    color: '#666',
    marginLeft: 8,
    fontSize: Math.min(width * 0.032, 13),
    textAlign: 'center',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: Math.min(width * 0.045, 18),
    fontWeight: 'bold',
    color: '#2A6F2B',
    marginBottom: 10,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 44,
  },
  modalItemText: {
    fontSize: Math.min(width * 0.04, 16),
    color: '#2E3192',
    fontWeight: '500',
  },
  modalCancelButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
    minHeight: 44,
  },
  modalCancelText: {
    color: '#2A6F2B',
    fontWeight: 'bold',
    fontSize: Math.min(width * 0.04, 16),
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
    marginBottom: 18,
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
  },
  passwordRequirementsContainer: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: -5,
    marginBottom: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  passwordRequirementsTitle: {
    fontSize: Math.min(width * 0.035, 14),
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 8,
  },
  passwordRequirementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minWidth: '48%',
  },
  requirementLabel: {
    fontSize: Math.min(width * 0.032, 13),
    color: '#666',
    fontWeight: '500',
    marginRight: 8,
  },
  requirementValue: {
    fontSize: Math.min(width * 0.032, 13),
    color: '#2E3192',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorText: {
    color: '#FF0000',
    fontSize: Math.min(width * 0.035, 14),
    marginTop: 5,
    fontWeight: '500',
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
});
