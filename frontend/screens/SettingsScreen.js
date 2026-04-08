import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { green } from '../theme';
import i18n, { setLocale, addLanguageChangeListener } from '../utils/i18n';

// Only three languages supported: English, Hindi, and Tamil
const LANG_CODES = ['en', 'hi', 'ta'];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳' },
];

export default function SettingsScreen({ navigation }) {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const lang = await AsyncStorage.getItem('appLanguage');
        if (lang && typeof lang === 'string' && LANG_CODES.includes(lang)) {
          setSelectedLanguage(lang);
        } else {
          // Default to English if invalid language stored
          setSelectedLanguage('en');
          await AsyncStorage.setItem('appLanguage', 'en');
        }
      } catch {}
    })();
  }, []);

  const handleSelectLanguage = async (code) => {
    try {
      setSelectedLanguage(code);
      await AsyncStorage.setItem('appLanguage', code);
      setLocale(code);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Language Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('selectLanguage') || 'Select Language'}</Text>
          <View style={styles.langRow}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langChip,
                  selectedLanguage === lang.code && styles.langChipActive
                ]}
                onPress={() => handleSelectLanguage(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.langChipText,
                    selectedLanguage === lang.code && styles.langChipTextActive
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Placeholder for future settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Options</Text>
          <View style={styles.placeholderBox}>
            <Icon name="settings" size={20} color={green.primary} />
            <Text style={styles.placeholderText}>Add more settings here later.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: green.background,
  },
  container: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
    minWidth: 100,
  },
  langChipActive: {
    backgroundColor: green.primary,
    borderColor: green.primary,
  },
  langFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  langChipText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  langChipTextActive: {
    color: '#fff',
  },
  placeholderBox: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    marginLeft: 8,
    color: '#666',
    fontWeight: '600',
  },
});


