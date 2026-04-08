import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

const FIELD_CONFIG = [
  { key: 'hdl', defaultLabel: 'HDL' },
  { key: 'ldl', defaultLabel: 'LDL' },
  { key: 'majorAlignment', defaultLabel: 'Major Alignment' },
  { key: 'bloodSugar', defaultLabel: 'Blood Sugar' },
  { key: 'precipitation', defaultLabel: 'Precipitation' },
  { key: 'bloodPressure', defaultLabel: 'Blood Pressure' },
  { key: 'weight', defaultLabel: 'Weight' },
  { key: 'height', defaultLabel: 'Height' },
  { key: 'age', defaultLabel: 'Age' },
  { key: 'gender', defaultLabel: 'Gender' },
  { key: 'bloodGroup', defaultLabel: 'Blood Group' },
];

export default function HealthDetailsScreen() {
  const [data, setData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
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
    if (typeof fallback === 'function') return fallback(options);
    return fallback ?? key;
  }, [currentLanguage]);

  const fields = useMemo(() => (
    FIELD_CONFIG.map(field => ({
      ...field,
      label: t(`healthDetails.fields.${field.key}`, field.defaultLabel),
    }))
  ), [t]);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      setLoading(true);
      // Get current user ID
      const userStr = await AsyncStorage.getItem('currentUser');
      if (!userStr) {
        Alert.alert(
          t('healthDetails.alerts.errorTitle', 'Error'),
          t('healthDetails.messages.userNotLoggedIn', 'User not logged in')
        );
        setLoading(false);
        return;
      }
      
      const user = JSON.parse(userStr);
      setCurrentUserId(user.id);
      
      if (!user.id) {
        Alert.alert(
          t('healthDetails.alerts.errorTitle', 'Error'),
          t('healthDetails.messages.userIdMissing', 'User ID not found')
        );
        setLoading(false);
        return;
      }

      // Fetch health details from API
      const healthData = await apiService.getAdvancedHealthDetails(user.id);
      
      // Map API response to frontend field names
      const mappedData = {
        hdl: healthData.hdl?.toString() || '',
        ldl: healthData.ldl?.toString() || '',
        majorAlignment: healthData.majorAlignment || healthData.major_alignment || '',
        bloodSugar: healthData.bloodSugar?.toString() || healthData.blood_sugar?.toString() || '',
        precipitation: healthData.precipitation || '',
        bloodPressure: healthData.bloodPressure || healthData.blood_pressure || '',
        weight: healthData.weight || '',
        height: healthData.height || '',
        age: healthData.age?.toString() || '',
        gender: healthData.gender || '',
        bloodGroup: healthData.bloodGroup || healthData.blood_group || '',
      };
      
      setData(mappedData);
    } catch (error) {
      console.error('Error loading health data:', error);
      Alert.alert(
        t('healthDetails.alerts.errorTitle', 'Error'),
        t('healthDetails.messages.loadError', 'Failed to load health details. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!currentUserId) {
      Alert.alert(
        t('healthDetails.alerts.errorTitle', 'Error'),
        t('healthDetails.messages.userIdMissing', 'User ID not found')
      );
      return;
    }

    try {
      setSaving(true);
      
      // Prepare data for API (convert empty strings to null for numeric fields)
      const apiData = {
        hdl: data.hdl ? parseFloat(data.hdl) : null,
        ldl: data.ldl ? parseFloat(data.ldl) : null,
        majorAlignment: data.majorAlignment || null,
        bloodSugar: data.bloodSugar ? parseFloat(data.bloodSugar) : null,
        precipitation: data.precipitation || null,
        bloodPressure: data.bloodPressure || null,
        weight: data.weight || null,
        height: data.height || null,
        age: data.age ? parseInt(data.age) : null,
        gender: data.gender || null,
        bloodGroup: data.bloodGroup || null,
      };

      // Save to API
      await apiService.updateAdvancedHealthDetails(currentUserId, apiData);
      
      Alert.alert(
        t('healthDetails.alerts.successTitle', 'Saved'),
        t('healthDetails.messages.saveSuccess', 'Health details saved successfully')
      );
      setIsEditing(false);
      // Reload data to show updated values
      await loadHealthData();
    } catch (error) {
      console.error('Error saving health data:', error);
      const errorMessage = error.message || error.details || 'Unknown error';
      Alert.alert(
        t('healthDetails.alerts.errorTitle', 'Error'), 
        t(
          'healthDetails.messages.saveError',
          `Failed to save health details: ${errorMessage}. Please try again.`,
          { message: errorMessage }
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2E3192" />
        <Text style={{ marginTop: 16, color: '#666' }}>
          {t('healthDetails.messages.loading', 'Loading health details...')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {!isEditing && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('healthDetails.sections.vitals', 'Vitals')}</Text>
          {['bloodPressure','bloodSugar','weight','height'].map(k => (
            <View key={k} style={styles.rowItem}>
              <Text style={styles.labelInline}>{fields.find(f=>f.key===k)?.label}</Text>
              <Text style={styles.valueInline}>{String(data[k] ?? '—')}</Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            {t('healthDetails.sections.lipidPanel', 'Lipid Panel')}
          </Text>
          {['hdl','ldl'].map(k => (
            <View key={k} style={styles.rowItem}>
              <Text style={styles.labelInline}>{fields.find(f=>f.key===k)?.label}</Text>
              <Text style={styles.valueInline}>{String(data[k] ?? '—')}</Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            {t('healthDetails.sections.profile', 'Profile')}
          </Text>
          {['age','gender','bloodGroup','majorAlignment','precipitation'].map(k => (
            <View key={k} style={styles.rowItem}>
              <Text style={styles.labelInline}>{fields.find(f=>f.key===k)?.label}</Text>
              <Text style={styles.valueInline}>{String(data[k] ?? '—')}</Text>
            </View>
          ))}

          <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={() => setIsEditing(true)}>
            <Text style={styles.primaryButtonText}>{t('healthDetails.buttons.edit', 'Edit')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isEditing && (
        <View style={styles.card}>
          {fields.map(f => (
            <View key={f.key} style={{ marginBottom: 14 }}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('healthDetails.placeholders.generic', `Enter ${f.label}`, { label: f.label })}
                value={String(data[f.key] ?? '')}
                onChangeText={textValue => handleChange(f.key, textValue)}
              />
            </View>
          ))}
          <TouchableOpacity 
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('healthDetails.buttons.save', 'Save')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, { marginTop: 10 }]} onPress={() => setIsEditing(false)}>
            <Text style={styles.secondaryButtonText}>{t('healthDetails.buttons.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontWeight: 'bold', marginBottom: 8, color: '#1F2937', fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  primaryButton: { backgroundColor: '#2E3192', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#6B7280', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: '#111827' },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  labelInline: { color: '#374151', fontWeight: '600', fontSize: 15 },
  valueInline: { color: '#111827', fontSize: 15 },
  primaryButtonDisabled: { opacity: 0.6 },
});


