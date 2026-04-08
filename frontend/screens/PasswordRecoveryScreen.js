import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function PasswordRecoveryScreen({ navigation }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
  
  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  const handleSendOTP = () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Please enter your username or email.');
      return;
    }
    setLoading(true);
    // Simulate sending OTP (replace with real API call)
    setTimeout(() => {
      setLoading(false);
      Alert.alert('OTP Sent', 'A one-time password has been sent to your registered email (simulated).', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Password Recovery</Text>
        <Text style={styles.subtitle}>Enter your username or email to receive a one-time password (OTP).</Text>
        <View style={styles.inputContainer}>
          <Icon name="person-circle-outline" size={22} color="#2A6F2B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={i18n.t('usernameOrEmail')}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <TouchableOpacity
          style={styles.otpButton}
          onPress={handleSendOTP}
          disabled={loading}
        >
          <Text style={styles.otpButtonText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2A6F2B',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#222',
  },
  otpButton: {
    backgroundColor: '#2A6F2B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  otpButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 8,
  },
  cancelLinkText: {
    color: '#2A6F2B',
    fontSize: 15,
    fontWeight: 'bold',
  },
}); 