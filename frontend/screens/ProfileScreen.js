import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, Switch, Alert, Modal, Platform, StatusBar, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomHeader from '../components/CustomHeader';
import SideDrawer from '../components/SideDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../NotificationContext';
import { apiService } from '../services/api';
import i18n, { setLocale, addLanguageChangeListener } from '../utils/i18n';
import { compressImageForUpload, createDataUri } from '../utils/imageCompression';
import * as Localization from 'expo-localization';
import { Card } from 'react-native-paper';
import * as Location from 'expo-location';
import { formatDistanceToNow } from 'date-fns';
// Geometry helpers for zone filtering
function pointInPolygon(point, polygon) {
  const x = point.latitude;
  const y = point.longitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude, yi = polygon[i].longitude;
    const xj = polygon[j].latitude, yj = polygon[j].longitude;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function inferZoneName(person, zones) {
  if (!person || typeof person.latitude !== 'number' || typeof person.longitude !== 'number') return null;
  const found = zones.find(z => Array.isArray(z.coordinates) && z.coordinates.length > 0 && pointInPolygon({ latitude: person.latitude, longitude: person.longitude }, z.coordinates));
  return found ? found.name : null;
}

export default function ProfileScreen({ navigation, route }) {
  // Disable Reports section globally
  const REPORTS_ENABLED = false;


  // Get user role from navigation params or use a default
  const [userRole, setUserRole] = useState(route.params?.userRole || 'soldier');
  const [userName, setUserName] = useState(route.params?.userName || 'Default User');
  const [userUnit, setUserUnit] = useState(route.params?.userUnit || 'Alpha');

  // Remove mock user data initialization
  const [userData, setUserData] = useState(null);
  const [soldierOverview, setSoldierOverview] = useState([]);
  const [soldierLoading, setSoldierLoading] = useState(false);
  const [soldierError, setSoldierError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Soldiers Report Filter States (only states here; derived values below where soldierReports exists)
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('all');
  const [selectedRankFilter, setSelectedRankFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [unitFilterVisible, setUnitFilterVisible] = useState(false);
  const [rankFilterVisible, setRankFilterVisible] = useState(false);
  const [statusFilterVisible, setStatusFilterVisible] = useState(false);

  // Soldier report derived data is declared after soldierReports state

  // Configure status bar
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  useLayoutEffect(() => {
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#f5f5f5');
      StatusBar.setTranslucent(false);
      // Ensure proper safe area handling on Android
      StatusBar.setHidden(false);
    }
  }, []);

  // Load actual user data from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const currentUserData = await AsyncStorage.getItem('currentUser');
        if (currentUserData) {
          const parsedUserData = JSON.parse(currentUserData);
          setUserRole(parsedUserData.role);
          setUserName(parsedUserData.name);
          setUserUnit(parsedUserData.unit);

          // Update the userData state with real data
          setUserData(parsedUserData);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Load saved language for display only (don't reset locale unnecessarily)
  useEffect(() => {
    (async () => {
      try {
        const lang = await AsyncStorage.getItem('appLanguage');
        // Only use supported languages: English, Hindi, Tamil
        const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'];
        if (lang && typeof lang === 'string' && SUPPORTED_LANGUAGES.includes(lang)) {
          setSelectedLanguage(lang);
          // Only update locale if it's different from current to avoid resets
          if (i18n.locale !== lang) {
            setLocale(lang);
          }
        } else if (lang && !SUPPORTED_LANGUAGES.includes(lang)) {
          // If saved language is not supported, reset to English
          setSelectedLanguage('en');
          await AsyncStorage.setItem('appLanguage', 'en');
          if (i18n.locale !== 'en') {
            setLocale('en');
          }
        }
      } catch { }
    })();
  }, []);

  const handleSelectLanguage = async (code) => {
    try {
      // Only allow supported languages: English, Hindi, Tamil
      const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'];
      if (SUPPORTED_LANGUAGES.includes(code)) {
        setSelectedLanguage(code);
        await AsyncStorage.setItem('appLanguage', code);
        setLocale(code);
      }
    } catch { }
  };

  // Fetch personal and military information once on mount (no polling)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const currentUserData = await AsyncStorage.getItem('currentUser');
        if (!isMounted || !currentUserData) return;
        const parsedUserData = JSON.parse(currentUserData);
        const username = parsedUserData.username || parsedUserData.serviceId;
        if (!username) return;
        const freshUser = await apiService.getUserByUsername(username);
        if (!isMounted) return;
        if (freshUser && freshUser.name) {
          setUserData(freshUser);
          setTempUserData(freshUser);
        }
      } catch { }
    })();
    return () => { isMounted = false; };
  }, []);

  // Fetch soldiers by unit_id matching commander's unit_id
  useEffect(() => {
    const fetchSoldiersOverview = async (showLoader = false) => {
      if (userData && userData.role === 'commander' && userData.unit_id) {
        if (showLoader) setSoldierLoading(true);
        setSoldierError(null);
        try {
          console.log('[ProfileScreen] Fetching soldiers for commander unit_id:', userData.unit_id);
          // Fetch soldiers by unit_id, sorted alphabetically by name
          const soldiers = await apiService.getSoldiersByUnitId(userData.unit_id, 'name');
          console.log('[ProfileScreen] Loaded soldiers:', soldiers?.length || 0);
          setSoldierOverview(Array.isArray(soldiers) ? soldiers : []);
        } catch (err) {
          console.error('[ProfileScreen] Error fetching soldiers:', err);
          setSoldierError('Failed to fetch soldiers.');
          setSoldierOverview([]);
        } finally {
          if (showLoader) setSoldierLoading(false);
          setInitialLoad(false);
        }
      } else if (userData && userData.role === 'commander' && userData.unit && !userData.unit_id) {
        // Fallback: if unit_id is not available, use unit name (backward compatibility)
        console.warn('[ProfileScreen] Commander has unit name but no unit_id, using fallback');
        if (showLoader) setSoldierLoading(true);
        setSoldierError(null);
        try {
          const allUsers = await apiService.getAllUsers();
          const unitNorm = String(userData.unit || '').trim().toLowerCase();
          const unitSoldiers = (allUsers || []).filter(u =>
            String(u.role || '').trim().toLowerCase() === 'soldier' &&
            String(u.unit || '').trim().toLowerCase() === unitNorm
          );
          // Sort alphabetically by name
          unitSoldiers.sort((a, b) => {
            const nameA = (a.name || a.username || '').toLowerCase();
            const nameB = (b.name || b.username || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          setSoldierOverview(unitSoldiers);
        } catch (err) {
          console.error('[ProfileScreen] Error fetching soldiers (fallback):', err);
          setSoldierError('Failed to fetch soldiers.');
          setSoldierOverview([]);
        } finally {
          if (showLoader) setSoldierLoading(false);
          setInitialLoad(false);
        }
      }
    };
    fetchSoldiersOverview(true); // Show loader on initial load
  }, [userData]);

  const refreshSoldierOverview = async () => {
    if (userData && userData.role === 'commander' && userData.unit_id) {
      setSoldierLoading(true);
      setSoldierError(null);
      try {
        console.log('[ProfileScreen] Refreshing soldiers for commander unit_id:', userData.unit_id);
        const soldiers = await apiService.getSoldiersByUnitId(userData.unit_id, 'name');
        console.log('[ProfileScreen] Refreshed soldiers:', soldiers?.length || 0);
        setSoldierOverview(Array.isArray(soldiers) ? soldiers : []);
      } catch (err) {
        console.error('[ProfileScreen] Error refreshing soldiers:', err);
        setSoldierError('Failed to fetch soldiers.');
        setSoldierOverview([]);
      } finally {
        setSoldierLoading(false);
      }
    } else if (userData && userData.role === 'commander' && userData.unit && !userData.unit_id) {
      // Fallback: use unit name
      setSoldierLoading(true);
      setSoldierError(null);
      try {
        const allUsers = await apiService.getAllUsers();
        const unitNorm = String(userData.unit || '').trim().toLowerCase();
        const unitSoldiers = (allUsers || []).filter(u =>
          String(u.role || '').trim().toLowerCase() === 'soldier' &&
          String(u.unit || '').trim().toLowerCase() === unitNorm
        );
        // Sort alphabetically by name
        unitSoldiers.sort((a, b) => {
          const nameA = (a.name || a.username || '').toLowerCase();
          const nameB = (b.name || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setSoldierOverview(unitSoldiers);
      } catch (err) {
        console.error('[ProfileScreen] Error refreshing soldiers (fallback):', err);
        setSoldierError('Failed to fetch soldiers.');
        setSoldierOverview([]);
      } finally {
        setSoldierLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh user data
      const currentUserData = await AsyncStorage.getItem('currentUser');
      if (currentUserData) {
        const parsedUserData = JSON.parse(currentUserData);
        const username = parsedUserData.username || parsedUserData.serviceId;
        if (username) {
          const freshUser = await apiService.getUserByUsername(username);
          if (freshUser && freshUser.name) {
            setUserData(freshUser);
            setTempUserData(freshUser);
            // Update AsyncStorage with fresh data
            const updatedToSave = { ...freshUser };
            delete updatedToSave.photo;
            delete updatedToSave.profileImage;
            await AsyncStorage.setItem('currentUser', JSON.stringify(updatedToSave));
          }
        }
      }

      // Refresh soldier overview if commander
      await refreshSoldierOverview();

      // Refresh notifications if commander
      if (refreshNotifications) {
        await refreshNotifications();
      }
    } catch (error) {
      console.error('[ProfileScreen] Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Helper functions for user data
  function getRoleServiceId(role) {
    switch (role) {
      case 'unitAdmin': return 'UA-3000';
      case 'commander': return 'C-4000';
      case 'soldier': return 'S-5000';
      default: return 'S-0000';
    }
  }

  function getRoleRank(role) {
    switch (role) {
      case 'unitAdmin': return 'Captain';
      case 'commander': return 'Lieutenant';
      case 'soldier': return 'Private';
      default: return 'Recruit';
    }
  }

  function getRoleClearanceLevel(role) {
    switch (role) {
      case 'unitAdmin': return 'Level 4';
      case 'commander': return 'Level 3';
      case 'soldier': return 'Level 2';
      default: return 'Level 1';
    }
  }

  const [editing, setEditing] = useState(false);
  const [tempUserData, setTempUserData] = useState(userData || {});

  useEffect(() => {
    // Keep temp data synced when userData loads/changes
    if (userData && Object.keys(userData).length > 0) {
      setTempUserData(prev => ({ ...prev, ...userData }));
    }
  }, [userData]);

  // State for expanded soldier card in overview
  const [expandedSoldierId, setExpandedSoldierId] = useState(null);

  // State for active tab
  const [activeTab, setActiveTab] = useState(route.params?.initialTab || 'profile'); // 'profile', 'notifications', 'soldiers'

  // State for side drawer
  const [sideDrawerVisible, setSideDrawerVisible] = useState(false);

  // Update activeTab if initialTab param changes (e.g., on navigation)
  useEffect(() => {
    if (route.params?.initialTab && route.params.initialTab !== activeTab) {
      // Prevent selecting disabled 'reports' from outside
      const next = route.params.initialTab === 'reports' ? 'profile' : route.params.initialTab;
      setActiveTab(next);
    }
  }, [route.params?.initialTab]);

  // If commander, avoid showing Profile first; jump to Alerts by default
  useEffect(() => {
    const role = String(userData?.role || '').trim().toLowerCase();
    if (role === 'commander' && activeTab === 'profile') {
      setActiveTab('notifications');
    }
  }, [userData, activeTab]);

  // Remove mock reports data
  const [reports, setReports] = useState([]);

  // Use notifications context
  const {
    notifications = [],
    unreadCount = 0,
    markAsRead,
    markAllAsRead,
    clearAll,
    clearRead,
    refreshNotifications,
    stopAlertSound
  } = useNotifications();

  // Database is linked – persist edits to backend
  const isDatabaseLinked = true;

  // Function to handle saving user profile changes
  const saveProfileChanges = async () => {
    try {
      if (!userData?.id) {
        Alert.alert('Error', 'Missing User Login ID. Please login again.');
        return;
      }
      const payload = {
        username: tempUserData.username,
        name: tempUserData.name,
        email: tempUserData.email,
        phone: tempUserData.phone,
      };
      // Clean undefined fields
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      let updated = {};
      if (isDatabaseLinked) {
        updated = await apiService.updateUser(userData.id, payload);
      } else {
        updated = { ...userData, ...payload };
      }

      // Persist session user and update local UI
      try {
        const stored = await AsyncStorage.getItem('currentUser');
        const curr = stored ? JSON.parse(stored) : {};
        const merged = { ...curr, ...updated };
        const mergedToSave = { ...merged };
        delete mergedToSave.photo;
        delete mergedToSave.profileImage;
        await AsyncStorage.setItem('currentUser', JSON.stringify(mergedToSave));
        setUserData(merged);
        setUserName(merged.name);
      } catch { }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile changes:', error);
      Alert.alert('Error', error?.message || 'Failed to save profile changes');
    }
    setEditing(false);
  };

  const toggleEditing = () => {
    if (editing) {
      // Save changes
      Alert.alert(
        "Save Changes",
        "Are you sure you want to save these changes?",
        [
          {
            text: i18n.t('cancel'),
            style: "cancel"
          },
          {
            text: i18n.t('save'),
            onPress: saveProfileChanges
          }
        ]
      );
    } else {
      setTempUserData({ ...userData });
      setEditing(true);
    }
  };

  const handleInputChange = (field, value) => {
    // Allow editing of safe fields
    const allowed = ['username', 'name', 'email', 'phone'];
    if (!allowed.includes(field)) return;
    setTempUserData(prev => ({ ...prev, [field]: value }));
  };



  // Change profile photo: pick image and upload base64 to backend, then update local state
  const handleChangePhoto = async () => {
    try {
      if (!userData?.id) {
        Alert.alert('Error', 'Missing User Login ID. Please login again.');
        return;
      }

      // Use the image compression utility — min 10 KB, max 100 KB
      const compressedImage = await compressImageForUpload({
        minSizeBytes: 10 * 1024,  // 10 KB minimum
        maxSizeBytes: 50 * 1024, // 50 KB maximum
        initialQuality: 0.7,
        maxAttempts: 5,
        aspect: [1, 1],
        allowsEditing: true
      });

      if (!compressedImage) {
        return; // User cancelled or compression failed
      }

      // Create data URI
      const dataUri = createDataUri(compressedImage);

      // Show loading indicator
      Alert.alert('Uploading', 'Please wait while your photo is being uploaded...', [], { cancelable: false });

      // Upload to backend with data URI (server normalizes to raw base64)
      await apiService.updateUserPhoto(userData.id, dataUri);

      // Update local cached user with data URI for direct rendering
      const updated = { ...(userData || {}), photo: dataUri };
      setUserData(updated);
      const updatedToSave = { ...updated };
      delete updatedToSave.photo;
      delete updatedToSave.profileImage;
      await AsyncStorage.setItem('currentUser', JSON.stringify(updatedToSave));

      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (e) {
      console.error('Change photo error:', e);

      // Handle specific error types
      if (e.message && e.message.includes('413')) {
        Alert.alert('Error', 'Image is too large. Please select a smaller image.');
      } else if (e.message && e.message.includes('Network')) {
        Alert.alert('Error', 'Network error. Please check your connection and try again.');
      } else {
        Alert.alert('Error', e?.message || 'Failed to update profile photo. Please try again.');
      }
    }
  };

  const getIconName = (type) => {
    switch (type) {
      case 'emergency':
        return 'warning';
      case 'warning':
        return 'alert-circle';
      case 'info':
        return 'information-circle';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'emergency':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'info':
        return '#2196F3';
      default:
        return '#757575';
    }
  };



  // Soldier Overview Card
  const renderSoldierCard = ({ item }) => (
    <View style={styles.soldierCard}>
      <Text style={styles.soldierName}>{item.name} ({item.username})</Text>
      <Text style={styles.soldierUnit}>Unit: {item.unit}</Text>
      <View style={styles.soldierSection}>
        <Text style={styles.soldierSectionTitle}>Current Location</Text>
        {item.location ? (
          <Text style={styles.soldierSectionText}>
            Latitude: {item.location.latitude}, Longitude: {item.location.longitude} {'\n'}
            Time: {item.location.recorded_at ? new Date(item.location.recorded_at).toLocaleString() : 'N/A'}
          </Text>
        ) : (
          <Text style={styles.soldierSectionText}>No location data</Text>
        )}
      </View>
      <View style={styles.soldierSection}>
        <Text style={styles.soldierSectionTitle}>Health Vitals</Text>
        {item.health ? (
          <Text style={styles.soldierSectionText}>
            HDL: {item.health.hdl ?? 'N/A'}, LDL: {item.health.ldl ?? 'N/A'} {'\n'}
            Blood Sugar: {item.health.blood_sugar ?? 'N/A'} {'\n'}
            Major Alignment: {item.health.major_alignment ?? 'N/A'}
          </Text>
        ) : (
          <Text style={styles.soldierSectionText}>No health data</Text>
        )}
      </View>
      <View style={styles.soldierSection}>
        <Text style={styles.soldierSectionTitle}>Assigned Tasks / Operation</Text>
        {item.operation ? (
          <Text style={styles.soldierSectionText}>
            Role: {item.operation.observation_role ?? 'N/A'} {'\n'}
            Skills: {item.operation.special_skills ? item.operation.special_skills.join(', ') : 'N/A'} {'\n'}
            Status: {item.operation.status ?? 'N/A'}
          </Text>
        ) : (
          <Text style={styles.soldierSectionText}>No operation/task data</Text>
        )}
      </View>
    </View>
  );

  const renderProfileContent = () => {
    const unifiedCardStyle = {
      backgroundColor: '#E8F5E9', // A light green background
      borderRadius: 12,
      padding: 20,
      marginHorizontal: 15,
      marginVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    };

    return (
      <View style={styles.scrollContainer}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileHeaderContent}>
            {/* Profile Image on Left */}
            <View style={styles.profileImageContainer}>
              {userData && (userData.photo || userData.profileImage) ? (
                <Image
                  source={{ uri: userData.photo?.startsWith('data:') ? userData.photo : (userData.photo ? `data:image/jpeg;base64,${userData.photo}` : userData.profileImage) }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Icon name="person" size={50} color="#fff" />
                </View>
              )}
              <View style={styles.badgeContainer}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{userData && userData.role ? getRoleName(userData.role) : ''}</Text>
                </View>
              </View>
            </View>

            {/* Soldier Info on Right */}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{userData && userData.name ? userData.name : ''}</Text>
              <Text style={styles.serviceId}>
                {userData && userData.serviceId ? `${i18n.t('serviceIdLabel')}: ${userData.serviceId}` : ''}
              </Text>
              <View style={styles.unitInfo}>
                <Icon name="people" size={16} color="#2E3192" />
                <Text style={styles.unitText}>
                  {userData && userData.unit ? `${userData.unit} ${i18n.t('unit')}` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.editButton} onPress={toggleEditing}>
              <Icon name={editing ? "save" : "create-outline"} size={20} color="#fff" />
              <Text style={styles.editButtonText}>{editing ? i18n.t('save') : i18n.t('editProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editButton, { backgroundColor: '#4CAF50' }]} onPress={handleChangePhoto}>
              <Icon name="camera" size={20} color="#fff" />
              <Text style={styles.editButtonText}>{i18n.t('changePhoto')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Soldier Information */}
        <View style={[styles.section, { borderWidth: 1, borderColor: '#e9ecf1', borderRadius: 12, padding: 12 }]}>
          <Text style={[styles.sectionTitle, { color: '#2E3192', marginBottom: 8 }]}>{i18n.t('soldierInformation')}</Text>

          {userData ? (
            <View style={[styles.infoContainer, { backgroundColor: '#fff' }]}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('employeeId')}:`}</Text>
                <Text style={styles.infoValue}>{userData.EmployeeID || userData.id || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('username')}:`}</Text>
                {editing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={tempUserData.username}
                    onChangeText={(value) => handleInputChange('username', value)}
                    placeholder={i18n.t('username')}
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                  />
                ) : (
                  <Text style={styles.infoValue}>{userData.username || '-'}</Text>
                )}
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('name')}:`}</Text>
                {editing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={tempUserData.name}
                    onChangeText={(value) => handleInputChange('name', value)}
                    placeholder={i18n.t('name')}
                    placeholderTextColor="#999"
                  />
                ) : (
                  <Text style={styles.infoValue}>{userData.name || '-'}</Text>
                )}
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('role')}:`}</Text>
                <Text style={styles.infoValue}>{getRoleName(userData.role) || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('email')}:`}</Text>
                <Text style={styles.infoValue}>{userData.email || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('unit')}:`}</Text>
                <Text style={styles.infoValue}>{userData.unit || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('category')}:`}</Text>
                <Text style={styles.infoValue}>{userData.category || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('mobileNumber')}:`}</Text>
                <Text style={styles.infoValue}>{
                  (userData && (userData.MobileNumber || userData.phone || userData.mobile || userData.mobile_number))
                    ? (userData.MobileNumber || userData.phone || userData.mobile || userData.mobile_number)
                    : '-'
                }</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('createdAt')}:`}</Text>
                <Text style={styles.infoValue}>
                  {userData && userData.created_at
                    ? new Date(userData.created_at).toLocaleDateString() + ' ' + new Date(userData.created_at).toLocaleTimeString()
                    : '-'
                  }
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('lastLoginAttempt')}:`}</Text>
                <Text style={styles.infoValue}>
                  {userData && userData.last_login_attempt
                    ? new Date(userData.last_login_attempt).toLocaleDateString() + ' ' + new Date(userData.last_login_attempt).toLocaleTimeString()
                    : '-'
                  }
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('lastLoginSuccess')}:`}</Text>
                <Text style={styles.infoValue}>
                  {userData && userData.last_login_success
                    ? new Date(userData.last_login_success).toLocaleDateString() + ' ' + new Date(userData.last_login_success).toLocaleTimeString()
                    : '-'
                  }
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('latitude')}:`}</Text>
                <Text style={styles.infoValue}>
                  {userData && userData.latitude !== null && userData.latitude !== undefined
                    ? userData.latitude.toString()
                    : '-'
                  }
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('longitude')}:`}</Text>
                <Text style={styles.infoValue}>
                  {userData && userData.longitude !== null && userData.longitude !== undefined
                    ? userData.longitude.toString()
                    : '-'
                  }
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{`${i18n.t('commander')}:`}</Text>
                <Text style={styles.infoValue}>{commanderName}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{i18n.t('noSoldierInfo')}</Text>
            </View>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setLogoutModalVisible(true)}
        >
          <Icon name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>{i18n.t('logout')}</Text>
        </TouchableOpacity>

        {/* Logout Confirm Modal */}
        <Modal
          visible={logoutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLogoutModalVisible(false)}
        >
          <View style={styles.logoutModalBackdrop}>
            <View style={styles.logoutModalCard}>
              <Text style={styles.logoutModalTitle}>{i18n.t('logoutConfirmTitle')}</Text>
              <Text style={styles.logoutModalSubtitle}>{i18n.t('logoutConfirmMessage')}</Text>

              <View style={styles.logoutModalActionsRow}>
                <TouchableOpacity
                  style={[styles.logoutModalActionButton, styles.logoutModalSecondaryButton]}
                  activeOpacity={0.8}
                  onPress={() => setLogoutModalVisible(false)}
                >
                  <Text style={styles.logoutModalSecondaryText}>{(i18n.t && i18n.t('cancel')) ? i18n.t('cancel').toUpperCase() : 'CANCEL'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.logoutModalActionButton, styles.logoutModalPrimaryButton]}
                  activeOpacity={0.8}
                  onPress={async () => {
                    setLogoutModalVisible(false);
                    try {
                      if (stopAlertSound) stopAlertSound();
                      if (clearAll) clearAll();
                      await AsyncStorage.removeItem('currentUser');
                      if (navigation && navigation.reset) {
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                      } else {
                        navigation.navigate('Login');
                      }
                    } catch (error) {
                      console.error('Error logging out:', error);
                    }
                  }}
                >
                  <Text style={styles.logoutModalPrimaryText}>{(i18n.t && i18n.t('logout')) ? i18n.t('logout').toUpperCase() : 'LOGOUT'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    );
  };

  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState(null);
  const [alertsRefreshing, setAlertsRefreshing] = useState(false);
  const [alertFilter, setAlertFilter] = useState('all'); // all|critical|high|medium|low

  // Commander reports filters
  const [isCommander, setIsCommander] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('soldier');
  const [soldierReports, setSoldierReports] = useState([]);
  const [operationReports, setOperationReports] = useState([]);
  const [ammoReports, setAmmoReports] = useState([]);
  const [alertsReports, setAlertsReports] = useState([]);
  const [unitChangeReports, setUnitChangeReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  // Zones for Soldier Report filtering by commander's zone
  const [zonesForReports, setZonesForReports] = useState([]);
  const [commanderZones, setCommanderZones] = useState([]);

  // Safe dataset and memoized filter options for Soldier Report
  const safeSoldierReports = Array.isArray(soldierReports) ? soldierReports : [];
  const unitFilterOptions = useMemo(() => {
    const units = Array.from(new Set(safeSoldierReports.map(s => s.unit).filter(Boolean)));
    return ['all', ...units];
  }, [safeSoldierReports]);
  const rankFilterOptions = useMemo(() => {
    const ranks = Array.from(new Set(safeSoldierReports.map(s => s.rank).filter(Boolean)));
    return ['all', ...ranks];
  }, [safeSoldierReports]);
  const statusFilterOptions = ['all', 'Active', 'Inactive'];

  const filteredSoldierReports = useMemo(() => {
    return safeSoldierReports.filter(soldier => {
      const unitMatch = selectedUnitFilter === 'all' || soldier.unit === selectedUnitFilter;
      const rankMatch = selectedRankFilter === 'all' || soldier.rank === selectedRankFilter;
      const statusMatch = selectedStatusFilter === 'all' || (soldier.status || 'Active') === selectedStatusFilter;
      return unitMatch && rankMatch && statusMatch;
    });
  }, [safeSoldierReports, selectedUnitFilter, selectedRankFilter, selectedStatusFilter]);

  const fetchAlerts = async () => {
    try {
      setAlertsError(null);
      const data = await apiService.getAlerts();
      const alertsArray = Array.isArray(data) ? data : [];
      setAlerts(alertsArray);
    } catch (e) {
      setAlertsError('Failed to load alerts.');
    } finally {
      setAlertsLoading(false);
      setAlertsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch alerts for all users to show count in header
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications') {
      setAlertsLoading(true);
      fetchAlerts();
    }
  }, [activeTab]);

  const onRefreshAlerts = () => {
    setAlertsRefreshing(true);
    fetchAlerts();
  };

  const getAlertIcon = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'emergency':
        return 'warning';
      case 'zone_breach':
        return 'map';
      case 'assignment':
        return 'clipboard-outline';
      case 'system':
      default:
        return 'information-circle';
    }
  };

  const getSeverityColor = (severity) => {
    switch ((severity || '').toLowerCase()) {
      case 'critical':
        return '#F44336';
      case 'high':
        return '#FF9800';
      case 'medium':
        return '#FFC107';
      case 'low':
      default:
        return '#2196F3';
    }
  };

  const formatAlertTime = (ts) => {
    try {
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return '-';
    }
  };

  // Translation helper with graceful fallback (avoids showing "[Missing ... Translation]")
  const tr = (key, fallback) => {
    try {
      const value = i18n.t(key);
      if (!value) return fallback;
      const text = String(value);
      if (/\[Missing.*Translation\]/i.test(text) || text.toLowerCase() === String(key).toLowerCase()) {
        return fallback;
      }
      return text;
    } catch {
      return fallback;
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (alertFilter === 'all') return true;
    return (a.severity || '').toLowerCase() === alertFilter;
  });

  const renderNotificationsContent = () => {
    const criticalCount = alerts.filter(a => (a.severity || '').toLowerCase() === 'critical').length;
    return (
      <View style={styles.tabContent}>
        {/* Header with filter chips */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#F44336', fontWeight: 'bold' }}>{tr('criticalAlerts', 'Critical Alerts')}: {criticalCount}</Text>
            <TouchableOpacity onPress={onRefreshAlerts} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
              <Text style={{ color: '#2E3192', fontWeight: 'bold' }}>{tr('refreshNotifications', 'Refresh Notifications')}</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={[
              { key: 'all', label: tr('all', 'All') },
              { key: 'critical', label: tr('critical', 'Critical') },
              { key: 'high', label: tr('high', 'High') },
              { key: 'medium', label: tr('medium', 'Medium') },
              { key: 'low', label: tr('low', 'Low') },
            ]}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 12 }}
            style={{ marginTop: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setAlertFilter(item.key)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  backgroundColor: alertFilter === item.key ? '#2E3192' : '#f5f6fa',
                  borderRadius: 18,
                  marginRight: 10,
                  borderWidth: alertFilter === item.key ? 0 : 1,
                  borderColor: '#e1e4eb',
                }}
              >
                <Text style={{
                  color: alertFilter === item.key ? '#fff' : '#333',
                  fontWeight: '700',
                  fontSize: 13,
                  letterSpacing: 0.3,
                  textTransform: 'capitalize',
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={<View style={{ width: 12 }} />}
          />
        </View>

        {alertsLoading ? (
          <View style={styles.listContainer}><Text>{i18n.t('loading') || 'Loading...'}</Text></View>
        ) : alertsError ? (
          <View style={styles.listContainer}><Text style={{ color: 'red' }}>{alertsError}</Text></View>
        ) : filteredAlerts.length === 0 ? (
          <View style={styles.emptyContainer}><Text style={styles.emptyText}>{i18n.t('noNotifications') || 'No alerts found.'}</Text></View>
        ) : (
          <FlatList
            data={filteredAlerts}
            keyExtractor={item => item.id?.toString() || item.created_at || Math.random().toString()}
            refreshing={alertsRefreshing}
            onRefresh={onRefreshAlerts}
            renderItem={({ item }) => (
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 10,
                marginHorizontal: 12,
                marginVertical: 6,
                padding: 12,
                elevation: 2,
                shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
                borderLeftWidth: 4,
                borderLeftColor: getSeverityColor(item.severity),
              }}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f3ff', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <Icon name={getAlertIcon(item.alert_type)} size={20} color={getSeverityColor(item.severity)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#222' }}>{item.title || (item.alert_type || '').replace(/_/g, ' ').toUpperCase()}</Text>
                      <View style={[styles.soldierDetailAlertSeverity, { backgroundColor: getAlertSeverityColor(item.severity) }]}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{(item.severity || '').toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#555', marginTop: 4 }}>{item.message}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: '#888', fontSize: 12 }}>{formatAlertTime(item.created_at)}</Text>
                      <Text style={{ color: '#888', fontSize: 12 }}>{(item.status || 'active').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 80 }]}
          />
        )}
      </View>
    );
  };

  const [profileReports, setProfileReports] = useState([]);
  const [profileReportsLoading, setProfileReportsLoading] = useState(true);
  const [profileReportsError, setProfileReportsError] = useState(null);

  useEffect(() => {
    if (REPORTS_ENABLED && activeTab === 'reports') {
      setProfileReportsLoading(true);
      setProfileReportsError(null);
      apiService.getReports()
        .then(data => setProfileReports(data || []))
        .catch(() => setProfileReportsError('Failed to load reports.'))
        .finally(() => setProfileReportsLoading(false));
    }
  }, [activeTab]);

  // Detect commander role
  useEffect(() => {
    const role = String(userData?.role || '').trim().toLowerCase();
    setIsCommander(role === 'commander');
  }, [userData]);

  // Force-hide Reports tab for all roles
  useEffect(() => {
    if (activeTab === 'reports') {
      setActiveTab('profile');
    }
  }, [activeTab]);

  // Load commander categories
  useEffect(() => {
    const loadCommanderCategory = async () => {
      if (!(REPORTS_ENABLED && activeTab === 'reports' && isCommander)) return;
      setReportsLoading(true);
      setReportsError(null);
      try {
        if (selectedCategory === 'soldier') {
          const allUsers = await apiService.getAllUsers();
          const base = (allUsers || []).filter(u => String(u.role || '').trim().toLowerCase() === 'soldier');
          // Enrich with inferred zone using last known coordinates
          const enriched = base.map(s => ({ ...s, zoneName: inferZoneName(s, zonesForReports) }));
          // If we have commander zone(s), filter to only those soldiers inside
          const zoneFiltered = commanderZones && commanderZones.length > 0
            ? enriched.filter(s => commanderZones.includes(s.zoneName))
            : enriched;
          setSoldierReports(zoneFiltered);
        } else if (selectedCategory === 'operation') {
          const data = (profileReports || []).filter(r => String(r.type || '').toLowerCase() === 'history');
          setOperationReports(data);
        } else if (selectedCategory === 'ammo') {
          const data = (profileReports || []).filter(r => String(r.type || '').toLowerCase() === 'status');
          setAmmoReports(data);
        } else if (selectedCategory === 'alerts') {
          const data = await apiService.getAlerts();
          setAlertsReports(data || []);
        } else if (selectedCategory === 'unitChange') {
          setUnitChangeReports([]);
        }
      } catch (e) {
        setReportsError('Failed to load data.');
      } finally {
        setReportsLoading(false);
      }
    };
    loadCommanderCategory();
  }, [activeTab, isCommander, selectedCategory, userData, profileReports, zonesForReports, commanderZones]);

  // Load zones and compute commander's current zone(s) once when opening Reports as commander
  useEffect(() => {
    const loadZonesForReports = async () => {
      if (!(REPORTS_ENABLED && activeTab === 'reports' && isCommander)) return;
      try {
        const fetchedZones = await apiService.getZones();
        const formattedZones = (fetchedZones || []).map(zone => ({
          ...zone,
          name: zone.unit_name || zone.name || `Zone ${zone.id}`,
          coordinates: Array.isArray(zone.coordinates)
            ? zone.coordinates
              .map(pt => Array.isArray(pt) && pt.length === 2
                ? { latitude: Number(pt[0]), longitude: Number(pt[1]) }
                : pt
              )
              .filter(pt => pt && typeof pt.latitude === 'number' && !isNaN(pt.latitude) && typeof pt.longitude === 'number' && !isNaN(pt.longitude))
            : [],
          color: zone.color || '#009688',
        }));
        const uniqueZones = Array.from(new Map(formattedZones.map(z => [z.id, z])).values());
        setZonesForReports(uniqueZones);
        // DISABLED: Location permission request - using database location only
        // Commander zone determination disabled - not needed for database-based location
        /*
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            if (user.latitude && user.longitude) {
              const inside = zones.filter(z =>
                pointInPolygon(
                  { latitude: user.latitude, longitude: user.longitude },
                  z.coordinates
                )
              );
            }

            const myLat = loc?.coords?.latitude;
            const myLng = loc?.coords?.longitude;
            if (typeof myLat === 'number' && typeof myLng === 'number') {
              const inside = uniqueZones.filter(z => Array.isArray(z.coordinates) && z.coordinates.length > 0 && pointInPolygon({ latitude: myLat, longitude: myLng }, z.coordinates));
              const zoneNames = inside.map(z => z.name);
              setCommanderZones(zoneNames);
            }
          }
        } catch { }
        */
      } catch { }
    };
    loadZonesForReports();
  }, [activeTab, isCommander]);

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#F44336';
      case 'maintenance': return '#2196F3';
      default: return '#757575';
    }
  };
  const getEventIcon = (event) => {
    switch ((event || '').toLowerCase()) {
      case 'location update': return 'location';
      case 'battery warning': return 'battery-dead';
      case 'geofence exit': return 'exit';
      case 'connection lost': return 'cloud-offline';
      case 'maintenance started': return 'build';
      case 'status change': return 'refresh';
      default: return 'information-circle';
    }
  };
  const renderAssetStatusItem = ({ item }) => (
    <Card style={styles.statusCard}>
      <Card.Content>
        <View style={styles.statusHeader}>
          <View>
            <Text style={styles.assetId}>{item.assetId || item.id}</Text>
            <Text style={styles.assetName}>{item.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{i18n.t(item.status?.toLowerCase()) || item.status}</Text>
          </View>
        </View>
        <View style={styles.statusDetails}>
          <View style={styles.statusDetail}>
            <Icon name="battery-half" size={20} color="#757575" />
            <Text style={styles.detailText}>{item.battery ? `${item.battery}%` : '-'}</Text>
          </View>
          <View style={styles.statusDetail}>
            <Icon name="time" size={20} color="#757575" />
            <Text style={styles.detailText}>{item.lastUpdate || '-'}</Text>
          </View>
          <View style={styles.statusDetail}>
            <Icon name="location" size={20} color="#757575" />
            <Text style={styles.detailText}>{item.location || '-'}</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyIconContainer}>
        <Icon name={getEventIcon(item.event)} size={24} color="#2196F3" />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyEvent}>{item.event}</Text>
        <Text style={styles.historyAssetId}>{i18n.t('asset')}: {item.assetId || item.id}</Text>
        <Text style={styles.historyDetails}>{item.details}</Text>
        <Text style={styles.historyTimestamp}>{item.timestamp}</Text>
      </View>
    </View>
  );
  const assetStatusData = profileReports.filter(r => r.type === 'status');
  const historyData = profileReports.filter(r => r.type === 'history');
  const [profileReportsTab, setProfileReportsTab] = useState('status');

  const renderReportsContent = () => (
    <View style={styles.tabContent}>
      {/* Show same categories for both commanders and soldiers */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip label="Soldier Report" active={selectedCategory === 'soldier'} onPress={() => setSelectedCategory('soldier')} icon="people" />
          <FilterChip label="Operation Report" active={selectedCategory === 'operation'} onPress={() => setSelectedCategory('operation')} icon="construct" />
          <FilterChip label="Ammo & Equipment" active={selectedCategory === 'ammo'} onPress={() => setSelectedCategory('ammo')} icon="cube" />
          <FilterChip label="Alerts & Incidents" active={selectedCategory === 'alerts'} onPress={() => setSelectedCategory('alerts')} icon="alert-circle" />
          <FilterChip label="Unit Change Requests" active={selectedCategory === 'unitChange'} onPress={() => setSelectedCategory('unitChange')} icon="swap-horizontal" />
        </ScrollView>
      </View>

      {isCommander ? (
        <>
          {reportsLoading ? (
            <View style={styles.listContainer}><Text>{i18n.t('loading') || 'Loading...'}</Text></View>
          ) : reportsError ? (
            <View style={styles.listContainer}><Text style={{ color: 'red' }}>{reportsError}</Text></View>
          ) : selectedCategory === 'soldier' ? (
            <View style={styles.soldierReportContainer}>
              {/* Filters Section */}
              <View style={styles.filtersContainer}>
                <View style={styles.filterRow}>
                  <View style={styles.filterItem}>
                    <Text style={styles.filterLabel}>Unit:</Text>
                    <TouchableOpacity style={styles.dropdownButton} onPress={() => setUnitFilterVisible(true)}>
                      <Text style={styles.dropdownButtonText}>{selectedUnitFilter === 'all' ? 'All' : selectedUnitFilter}</Text>
                      <Icon name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.filterItem}>
                    <Text style={styles.filterLabel}>Rank:</Text>
                    <TouchableOpacity style={styles.dropdownButton} onPress={() => setRankFilterVisible(true)}>
                      <Text style={styles.dropdownButtonText}>{selectedRankFilter === 'all' ? 'All' : selectedRankFilter}</Text>
                      <Icon name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.filterItem}>
                    <Text style={styles.filterLabel}>Status:</Text>
                    <TouchableOpacity style={styles.dropdownButton} onPress={() => setStatusFilterVisible(true)}>
                      <Text style={styles.dropdownButtonText}>{selectedStatusFilter === 'all' ? 'All' : selectedStatusFilter}</Text>
                      <Icon name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Soldiers List + counts */}
              <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
                <Text style={{ color: '#666' }}>Loaded: {safeSoldierReports.length} • Matching filters: {filteredSoldierReports.length}</Text>
              </View>
              <FlatList
                data={filteredSoldierReports}
                keyExtractor={(item) => item.id?.toString() || item.username || Math.random().toString()}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
                style={{ flex: 1 }}
                ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 16, color: '#777' }}>No soldiers found.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('SoldierDetail', { soldier: item })}
                    style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginVertical: 6, elevation: 2 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#2E3192' }}>{item.name || '-'}</Text>
                        <Text style={{ color: '#666', marginTop: 2 }}>ID: {item.username || item.id || '-'}</Text>
                        <Text style={{ color: '#666', marginTop: 2 }}>Unit: {item.unit || '-'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'active') }]}>
                          <Text style={styles.statusText}>{(item.status || 'Active').toUpperCase()}</Text>
                        </View>
                        <Icon name="chevron-forward" size={20} color="#999" style={{ marginTop: 8 }} />
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />

              {/* Filter Dropdowns */}
              <Modal
                visible={unitFilterVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setUnitFilterVisible(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setUnitFilterVisible(false)}
                >
                  <View style={styles.dropdownModal}>
                    <Text style={styles.dropdownTitle}>Select Unit</Text>
                    {unitFilterOptions.map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setSelectedUnitFilter(unit);
                          setUnitFilterVisible(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          selectedUnitFilter === unit && styles.dropdownOptionTextSelected
                        ]}>
                          {unit === 'all' ? 'All' : unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>

              <Modal
                visible={rankFilterVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setRankFilterVisible(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setRankFilterVisible(false)}
                >
                  <View style={styles.dropdownModal}>
                    <Text style={styles.dropdownTitle}>Select Rank</Text>
                    {rankFilterOptions.map((rank) => (
                      <TouchableOpacity
                        key={rank}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setSelectedRankFilter(rank);
                          setRankFilterVisible(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          selectedRankFilter === rank && styles.dropdownOptionTextSelected
                        ]}>
                          {rank === 'all' ? 'All' : rank}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>

              <Modal
                visible={statusFilterVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setStatusFilterVisible(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setStatusFilterVisible(false)}
                >
                  <View style={styles.dropdownModal}>
                    <Text style={styles.dropdownTitle}>Select Status</Text>
                    {statusFilterOptions.map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setSelectedStatusFilter(status);
                          setStatusFilterVisible(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          selectedStatusFilter === status && styles.dropdownOptionTextSelected
                        ]}>
                          {status === 'all' ? 'All' : status}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          ) : selectedCategory === 'operation' ? (
            <FlatList
              data={operationReports}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={renderHistoryItem}
              ListEmptyComponent={<Text style={{ padding: 10 }}>No operation reports.</Text>}
            />
          ) : selectedCategory === 'ammo' ? (
            <FlatList
              data={ammoReports}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={renderAssetStatusItem}
              ListEmptyComponent={<Text style={{ padding: 10 }}>No ammo/equipment reports.</Text>}
            />
          ) : selectedCategory === 'alerts' ? (
            <FlatList
              data={alertsReports}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <Card style={styles.statusCard}>
                  <Card.Content>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Icon name={'alert-circle'} size={20} color="#F44336" style={{ marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold' }}>{item.category}</Text>
                        <Text style={{ color: '#555' }}>{item.message}</Text>
                        <Text style={{ color: '#999', fontSize: 12 }}>{item.created_at}</Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={<Text style={{ padding: 10 }}>No alerts.</Text>}
            />
          ) : (
            <View style={styles.listContainer}><Text>No unit change requests.</Text></View>
          )}
        </>
      ) : (
        // Soldier Coming Soon content
        <View style={styles.comingSoonContainer}>
          <Icon name="construct-outline" size={64} color="#2E3192" style={styles.comingSoonIcon} />
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonDescription}>
            {selectedCategory === 'soldier' && 'Soldier reports and status tracking will be available soon.'}
            {selectedCategory === 'operation' && 'Operation reports and mission tracking will be available soon.'}
            {selectedCategory === 'ammo' && 'Ammunition and equipment reports will be available soon.'}
            {selectedCategory === 'alerts' && 'Alert and incident reports will be available soon.'}
            {selectedCategory === 'unitChange' && 'Unit change request reports will be available soon.'}
          </Text>
          <View style={styles.comingSoonFeatures}>
            <Text style={styles.comingSoonFeaturesTitle}>Planned Features:</Text>
            {selectedCategory === 'soldier' && (
              <>
                <Text style={styles.comingSoonFeature}>• Personal status tracking</Text>
                <Text style={styles.comingSoonFeature}>• Location history reports</Text>
                <Text style={styles.comingSoonFeature}>• Performance metrics</Text>
                <Text style={styles.comingSoonFeature}>• Health status reports</Text>
              </>
            )}
            {selectedCategory === 'operation' && (
              <>
                <Text style={styles.comingSoonFeature}>• Mission participation history</Text>
                <Text style={styles.comingSoonFeature}>• Operation status updates</Text>
                <Text style={styles.comingSoonFeature}>• Task completion reports</Text>
                <Text style={styles.comingSoonFeature}>• Mission briefing access</Text>
              </>
            )}
            {selectedCategory === 'ammo' && (
              <>
                <Text style={styles.comingSoonFeature}>• Equipment status tracking</Text>
                <Text style={styles.comingSoonFeature}>• Ammunition usage reports</Text>
                <Text style={styles.comingSoonFeature}>• Maintenance schedules</Text>
                <Text style={styles.comingSoonFeature}>• Inventory management</Text>
              </>
            )}
            {selectedCategory === 'alerts' && (
              <>
                <Text style={styles.comingSoonFeature}>• Personal alert history</Text>
                <Text style={styles.comingSoonFeature}>• Emergency notifications</Text>
                <Text style={styles.comingSoonFeature}>• Incident reports</Text>
                <Text style={styles.comingSoonFeature}>• Safety alerts</Text>
              </>
            )}
            {selectedCategory === 'unitChange' && (
              <>
                <Text style={styles.comingSoonFeature}>• Transfer request status</Text>
                <Text style={styles.comingSoonFeature}>• Unit change history</Text>
                <Text style={styles.comingSoonFeature}>• Assignment updates</Text>
                <Text style={styles.comingSoonFeature}>• Transfer notifications</Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );

  // Add a renderSoldiersContent function for the full-page view
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [soldierModalVisible, setSoldierModalVisible] = useState(false);
  const [editSoldierVisible, setEditSoldierVisible] = useState(false);
  const [editSoldierForm, setEditSoldierForm] = useState({ name: '', email: '', unit: '', MobileNumber: '' });
  const [savingSoldier, setSavingSoldier] = useState(false);
  const [soldierDetailModalVisible, setSoldierDetailModalVisible] = useState(false);
  const [selectedSoldierForDetail, setSelectedSoldierForDetail] = useState(null);
  const [soldierDetailVitals, setSoldierDetailVitals] = useState(null);
  const [soldierDetailVitalsLoading, setSoldierDetailVitalsLoading] = useState(false);
  const [soldierDetailLocation, setSoldierDetailLocation] = useState(null);
  const [soldierDetailTasks, setSoldierDetailTasks] = useState(null);

  const openEditSoldier = (soldier) => {
    setSelectedSoldier(soldier);
    setEditSoldierForm({
      name: soldier.name || '',
      email: soldier.email || '',
      unit: soldier.unit || '',
      MobileNumber: soldier.MobileNumber || soldier.phone || soldier.mobile || '',
    });
    setEditSoldierVisible(true);
  };

  const resetEditSoldierForm = () => {
    setEditSoldierForm({
      name: '',
      email: '',
      unit: '',
      MobileNumber: '',
    });
    setSelectedSoldier(null);
  };

  const validateEditSoldierForm = () => {
    if (!editSoldierForm.name || editSoldierForm.name.trim().length === 0) {
      Alert.alert('Validation Error', 'Name is required');
      return false;
    }
    if (editSoldierForm.email && !editSoldierForm.email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }
    if (!editSoldierForm.unit || editSoldierForm.unit.trim().length === 0) {
      Alert.alert('Validation Error', 'Unit is required');
      return false;
    }
    return true;
  };

  const saveEditSoldier = async () => {
    if (!validateEditSoldierForm()) return;

    setSavingSoldier(true);
    try {
      if (!selectedSoldier?.id) {
        Alert.alert('Error', 'Soldier ID not found');
        return;
      }

      // Prepare the payload with only the fields that have values
      const payload = {};
      if (editSoldierForm.name.trim()) payload.name = editSoldierForm.name.trim();
      if (editSoldierForm.email.trim()) payload.email = editSoldierForm.email.trim();
      if (editSoldierForm.unit.trim()) payload.unit = editSoldierForm.unit.trim();
      if (editSoldierForm.MobileNumber.trim()) payload.MobileNumber = editSoldierForm.MobileNumber.trim();

      console.log('Updating soldier with payload:', payload);
      console.log('Soldier ID:', selectedSoldier.id);

      const updated = await apiService.updateUser(selectedSoldier.id, payload);
      console.log('Update response:', updated);

      // Persist latest user to AsyncStorage if this is the logged-in user
      try {
        const stored = await AsyncStorage.getItem('currentUser');
        if (stored) {
          const curr = JSON.parse(stored);
          if (curr && Number(curr.id) === Number(selectedSoldier.id)) {
            const merged = { ...curr, ...updated };
            const mergedToSave = { ...merged };
            delete mergedToSave.photo;
            delete mergedToSave.profileImage;
            await AsyncStorage.setItem('currentUser', JSON.stringify(mergedToSave));
            setUserData(merged);
          }
        }
      } catch { }

      // Update local list with server response when available
      setSoldierOverview(prev => (prev || []).map(s => s.id === selectedSoldier.id ? { ...s, ...updated } : s));

      setEditSoldierVisible(false);
      resetEditSoldierForm();
      Alert.alert('Success', 'Soldier updated successfully');
    } catch (error) {
      console.error('Update soldier error:', error);
      Alert.alert('Error', `Failed to update soldier: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingSoldier(false);
    }
  };
  const handleSoldierPress = async (soldier) => {
    setSelectedSoldierForDetail(soldier);
    setSoldierDetailModalVisible(true);
    setSoldierDetailVitalsLoading(true);

    // Fetch all additional data for this soldier
    if (soldier.id || soldier.username) {
      try {
        const soldierId = soldier.id || soldier.username;
        console.log('[ProfileScreen] Fetching detail data for soldier:', soldierId);

        // Fetch health vitals
        const vitals = await apiService.getHealthVitals(soldierId);
        console.log('[ProfileScreen] Fetched detail vitals:', vitals);
        setSoldierDetailVitals(vitals);

        // Set location from survival_table (comes with vitals) or soldier data
        if (vitals && (vitals.latitude && vitals.longitude)) {
          setSoldierDetailLocation({
            latitude: parseFloat(vitals.latitude),
            longitude: parseFloat(vitals.longitude),
            timestamp: vitals.recorded_at
          });
        } else if (soldier.latitude && soldier.longitude) {
          setSoldierDetailLocation({
            latitude: parseFloat(soldier.latitude),
            longitude: parseFloat(soldier.longitude),
            timestamp: soldier.lastUpdate || soldier.last_active
          });
        } else {
          setSoldierDetailLocation(null);
        }

        // Fetch soldier assignments from assignments table
        try {
          console.log('[ProfileScreen] Fetching assignments for unit:', userData.unit_id);
          console.log('[ProfileScreen] Commander unit data:', {
            unit_id: userData.unit_id,
            unit_name: userData.unit,
            id: userData.id
          });

          // Get all assignments for the unit (assignments are assigned to units, not individual soldiers)
          const assignments = await apiService.getAssignments({
            unitId: userData.unit_id // Only unitId is needed/supported
          });

          console.log('[ProfileScreen] API Response - Raw assignments:', assignments);
          console.log('[ProfileScreen] API Response - Type:', typeof assignments);
          console.log('[ProfileScreen] API Response - Length:', assignments?.length);

          if (assignments && Array.isArray(assignments) && assignments.length > 0) {
            console.log('[ProfileScreen] Processing', assignments.length, 'assignments');
            assignments.forEach((assignment, index) => {
              console.log(`[ProfileScreen] Assignment ${index + 1} details:`, {
                assignment_id: assignment.assignment_id,
                assignment_name: assignment.assignment_name,
                brief_description: assignment.brief_description,
                type: assignment.type,
                priority: assignment.priority,
                destination: assignment.destination,
                status: assignment.status,
                unit_id: assignment.unit_id,
                allKeys: Object.keys(assignment)
              });
            });
          } else {
            console.log('[ProfileScreen] No assignments found or invalid response');
          }

          setSoldierDetailTasks(assignments || []);
        } catch (assignmentError) {
          console.error('[ProfileScreen] Error fetching assignments:', assignmentError);
          console.error('[ProfileScreen] Error details:', assignmentError.message);
          setSoldierDetailTasks([]);
        }

      } catch (error) {
        console.error('[ProfileScreen] Error fetching detail data:', error);
        setSoldierDetailVitals(null);
        setSoldierDetailLocation(null);
        setSoldierDetailTasks([]);
      } finally {
        setSoldierDetailVitalsLoading(false);
      }
    } else {
      setSoldierDetailVitalsLoading(false);
      setSoldierDetailLocation(null);
      setSoldierDetailTasks([]);
    }
  };

  // Helper function to get role name
  const getRoleName = (role) => {
    switch (role) {
      case 'unitAdmin': return i18n.t('roleLabels.unitAdmin');
      case 'commander': return i18n.t('roleLabels.commander');
      case 'soldier': return i18n.t('roleLabels.soldier');
      default: return i18n.t('roleLabels.unknown');
    }
  };

  const getTaskStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return '#4CAF50';
      case 'in-progress':
      case 'in_progress':
        return '#FF9800';
      case 'pending':
        return '#757575';
      default:
        return '#757575';
    }
  };

  const getTaskStatusLabel = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return i18n.t('taskStatus.completed');
      case 'in-progress':
      case 'in_progress':
      case 'in progress':
        return i18n.t('taskStatus.inProgress');
      case 'pending':
      default:
        return i18n.t('taskStatus.pending');
    }
  };

  const getAlertSeverityColor = (severity) => {
    switch ((severity || '').toLowerCase()) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#757575';
    }
  };

  const getAlertSeverityLabel = (severity) => {
    switch ((severity || '').toLowerCase()) {
      case 'high':
        return i18n.t('alertSeverity.high');
      case 'medium':
        return i18n.t('alertSeverity.medium');
      case 'low':
        return i18n.t('alertSeverity.low');
      default:
        return severity || i18n.t('alertSeverity.medium');
    }
  };

  // Define renderSoldiersContent as a function declaration
  function renderSoldiersContent() {
    const renderTask = (task, idx) => (
      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Icon name="document-text" size={16} color="#2E3192" style={{ marginRight: 4 }} />
        <Text style={{ fontSize: 13, color: '#444', flex: 1 }}>{task.title || task.name || i18n.t('task')}</Text>
        <Text style={{
          fontSize: 12,
          color: task.status === 'Completed' ? '#4CAF50' : task.status === 'In-Progress' ? '#FF9800' : '#757575',
          fontWeight: 'bold',
          marginLeft: 8,
        }}>{task.status}</Text>
      </View>
    );

    const renderCard = ({ item }) => {
      return (
        <View style={styles.soldierCardContainer}>
          {/* Soldier Name - Improved visibility */}
          <View style={styles.soldierCardHeader}>
            <View style={styles.soldierNameContainer}>
              <Icon name="person" size={24} color="#2E3192" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.soldierCardName}>{item.name || 'Unknown Soldier'}</Text>
                <Text style={styles.soldierCardId}>ID: {item.username || item.id || 'N/A'}</Text>
              </View>
            </View>
            {userData && String(userData.role || '').trim().toLowerCase() === 'commander' && (
              <TouchableOpacity
                onPress={() => openEditSoldier(item)}
                style={styles.editSoldierCardBtn}
              >
                <Icon name="create-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.editSoldierCardBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Unit and Rank */}
          <View style={styles.soldierCardInfoRow}>
            <View style={styles.soldierCardInfoItem}>
              <Icon name="people" size={16} color="#4CAF50" style={{ marginRight: 6 }} />
              <Text style={styles.soldierCardInfoText}>Unit: {item.unit || 'N/A'}</Text>
            </View>
            <View style={styles.soldierCardInfoItem}>
              <Icon name="star" size={16} color="#FF9800" style={{ marginRight: 6 }} />
              <Text style={styles.soldierCardInfoText}>Rank: {item.rank || 'N/A'}</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.soldierCardInfoRow}>
            <Icon name="location" size={16} color="#F44336" style={{ marginRight: 6 }} />
            <Text style={styles.soldierCardInfoText}>
              {item.location && item.location.latitude && item.location.longitude
                ? `${item.location.latitude.toFixed(5)}, ${item.location.longitude.toFixed(5)}`
                : 'No location data'}
            </Text>
          </View>

          {/* Health Vitals */}
          <View style={styles.soldierCardInfoRow}>
            <View style={styles.soldierCardInfoItem}>
              <Icon name="heart" size={16} color="#E91E63" style={{ marginRight: 6 }} />
              <Text style={styles.soldierCardInfoText}>
                HR: {item.health?.heart_rate || item.heartRate || '72'} bpm
              </Text>
            </View>
            <View style={styles.soldierCardInfoItem}>
              <Icon name="thermometer" size={16} color="#2196F3" style={{ marginRight: 6 }} />
              <Text style={styles.soldierCardInfoText}>
                Temp: {item.health?.temperature || item.temperature || '36.8'}°C
              </Text>
            </View>
          </View>

          {/* Tasks Preview */}
          <View style={styles.soldierCardInfoRow}>
            <Icon name="clipboard-outline" size={16} color="#4CAF50" style={{ marginRight: 6 }} />
            <View style={{ flex: 1 }}>
              {item.tasks && item.tasks.length > 0 ? (
                <Text style={styles.soldierCardInfoText}>
                  {item.tasks.length}{' '}
                  {item.tasks.length === 1 ? i18n.t('task') : i18n.t('tasks')}{' '}
                  {i18n.t('assigned')}
                </Text>
              ) : (
                <Text style={styles.soldierCardInfoText}>{i18n.t('noTasksAssigned')}</Text>
              )}
            </View>
          </View>

          {/* View More Button */}
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => handleSoldierPress(item)}
          >
            <Text style={styles.viewMoreButtonText}>{i18n.t('viewMore')}</Text>
            <Icon name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 8 }}>
        <View style={styles.soldierOverviewHeader}>
          <Text style={styles.soldierOverviewTitle}>{i18n.t('mySoldiers')}</Text>
          <TouchableOpacity onPress={refreshSoldierOverview} style={styles.refreshSoldierButton}>
            <Icon name="refresh" size={22} color="#2E3192" />
          </TouchableOpacity>
        </View>
        {initialLoad ? (
          <View style={styles.soldierLoadingContainer}>
            <ActivityIndicator size="large" color="#2E3192" />
            <Text style={styles.soldierLoadingText}>{i18n.t('loadingSoldiers')}</Text>
          </View>
        ) : soldierError ? (
          <View style={styles.soldierErrorContainer}>
            <Icon name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.soldierErrorText}>{soldierError}</Text>
          </View>
        ) : soldierOverview.length === 0 ? (
          <View style={styles.soldierEmptyContainer}>
            <Icon name="people-outline" size={48} color="#757575" />
            <Text style={styles.soldierEmptyText}>{i18n.t('noSoldiersFound')}</Text>
          </View>
        ) : (
          <FlatList
            data={soldierOverview}
            keyExtractor={item => item.id.toString()}
            renderItem={renderCard}
            contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 8 }}
            refreshing={soldierLoading}
            onRefresh={refreshSoldierOverview}
            numColumns={1}
          />
        )}
      </View>
    );
  }

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);


  // 1. Add at the top with other useState declarations:
  const [commanderName, setCommanderName] = useState('');

  // 2. After userData useEffect (around line 150):
  useEffect(() => {
    const fetchCommander = async () => {
      if (userData && userData.unit) {
        try {
          const allUsers = await apiService.getAllUsers();
          const commander = allUsers.find(
            u => String(u.role || '').toLowerCase() === 'commander' && u.unit === userData.unit
          );
          setCommanderName(commander?.name || commander?.username || 'N/A');
        } catch (error) {
          console.error('Error fetching commander:', error);
          setCommanderName('N/A');
        }
      }
    };
    fetchCommander();
  }, [userData?.unit]);


  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.container}>
        {/* Custom Header inside SafeAreaView */}
        <View style={styles.headerWrapper}>
          <CustomHeader
            title={i18n.t('profile')}
            navigation={navigation}
            userRole={userRole}
            userName={userName}
            unreadNotifications={unreadCount}
            hideIcons={false}
            onMenuPress={() => setSideDrawerVisible(true)}
            showLanguageIcon={true}
            onPressLanguage={() => setLanguagePickerVisible(true)}
          />
        </View>
        <Modal
          visible={languagePickerVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setLanguagePickerVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setLanguagePickerVisible(false)}
            style={styles.langOverlay}
          >
            <View style={styles.langPopup}>
              <Text style={styles.langTitle}>{i18n.t('selectLanguage') || 'Select Language'}</Text>
              <View style={styles.langOptionsRow}>
                {['en', 'hi', 'ta'].map(code => (
                  <TouchableOpacity
                    key={code}
                    style={[styles.langOptionChip, selectedLanguage === code && styles.langOptionChipActive]}
                    onPress={() => handleSelectLanguage(code)}
                  >
                    <Text style={[styles.langOptionText, selectedLanguage === code && styles.langOptionTextActive]}>
                      {code.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setLanguagePickerVisible(false)} style={styles.langCloseBtn}>
                <Text style={styles.langCloseText}>{i18n.t('ok') || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {/* Profile Tab */}

          {/* Notifications Tab (only commanders) */}
          {userData && userData.role && userData.role.trim().toLowerCase() === 'commander' && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'notifications' && styles.activeTabButton]}
              onPress={() => setActiveTab('notifications')}
            >
              <Icon name="person" size={24} color={activeTab === 'notifications' ? '#2E3192' : '#757575'} />
              {activeTab === 'notifications' && (
                <Text style={[styles.tabButtonText, styles.sharedTabLabel, styles.activeTabButtonText]} numberOfLines={1} ellipsizeMode='tail'>{i18n.t('profile')}</Text>
              )}
            </TouchableOpacity>
          )}
          {/* Reports Tab removed */}
          {/* Soldiers Tab (only for commander) */}
          {userData && userData.role && userData.role.trim().toLowerCase() === 'commander' && (
            <TouchableOpacity onPress={() => setActiveTab('soldiers')} style={[styles.tabButton, activeTab === 'soldiers' && styles.activeTabButton]}>
              <Icon name="shield" size={24} color={activeTab === 'soldiers' ? '#2E3192' : '#757575'} />
              {activeTab === 'soldiers' && (
                <Text style={[styles.tabButtonText, styles.sharedTabLabel, styles.activeTabButtonText]} numberOfLines={1} ellipsizeMode='tail'>{i18n.t('soldiers')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          <FlatList
            data={[{ key: 'content' }]}
            keyExtractor={(item) => item.key}
            renderItem={() => null}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListHeaderComponent={
              <>
                {activeTab === 'profile' && renderProfileContent()}
                {activeTab === 'notifications' && userData && userData.role && userData.role.trim().toLowerCase() === 'commander' && renderProfileContent()}
                {/* Reports content removed */}
                {activeTab === 'soldiers' && userData && userData.role && userData.role.trim().toLowerCase() === 'commander' && renderSoldiersContent()}
              </>
            }
          />
        </View>

        {/* Side Drawer */}
        <SideDrawer
          visible={sideDrawerVisible}
          onClose={() => setSideDrawerVisible(false)}
          navigation={navigation}
        />


        {/* Soldier Detail Modal */}
        <Modal visible={soldierDetailModalVisible} transparent animationType="slide" onRequestClose={() => {
          setSoldierDetailModalVisible(false);
          setSelectedSoldierForDetail(null);
          setSoldierDetailVitals(null);
          setSoldierDetailVitalsLoading(false);
          setSoldierDetailLocation(null);
          setSoldierDetailTasks(null);
        }}>
          <View style={styles.modalOverlay}>
            <View style={styles.soldierDetailModalContainer}>
              <View style={styles.soldierDetailModalHeader}>
                <Text style={styles.soldierDetailModalTitle}>{i18n.t('soldierDetails')}</Text>
                <TouchableOpacity onPress={() => {
                  setSoldierDetailModalVisible(false);
                  setSelectedSoldierForDetail(null);
                  setSoldierDetailVitals(null);
                  setSoldierDetailVitalsLoading(false);
                  setSoldierDetailLocation(null);
                  setSoldierDetailTasks(null);
                }}>
                  <Icon name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.soldierDetailModalContent}>
                {selectedSoldierForDetail && (
                  <>
                    {/* Soldier Information */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="person" size={24} color="#2E3192" />
                        <Text style={styles.soldierDetailSectionTitle}>{i18n.t('soldierInformationTitle')}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>{`${i18n.t('soldierName')}:`}</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.name || i18n.t('notAvailable')}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>{`${i18n.t('soldierId')}:`}</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.username || selectedSoldierForDetail.id || i18n.t('notAvailable')}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>{`${i18n.t('unit')}:`}</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.unit || i18n.t('notAvailable')}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>{`${i18n.t('rank')}:`}</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.rank || i18n.t('notAvailable')}</Text>
                      </View>
                    </View>

                    {/* Location */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="location" size={24} color="#F44336" />
                        <Text style={styles.soldierDetailSectionTitle}>{i18n.t('currentLocationTitle')}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>{`${i18n.t('coordinates')}:`}</Text>
                        <Text style={styles.soldierDetailValue}>
                          {soldierDetailLocation && soldierDetailLocation.latitude !== undefined && soldierDetailLocation.longitude !== undefined
                            ? `${soldierDetailLocation.latitude.toFixed(6)}, ${soldierDetailLocation.longitude.toFixed(6)}`
                            : i18n.t('noLocationData')}
                        </Text>
                      </View>
                      {soldierDetailLocation && soldierDetailLocation.timestamp && (
                        <View style={styles.soldierDetailField}>
                          <Text style={styles.soldierDetailLabel}>{`${i18n.t('lastUpdated')}:`}</Text>
                          <Text style={styles.soldierDetailValue}>
                            {new Date(soldierDetailLocation.timestamp).toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Health Vitals */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="heart" size={24} color="#E91E63" />
                        <Text style={styles.soldierDetailSectionTitle}>{i18n.t('healthVitals')}</Text>
                      </View>
                      {soldierDetailVitalsLoading ? (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                          <ActivityIndicator size="small" color="#2E3192" />
                          <Text style={{ marginTop: 8, color: '#666' }}>Loading health data...</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.soldierDetailField}>
                            <Text style={styles.soldierDetailLabel}>{`${i18n.t('heartRateLabel')}:`}</Text>
                            <Text style={styles.soldierDetailValue}>
                              {soldierDetailVitals?.heart_rate || i18n.t('notAvailable')}
                              {soldierDetailVitals?.heart_rate && ' bpm'}
                            </Text>
                          </View>
                          <View style={styles.soldierDetailField}>
                            <Text style={styles.soldierDetailLabel}>{`${i18n.t('temperatureLabel')}:`}</Text>
                            <Text style={styles.soldierDetailValue}>
                              {soldierDetailVitals?.temperature || i18n.t('notAvailable')}
                              {soldierDetailVitals?.temperature && '°C'}
                            </Text>
                          </View>
                          <View style={styles.soldierDetailField}>
                            <Text style={styles.soldierDetailLabel}>{`${i18n.t('bloodPressure')}:`}</Text>
                            <Text style={styles.soldierDetailValue}>
                              {soldierDetailVitals?.blood_pressure || i18n.t('notAvailable')}
                              {soldierDetailVitals?.blood_pressure && ' mmHg'}
                            </Text>
                          </View>
                          <View style={styles.soldierDetailField}>
                            <Text style={styles.soldierDetailLabel}>{`${i18n.t('spo2Label')}:`}</Text>
                            <Text style={styles.soldierDetailValue}>
                              {soldierDetailVitals?.spo2 || i18n.t('notAvailable')}
                              {soldierDetailVitals?.spo2 && '%'}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    {/* Tasks */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="clipboard-outline" size={24} color="#4CAF50" />
                        <Text style={styles.soldierDetailSectionTitle}>{i18n.t('assignedTasks')}</Text>
                      </View>
                      {soldierDetailTasks && soldierDetailTasks.length > 0 ? (
                        soldierDetailTasks.map((task, index) => (
                          <View key={task.id || task.assignment_id || index} style={styles.soldierDetailTask}>
                            <Text style={styles.soldierDetailTaskTitle}>
                              {task.title || task.assignment_name || task.name || `Assignment ${task.id || index + 1}`}
                            </Text>
                            <Text style={styles.soldierDetailTaskDescription}>
                              {task.description || task.brief_description || i18n.t('noDescription')}
                            </Text>
                            {(task.title || task.assignment_name) && (
                              <Text style={styles.soldierDetailTaskMeta}>
                                Assignment: {task.title || task.assignment_name}
                              </Text>
                            )}
                            {task.type && (
                              <Text style={styles.soldierDetailTaskMeta}>
                                Type: {task.type}
                              </Text>
                            )}
                            {task.priority && (
                              <Text style={styles.soldierDetailTaskMeta}>
                                Priority: {task.priority}
                              </Text>
                            )}
                            {task.destination && (
                              <Text style={styles.soldierDetailTaskMeta}>
                                Destination: {task.destination}
                              </Text>
                            )}
                            <View style={[styles.soldierDetailTaskStatus, { backgroundColor: getTaskStatusColor(task.status) }]}>
                              <Text style={styles.soldierDetailTaskStatusText}>{getTaskStatusLabel(task.status)}</Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={styles.soldierDetailTask}>
                          <Text style={styles.soldierDetailTaskDescription}>{i18n.t('noTasksAssigned')}</Text>
                        </View>
                      )}
                    </View>

                    {/* Recent Alerts */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="alert-circle" size={24} color="#FF9800" />
                        <Text style={styles.soldierDetailSectionTitle}>{i18n.t('recentAlerts')}</Text>
                      </View>
                      {selectedSoldierForDetail.alerts && selectedSoldierForDetail.alerts.length > 0 ? (
                        selectedSoldierForDetail.alerts.map((alert, index) => (
                          <View key={index} style={styles.soldierDetailAlert}>
                            <View style={styles.soldierDetailAlertHeader}>
                              <Text style={styles.soldierDetailAlertTitle}>{alert.title || i18n.t('recentAlerts')}</Text>
                              <View style={[styles.soldierDetailAlertSeverity, { backgroundColor: getAlertSeverityColor(alert.severity) }]}>
                                <Text style={styles.soldierDetailAlertSeverityText}>{getAlertSeverityLabel(alert.severity)}</Text>
                              </View>
                            </View>
                            <Text style={styles.soldierDetailAlertMessage}>{alert.message || i18n.t('noDescription')}</Text>
                            {alert.relativeTime || alert.time ? (
                              <Text style={styles.soldierDetailAlertTime}>{alert.relativeTime || alert.time}</Text>
                            ) : null}
                          </View>
                        ))
                      ) : (
                        <View style={styles.soldierDetailAlert}>
                          <Text style={styles.soldierDetailAlertMessage}>{i18n.t('noAlerts')}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Edit Soldier Modal (Overview) */}
        <Modal visible={editSoldierVisible} transparent animationType="slide" onRequestClose={() => {
          setEditSoldierVisible(false);
          resetEditSoldierForm();
        }}>
          <View style={styles.modalOverlay}>
            <View style={styles.editSoldierModalContainer}>
              <View style={styles.editSoldierModalHeader}>
                <Text style={styles.editSoldierModalTitle}>Edit Soldier Details</Text>
                <TouchableOpacity onPress={() => {
                  setEditSoldierVisible(false);
                  resetEditSoldierForm();
                }}>
                  <Icon name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.editSoldierModalContent}>
                <View style={styles.editSoldierFormGroup}>
                  <Text style={styles.editSoldierInputLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.editSoldierInput}
                    placeholder="Enter full name"
                    placeholderTextColor="#999"
                    value={editSoldierForm.name}
                    onChangeText={v => setEditSoldierForm({ ...editSoldierForm, name: v })}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.editSoldierFormGroup}>
                  <Text style={styles.editSoldierInputLabel}>Email</Text>
                  <TextInput
                    style={styles.editSoldierInput}
                    placeholder="Enter email address"
                    placeholderTextColor="#999"
                    value={editSoldierForm.email}
                    onChangeText={v => setEditSoldierForm({ ...editSoldierForm, email: v })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.editSoldierFormGroup}>
                  <Text style={styles.editSoldierInputLabel}>Unit *</Text>
                  <TextInput
                    style={styles.editSoldierInput}
                    placeholder="Enter unit"
                    placeholderTextColor="#999"
                    value={editSoldierForm.unit}
                    onChangeText={v => setEditSoldierForm({ ...editSoldierForm, unit: v })}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.editSoldierFormGroup}>
                  <Text style={styles.editSoldierInputLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.editSoldierInput}
                    placeholder="Enter mobile number"
                    placeholderTextColor="#999"
                    value={editSoldierForm.MobileNumber}
                    onChangeText={v => setEditSoldierForm({ ...editSoldierForm, MobileNumber: v })}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.editSoldierButtonGroup}>
                  <TouchableOpacity
                    style={[styles.editSoldierCancelBtn, { marginRight: 10 }]}
                    onPress={() => {
                      setEditSoldierVisible(false);
                      resetEditSoldierForm();
                    }}
                  >
                    <Text style={styles.editSoldierCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.editSoldierSaveBtn, { flex: 1 }]}
                    onPress={saveEditSoldier}
                    disabled={savingSoldier}
                  >
                    {savingSoldier ? (
                      <Text style={styles.editSoldierSaveBtnText}>Saving...</Text>
                    ) : (
                      <Text style={styles.editSoldierSaveBtnText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: active ? '#2A6F2B' : '#f5f6fa',
        borderRadius: 18,
        marginRight: 10,
        borderWidth: active ? 0 : 1,
        borderColor: '#e1e4eb',
      }}
    >
      {icon ? <Icon name={icon} size={16} color={active ? '#fff' : '#2A6F2B'} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: active ? '#fff' : '#2A6F2B', fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerWrapper: {
    // No extra margin needed since SafeAreaView handles it
  },
  langOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  langPopup: {
    marginTop: 68,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    width: 260,
  },
  langTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  langOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  langOptionChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  langOptionChipActive: {
    backgroundColor: '#2E3192',
    borderColor: '#2E3192',
  },
  langOptionText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 12,
  },
  langOptionTextActive: {
    color: '#fff',
  },
  langCloseBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  langCloseText: {
    color: '#2E3192',
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E3192',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  roleBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2E3192',
  },
  serviceId: {
    color: '#757575',
    marginBottom: 5,
  },
  unitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  unitText: {
    marginLeft: 5,
    color: '#2E3192',
    fontWeight: '600',
    fontSize: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E3192',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 5,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2E3192',
  },
  // Logout modal styles (scoped)
  logoutModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutModalCard: {
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
  logoutModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  logoutModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  logoutModalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  logoutModalActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  logoutModalSecondaryButton: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  logoutModalPrimaryButton: {
    borderColor: '#0EA5A4',
    backgroundColor: '#10B981',
  },
  logoutModalSecondaryText: {
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logoutModalPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconContainer: {
    position: 'relative',
    backgroundColor: '#f0f0f0',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F44336',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionText: {
    marginTop: 5,
  },
  infoContainer: {
    padding: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  infoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    // Ensure text visibility on all devices
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    paddingVertical: 8,
    minWidth: 60,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#2E3192',
  },
  tabButtonText: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginTop: 6, // slightly increased for better spacing
    marginBottom: 0,
    flexWrap: 'nowrap',
    minWidth: 60,
  },
  activeTabButtonText: {
    fontWeight: 'bold',
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F44336',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    // Ensure proper scrolling behavior
    overflow: 'hidden',
  },
  tabContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 20, // Add some padding at the bottom for the new section
    flexGrow: 1,
    // Ensure proper scrolling on all devices
    minHeight: '100%',
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
    padding: 15,
    elevation: 1,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#2E3192',
  },
  readNotification: {
    opacity: 0.7,
  },
  iconContainer: {
    marginRight: 15,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  notificationMessage: {
    color: '#666',
    marginBottom: 5,
  },
  notificationTime: {
    color: '#999',
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2E3192',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  reportItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
    padding: 15,
    elevation: 1,
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  reportDate: {
    color: '#999',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 5,
    marginHorizontal: 15,
    marginVertical: 20,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  modalContent: {
    marginBottom: 10,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  passwordIcon: {
    marginRight: 10,
  },
  passwordInput: {
    flex: 1,
    height: 40,
    color: '#333',
    backgroundColor: '#fff',
    fontSize: 14,
    paddingHorizontal: 10,
    // Ensure text visibility on all devices
    includeFontPadding: false,
    textAlignVertical: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },

  modalItem: {
    padding: 10,
  },
  modalItemText: {
    fontSize: 16,
  },
  modalCancelButton: {
    padding: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#2E3192',
    fontWeight: 'bold',
  },
  soldierOverviewContainer: {
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  soldierOverviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 12,
  },
  soldierCard: {
    backgroundColor: '#f7f7fa',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  soldierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 2,
  },
  soldierUnit: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  soldierSection: {
    marginBottom: 8,
  },
  soldierSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  soldierSectionText: {
    fontSize: 13,
    color: '#444',
    marginLeft: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginVertical: 8,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginLeft: 8,
  },
  sharedTabLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#2E3192',
  },
  detailLabel: {
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 6,
  },
  detailValue: {
    fontWeight: 'normal',
    fontSize: 15,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  taskTitle: {
    fontSize: 15,
  },
  taskStatus: {
    fontSize: 13,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  taskCompleted: {
    backgroundColor: '#4CAF50',
    color: '#fff',
  },
  taskInProgress: {
    backgroundColor: '#FF9800',
    color: '#fff',
  },
  taskPending: {
    backgroundColor: '#757575',
    color: '#fff',
  },
  statusCard: {
    marginBottom: 10,
    borderRadius: 8,
    elevation: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  assetName: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statusDetail: {
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  historyIconContainer: {
    marginRight: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 16,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyEvent: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 2,
  },
  historyAssetId: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  historyDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  listContainer: {
    padding: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabText: {
    marginTop: 6,
    fontSize: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2E3192',
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  infoCardList: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
  },
  infoCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Soldiers Report Styles
  soldierReportContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filtersContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tableWrapper: {
    minWidth: 460, // Total width of all columns
  },
  tableList: {
    maxHeight: 450,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#006400', // Dark green as requested
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  tableHeaderCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    backgroundColor: '#fff',
  },
  tableCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  emptyTableRow: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  emptyTableText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  dropdownModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownOptionTextSelected: {
    color: '#006400',
    fontWeight: 'bold',
  },
  // Edit Soldier Modal Styles
  editSoldierModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  editSoldierModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  editSoldierModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  editSoldierModalContent: {
    marginBottom: 10,
  },
  editSoldierFormGroup: {
    marginBottom: 20,
  },
  editSoldierInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  editSoldierInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  editSoldierButtonGroup: {
    flexDirection: 'row',
    marginTop: 30,
  },
  editSoldierSaveBtn: {
    backgroundColor: '#2E3192',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 2,
  },
  editSoldierSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editSoldierCancelBtn: {
    backgroundColor: '#6c757d',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    paddingHorizontal: 20,
    elevation: 2,
  },
  editSoldierCancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Edit Button in Soldier Card
  editSoldierCardBtn: {
    marginLeft: 8,
    backgroundColor: '#2E3192',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  editSoldierCardBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  // Soldier Card Container
  soldierCardContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    marginBottom: 16,
    padding: 20,
    flex: 1,
    minWidth: 260,
    maxWidth: 500,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  // Refresh Soldier Button
  refreshSoldierButton: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // Soldiers Overview Header
  soldierOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  soldierOverviewTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  // Soldiers Overview States
  soldierLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  soldierLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  soldierErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  soldierErrorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#F44336',
    fontWeight: '500',
    textAlign: 'center',
  },
  soldierEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  soldierEmptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
    fontWeight: '500',
  },
  // Improved Soldier Card Styles
  soldierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  soldierNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  soldierCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 2,
  },
  soldierCardId: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  soldierCardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  soldierCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  soldierCardInfoText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E3192',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  viewMoreButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  // Soldier Detail Modal Styles
  soldierDetailModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  soldierDetailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  soldierDetailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  soldierDetailModalContent: {
    padding: 20,
  },
  soldierDetailSection: {
    marginBottom: 24,
  },
  soldierDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  soldierDetailSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E3192',
    marginLeft: 8,
  },
  soldierDetailField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  soldierDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  soldierDetailValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  soldierDetailTask: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  soldierDetailTaskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 4,
  },
  soldierDetailTaskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  soldierDetailTaskMeta: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  soldierDetailTaskStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  soldierDetailTaskStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  soldierDetailNoData: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  soldierDetailAlert: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  soldierDetailAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  soldierDetailAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  soldierDetailAlertSeverity: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soldierDetailAlertSeverityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  soldierDetailAlertMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  soldierDetailAlertTime: {
    fontSize: 11,
    color: '#999',
  },
  // Coming Soon styles
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  comingSoonIcon: {
    marginBottom: 24,
    opacity: 0.8,
  },
  comingSoonTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 16,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.8,
  },
  comingSoonFeatures: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(46, 49, 146, 0.05)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 49, 146, 0.1)',
  },
  comingSoonFeaturesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonFeature: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
    opacity: 0.8,
  },
}); 