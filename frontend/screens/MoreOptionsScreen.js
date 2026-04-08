import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { setLocale, addLanguageChangeListener } from '../utils/i18n';
import * as Localization from 'expo-localization';
import PasswordChangeModal from '../components/PasswordChangeModal';

export default function MoreOptionsScreen({ navigation }) {
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
  
  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  // Only three languages supported: English, Hindi, and Tamil
  const languageOptions = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'hi', label: '🇮🇳 Hindi' },
    { code: 'ta', label: '🇮🇳 Tamil' },
  ];

  // Use useMemo to recalculate menu options when language changes
  const menuOptions = useMemo(() => {
    const options = [
      {
        id: 'profile',
        title: i18n.t('menuProfile'),
        icon: 'person-circle',
        color: '#2E3192',
        onPress: () => navigation.navigate('MainApp', { screen: 'Profile' })
      },
      {
        id: 'operation',
        title: i18n.t('menuOperationDetails'),
        icon: 'briefcase',
        color: '#4CAF50',
        onPress: () => navigation.navigate('OperationDetails')
      },
      {
        id: 'ammo',
        title: i18n.t('menuAmmo'),
        icon: 'cube',
        color: '#10B981',
        onPress: () => navigation.navigate('Ammo')
      },
      {
        id: 'health',
        title: i18n.t('menuHealthDetails'),
        icon: 'medical',
        color: '#F44336',
        onPress: () => navigation.navigate('HealthDetails')
      },
      {
        id: 'language',
        title: i18n.t('menuLanguagePreferences'),
        icon: 'language',
        color: '#FF9800',
        onPress: () => setLanguageModalVisible(true)
      },
      {
        id: 'password',
        title: i18n.t('menuChangePassword'),
        icon: 'lock-closed',
        color: '#9C27B0',
        onPress: () => setPasswordModalVisible(true)
      },
      {
        id: 'notifications',
        title: i18n.t('menuNotifications'),
        icon: 'notifications',
        color: '#E91E63',
        onPress: () => navigation.navigate('Notifications')
      },
      {
        id: 'reports',
        title: i18n.t('menuReports'),
        icon: 'document-text',
        color: '#1976d2',
        onPress: () => navigation.navigate('Reports'),
      },
      {
        id: 'timeline',
        title: i18n.t('menuTimeline'),
        icon: 'time',
        color: '#009688',
        onPress: () => navigation.navigate('Timeline')
      },
      {
        id: 'settings',
        title: i18n.t('menuAppSettings'),
        icon: 'settings',
        color: '#795548',
        onPress: () => Alert.alert(i18n.t('alertSettingsTitle'), i18n.t('alertSettingsMessage'))
      },
      {
        id: 'help',
        title: i18n.t('menuHelpSupport'),
        icon: 'help-circle',
        color: '#2196F3',
        onPress: () => Alert.alert(i18n.t('alertHelpTitle'), i18n.t('alertHelpMessage'))
      },
      {
        id: 'about',
        title: i18n.t('menuAboutApp'),
        icon: 'information-circle',
        color: '#607D8B',
        onPress: () => Alert.alert(i18n.t('alertAboutTitle'), i18n.t('alertAboutMessage'))
      }
    ];
    return options;
  }, [currentLanguage, navigation]);

  useEffect(() => {
    // Load language from AsyncStorage for display only
    // Don't call setLocale here as it's already handled in App.js and SettingsScreen
    const loadLanguage = async () => {
      const lang = await AsyncStorage.getItem('appLanguage');
      const supportedLanguages = ['en', 'hi', 'ta'];
      
      if (lang && supportedLanguages.includes(lang)) {
        setSelectedLanguage(lang);
        // Use current i18n locale if it's already set correctly
        if (i18n.locale !== lang) {
          setLocale(lang);
        }
      } else {
        // Default to English if no valid language stored
        setSelectedLanguage('en');
        if (i18n.locale !== 'en') {
          setLocale('en');
        }
        await AsyncStorage.setItem('appLanguage', 'en');
      }
    };
    loadLanguage();
  }, []);

  const handleLanguageSelect = async (lang) => {
    setSelectedLanguage(lang);
    setLocale(lang);
    await AsyncStorage.setItem('appLanguage', lang);
    setLanguageModalVisible(false);
  };


  const renderMenuOption = (option) => (
    <TouchableOpacity key={option.id} style={styles.menuOption} onPress={option.onPress}>
      <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
        <Icon name={option.icon} size={24} color={option.color} />
      </View>
      <Text style={styles.menuTitle}>{option.title}</Text>
      <Icon name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
      >
        <View style={styles.menuContainer}>
          {menuOptions.map(renderMenuOption)}
        </View>
      </ScrollView>

      {/* Language Selector Modal */}
      <Modal visible={languageModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('selectLanguage')}</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              {languageOptions.map(lang => (
                <TouchableOpacity 
                  key={lang.code} 
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang.code && styles.selectedLanguageOption
                  ]} 
                  onPress={() => handleLanguageSelect(lang.code)}
                >
                  <Text style={[
                    styles.languageOptionText,
                    selectedLanguage === lang.code && styles.selectedLanguageOptionText
                  ]}>
                    {lang.label}
                  </Text>
                  {selectedLanguage === lang.code && (
                    <Icon name="checkmark" size={20} color="#2E3192" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <PasswordChangeModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  menuContainer: {
    padding: 15,
    paddingBottom: 30,
    // Ensure proper spacing for scrolling
    minHeight: '100%',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    // Enhanced touch feedback
    borderWidth: 1,
    borderColor: '#f0f0f0',
    // Ensure proper sizing for scrolling
    minHeight: 70,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  modalContent: {
    maxHeight: 400,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedLanguageOption: {
    backgroundColor: '#f0f8ff',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedLanguageOptionText: {
    color: '#2E3192',
    fontWeight: 'bold',
  },
});
