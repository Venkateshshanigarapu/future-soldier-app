import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { green } from '../theme';
import { apiService } from '../services/api';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function OperationDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('inactive');
  const [skills, setSkills] = useState([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);

  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  const loadOperationalDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const stored = await AsyncStorage.getItem('currentUser');
      const parsedUser = stored ? JSON.parse(stored) : null;
      if (!parsedUser?.id) {
        throw new Error(i18n.t('userNotFoundError'));
      }

      setUserId(parsedUser.id);

      const [skillsResponse, detailsResponse] = await Promise.all([
        apiService.getOperationalSkills().catch(() => []),
        apiService.getOperationalDetails(parsedUser.id).catch(() => null),
      ]);

      setSkills(Array.isArray(skillsResponse) ? skillsResponse : []);

      if (detailsResponse) {
        setRole(detailsResponse.role || detailsResponse.userRole || parsedUser.role || 'soldier');
        setStatus(detailsResponse.status || 'inactive');
        setSelectedSkillIds(Array.isArray(detailsResponse.specialSkillIds) ? detailsResponse.specialSkillIds : []);
      } else {
        setRole(parsedUser.role || 'soldier');
        setStatus('inactive');
        setSelectedSkillIds([]);
      }
    } catch (err) {
      console.error('[OperationDetailsScreen] load error:', err);
      setError(err?.message || i18n.t('operationalDetailsError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOperationalDetails();
  }, [loadOperationalDetails]);

  const formattedRole = useMemo(() => {
    const normalized = (role || '').toLowerCase();
    switch (normalized) {
      case 'unitadmin':
      case 'unit_admin':
        return i18n.t('roleLabels.unitAdmin');
      case 'commander':
        return i18n.t('roleLabels.commander');
      case 'soldier':
        return i18n.t('roleLabels.soldier');
      default:
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : i18n.t('roleLabels.soldier');
    }
  }, [role, currentLanguage]);

  const skillLabelMap = useMemo(() => {
    const map = new Map();
    (skills || []).forEach((skill) => {
      map.set(skill.id, skill.name);
    });
    return map;
  }, [skills]);

  const selectedSkillLabels = useMemo(() => {
    return (selectedSkillIds || [])
      .map((id) => skillLabelMap.get(id))
      .filter(Boolean);
  }, [selectedSkillIds, skillLabelMap]);

  const toggleSkillSelection = (skillId) => {
    setSelectedSkillIds((prev) => {
      if (prev.includes(skillId)) {
        return prev.filter((id) => id !== skillId);
      }
      return [...prev, skillId];
    });
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert(i18n.t('error'), i18n.t('userNotFoundError'));
      return;
    }

    try {
      setSaving(true);
      const payload = {
        status,
        specialSkillIds: selectedSkillIds,
        role: role,
      };
      const response = await apiService.updateOperationalDetails(userId, payload);
      setStatus(response?.status || status);
      setSelectedSkillIds(Array.isArray(response?.specialSkillIds) ? response.specialSkillIds : selectedSkillIds);
      if (response?.role) setRole(response.role);
      Alert.alert(i18n.t('success'), i18n.t('operationalDetailsUpdateSuccess'));
    } catch (err) {
      console.error('[OperationDetailsScreen] save error:', err);
      Alert.alert(i18n.t('error'), err?.message || i18n.t('updateOperationalDetailsError'));
    } finally {
      setSaving(false);
    }
  };

  const renderSkillItem = ({ item }) => {
    const isSelected = selectedSkillIds.includes(item.id);
    return (
      <TouchableOpacity
        style={styles.skillOption}
        onPress={() => toggleSkillSelection(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.skillOptionLeft}>
          <Icon
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={isSelected ? green.primary : '#9CA3AF'}
          />
          <View>
            <Text style={styles.skillOptionLabel}>{item.name}</Text>
            {item.category ? <Text style={styles.skillOptionSubLabel}>{item.category}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={green.primary} />
        <Text style={styles.loadingText}>{i18n.t('loadingOperationalDetails')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>{i18n.t('operationalDetailsTitle')}</Text>

        {error ? (
          <View style={styles.errorCard}>
            <Icon name="warning" size={18} color="#F59E0B" />
            <Text style={styles.errorText}>{error || i18n.t('operationalDetailsError')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadOperationalDetails}>
              <Text style={styles.retryBtnText}>{i18n.t('tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{i18n.t('operationalRoleTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{i18n.t('operationalRoleSubtitle')}</Text>
          <View style={styles.detailRow}>
            <View style={styles.detailBadge}>
              <Icon name="shield-checkmark" size={18} color={green.primary} />
              <Text style={styles.detailBadgeText}>{formattedRole}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{i18n.t('specialSkillsTitle')}</Text>
          <Text style={styles.sectionSubtitle}>
            {i18n.t('specialSkillsSubtitle')}
          </Text>

          <View style={styles.skillChipContainer}>
            {selectedSkillLabels.length > 0 ? (
              selectedSkillLabels.map((label) => (
                <View key={label} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{label}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyStateText}>{i18n.t('noSkillsSelected')}</Text>
            )}
          </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.85}
            >
              <Icon name="options-outline" size={18} color={green.primary} />
              <Text style={styles.secondaryButtonText}>{i18n.t('selectSkills')}</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{i18n.t('statusTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{i18n.t('statusSubtitle')}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusLabelGroup}>
              <Text style={styles.statusLabel}>{i18n.t('status')}</Text>
              <Text style={styles.statusValue}>{i18n.t(status === 'active' ? 'active' : 'inactive')}</Text>
            </View>
            <Switch
              value={status === 'active'}
              onValueChange={(value) => setStatus(value ? 'active' : 'inactive')}
              trackColor={{ false: '#D1D5DB', true: green.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="save" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>{i18n.t('saveChanges')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('selectSpecialSkillsTitle')}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Icon name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={skills}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={renderSkillItem}
              ListEmptyComponent={
                <View style={styles.emptySkillsContainer}>
                  <Text style={styles.emptyStateText}>{i18n.t('noSkillsAvailable')}</Text>
                </View>
              }
            />
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={() => setPickerVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalPrimaryButtonText}>{i18n.t('done')}</Text>
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
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    gap: 8,
  },
  detailBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: green.primary,
    letterSpacing: 0.4,
  },
  skillChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  skillChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E0F2F1',
    borderRadius: 999,
  },
  skillChipText: {
    color: '#046C4E',
    fontWeight: '600',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabelGroup: {
    flexDirection: 'column',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  primaryButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: green.primary,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: green.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: green.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: green.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  skillOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  skillOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skillOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  skillOptionSubLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalPrimaryButton: {
    marginTop: 18,
    backgroundColor: green.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: green.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptySkillsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
});