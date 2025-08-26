import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, Switch, Alert, Modal, SafeAreaView, Platform, StatusBar, ActivityIndicator, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomHeader from '../components/CustomHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../NotificationContext';
import { apiService } from '../services/api';
import i18n, { setLocale } from '../utils/i18n';
import * as Localization from 'expo-localization';
import { Card } from 'react-native-paper';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
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
  // State for managing the password change modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Soldiers Report Filter States (only states here; derived values below where soldierReports exists)
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('all');
  const [selectedRankFilter, setSelectedRankFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [unitFilterVisible, setUnitFilterVisible] = useState(false);
  const [rankFilterVisible, setRankFilterVisible] = useState(false);
  const [statusFilterVisible, setStatusFilterVisible] = useState(false);

  // Soldier report derived data is declared after soldierReports state

  // Configure status bar
  useLayoutEffect(() => {
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#f5f5f5');
      StatusBar.setTranslucent(false);
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
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);

  // In the Soldiers tab/page, fetch soldiers using apiService.getSoldiersByUnit(currentUser.unit) like DashboardScreen
  // Replace the fetchSoldierOverview/refreshSoldierOverview logic with:
  useEffect(() => {
    const fetchSoldiersOverview = async (showLoader = false) => {
      if (userData && userData.role === 'commander' && userData.unit) {
        if (showLoader) setSoldierLoading(true);
        setSoldierError(null);
        try {
          // Align logic with Dashboard: fetch all users then filter by unit and role (case-insensitive, trim)
          const allUsers = await apiService.getAllUsers();
          const unitNorm = String(userData.unit || '').trim().toLowerCase();
          const unitSoldiers = (allUsers || []).filter(u =>
            String(u.role || '').trim().toLowerCase() === 'soldier' &&
            String(u.unit || '').trim().toLowerCase() === unitNorm
          );
          setSoldierOverview(unitSoldiers);
        } catch (err) {
          setSoldierError('Failed to fetch soldiers.');
        } finally {
          if (showLoader) setSoldierLoading(false);
          setInitialLoad(false);
        }
      }
    };
    fetchSoldiersOverview(true); // Show loader on initial load
  }, [userData]);

  const refreshSoldierOverview = async () => {
    if (userData && userData.role === 'commander' && userData.unit) {
      setSoldierLoading(true);
      setSoldierError(null);
      try {
        const allUsers = await apiService.getAllUsers();
        const unitNorm = String(userData.unit || '').trim().toLowerCase();
        const unitSoldiers = (allUsers || []).filter(u =>
          String(u.role || '').trim().toLowerCase() === 'soldier' &&
          String(u.unit || '').trim().toLowerCase() === unitNorm
        );
        setSoldierOverview(unitSoldiers);
      } catch (err) {
        setSoldierError('Failed to fetch soldiers.');
      } finally {
        setSoldierLoading(false);
      }
    }
  };

  // Helper functions for user data
  function getRoleServiceId(role) {
    switch(role) {
      case 'unitAdmin': return 'UA-3000';
      case 'commander': return 'C-4000';
      case 'soldier': return 'S-5000';
      default: return 'S-0000';
    }
  }
  
  function getRoleRank(role) {
    switch(role) {
      case 'unitAdmin': return 'Captain';
      case 'commander': return 'Lieutenant';
      case 'soldier': return 'Private';
      default: return 'Recruit';
    }
  }
  
  function getRoleClearanceLevel(role) {
    switch(role) {
      case 'unitAdmin': return 'Level 4';
      case 'commander': return 'Level 3';
      case 'soldier': return 'Level 2';
      default: return 'Level 1';
    }
  }

  const [editing, setEditing] = useState(false);
  const [tempUserData, setTempUserData] = useState({...userData});

  // State for expanded soldier card in overview
  const [expandedSoldierId, setExpandedSoldierId] = useState(null);
  
  // State for active tab
  const [activeTab, setActiveTab] = useState(route.params?.initialTab || 'profile'); // 'profile', 'notifications', 'reports', 'soldiers'
  
  // Update activeTab if initialTab param changes (e.g., on navigation)
  useEffect(() => {
    if (route.params?.initialTab && route.params.initialTab !== activeTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

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
    refreshNotifications
  } = useNotifications();

  // Add a flag to indicate if a database is linked
  const isDatabaseLinked = false; // Set to true when database is connected

  // Function to handle saving user profile changes
  const saveProfileChanges = async () => {
    try {
      // Get all users from AsyncStorage
      const usersData = await AsyncStorage.getItem('users');
      if (usersData) {
        const users = JSON.parse(usersData);
        
        // Update the current user's data
        if (users[userData.serviceId]) {
          users[userData.serviceId] = {
            ...users[userData.serviceId],
            name: tempUserData.name,
            email: tempUserData.email,
            phone: tempUserData.phone,
            specialization: tempUserData.specialization,
            // Don't update sensitive fields like role, serviceId
          };
          
          // Save updated users back to AsyncStorage
          await AsyncStorage.setItem('users', JSON.stringify(users));
          
          // Update currentUser in AsyncStorage
          await AsyncStorage.setItem('currentUser', JSON.stringify({
            ...users[userData.serviceId]
          }));
          
          // Update local state
          setUserData(tempUserData);
          setUserName(tempUserData.name);
          
          Alert.alert('Success', 'Profile updated successfully');
        }
      }
    } catch (error) {
      console.error('Error saving profile changes:', error);
      Alert.alert('Error', 'Failed to save profile changes');
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
      setTempUserData({...userData});
      setEditing(true);
    }
  };

  const handleInputChange = (field, value) => {
    setTempUserData({
      ...tempUserData,
      [field]: value
    });
  };

  // Function to handle password change
  const handlePasswordChange = async () => {
    // Validate password inputs
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    try {
      // Get users from AsyncStorage
      const usersData = await AsyncStorage.getItem('users');
      if (usersData) {
        const users = JSON.parse(usersData);
        
        // Check if current password is correct
        if (users[userData.serviceId] && users[userData.serviceId].password === currentPassword) {
          // Update password
          users[userData.serviceId].password = newPassword;
          
          // Save updated users back to AsyncStorage
          await AsyncStorage.setItem('users', JSON.stringify(users));
          
          // Reset form and close modal
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPasswordModalVisible(false);
          
          Alert.alert('Success', 'Password changed successfully');
        } else {
          Alert.alert('Error', 'Current password is incorrect');
        }
      }
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password');
    }
  };

  // Change profile photo: pick image and upload base64 to backend, then update local state
  const handleChangePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photo library to set your profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets && result.assets[0];
      if (!asset || !asset.base64) {
        Alert.alert('Error', 'Could not read selected image.');
        return;
      }
      if (!userData?.id) {
        Alert.alert('Error', 'Missing User Login ID. Please login again.');
        return;
      }
      // Build data URI for consistent rendering on all platforms
      const mime = asset.mimeType || 'image/jpeg';
      const dataUri = `data:${mime};base64,${asset.base64}`;

      // Upload to backend with data URI (server normalizes to raw base64)
      await apiService.updateUserPhoto(userData.id, dataUri);
      // Update local cached user with data URI for direct rendering
      const updated = { ...(userData || {}), photo: dataUri };
      setUserData(updated);
      await AsyncStorage.setItem('currentUser', JSON.stringify(updated));
      Alert.alert('Success', 'Profile photo updated');
    } catch (e) {
      console.error('Change photo error:', e);
      Alert.alert('Error', e?.message || 'Failed to update profile photo');
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

  const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'te', label: 'Telugu' },
    { code: 'ta', label: 'Tamil' },
    { code: 'kn', label: 'Kannada' },
    { code: 'ml', label: 'Malayalam' },
    { code: 'mr', label: 'Marathi' },
    { code: 'gu', label: 'Gujarati' },
    { code: 'pa', label: 'Punjabi' },
    { code: 'bn', label: 'Bengali' },
  ];

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  useEffect(() => {
    // Load language from AsyncStorage
    const loadLanguage = async () => {
      const lang = await AsyncStorage.getItem('appLanguage');
      console.log('[ProfileScreen] loadLanguage - stored language:', lang);
      if (lang) {
        setSelectedLanguage(lang);
        setLocale(lang); // Use the new setLocale function
        console.log('[ProfileScreen] loadLanguage - set language to:', lang);
      } else {
        // Use device locale as fallback
        const deviceLang = Localization.locale.split('-')[0];
        console.log('[ProfileScreen] loadLanguage - using device language:', deviceLang);
        setSelectedLanguage(deviceLang);
        setLocale(deviceLang); // Use the new setLocale function
      }
    };
    loadLanguage();
  }, []);

  const handleLanguageSelect = async (lang) => {
    console.log('[ProfileScreen] handleLanguageSelect called with:', lang);
    setSelectedLanguage(lang);
    setLocale(lang); // Use the new setLocale function
    await AsyncStorage.setItem('appLanguage', lang);
    setLanguageModalVisible(false);
    console.log('[ProfileScreen] Language change completed');
    // Optionally force re-render or use context
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Header */}
        <View style={styles.header}>
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
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{userData && userData.name ? userData.name : ''}</Text>
            <Text style={styles.serviceId}>{userData && userData.serviceId ? `ID: ${userData.serviceId}` : ''}</Text>
            <View style={styles.unitInfo}>
              <Icon name="people" size={16} color="#2E3192" />
              <Text style={styles.unitText}>{userData && userData.unit ? `${userData.unit} Unit` : ''}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={toggleEditing}>
            <Icon name={editing ? "save" : "create-outline"} size={20} color="#fff" />
            <Text style={styles.editButtonText}>{editing ? i18n.t('save') : i18n.t('editProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.editButton, { marginTop: 10, backgroundColor: '#4CAF50' }]} onPress={handleChangePhoto}>
            <Icon name="camera" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Change Photo</Text>
          </TouchableOpacity>
        </View>
        
        {/* Change Password Button */}
        <TouchableOpacity 
          style={styles.changePasswordButton}
          onPress={() => setPasswordModalVisible(true)}
        >
          <Icon name="lock-closed" size={20} color="#2E3192" />
          <Text style={styles.changePasswordText}>Change Password</Text>
        </TouchableOpacity>

        {/* User Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personnel Information</Text>
          
          {userData && userData.name ? (
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                {editing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={tempUserData.name}
                    onChangeText={(value) => handleInputChange('name', value)}
                    placeholder={i18n.t('name')}
                  />
                ) : (
                  <Text style={styles.infoValue}>{userData.name}</Text>
                )}
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                {editing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={tempUserData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    placeholder={i18n.t('email')}
                    keyboardType="email-address"
                  />
                ) : (
                  <Text style={styles.infoValue}>{userData.email}</Text>
                )}
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mobile Number</Text>
                <Text style={styles.infoValue}>{
                  (userData && (userData.MobileNumber || userData.phone || userData.mobile || userData.mobile_number))
                    ? (userData.MobileNumber || userData.phone || userData.mobile || userData.mobile_number)
                    : '-'
                }</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No personal information available</Text>
            </View>
          )}
        </View>
        
        {/* Military Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Military Information</Text>
          {userData ? (
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Service ID</Text>
                <Text style={styles.infoValue}>{userData.username || userData.serviceId || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>{getRoleName(userData.role)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Unit</Text>
                <Text style={styles.infoValue}>{userData.unit || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Years of Service</Text>
                <Text style={styles.infoValue}>{userData.serviceYears || '-'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No military information available</Text>
            </View>
          )}
        </View>

        {/* System Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Information</Text>
          <View style={styles.infoCardList}>
            <View style={styles.infoCardRow}>
              <Text style={styles.infoLabel}>Device Model</Text>
              <Text style={styles.infoValue}>{systemInfo.deviceModel}</Text>
            </View>
            <View style={styles.infoCardRow}>
              <Text style={styles.infoLabel}>OS</Text>
              <Text style={styles.infoValue}>{systemInfo.os}</Text>
            </View>
            <View style={styles.infoCardRow}>
              <Text style={styles.infoLabel}>IP Address</Text>
              <Text style={styles.infoValue}>{systemInfo.ip}</Text>
            </View>
            <View style={styles.infoCardRow}>
              <Text style={styles.infoLabel}>Network Type</Text>
              <Text style={styles.infoValue}>{systemInfo.networkType}</Text>
            </View>
            <View style={styles.infoCardRow}>
              <Text style={styles.infoLabel}>Current Location</Text>
              <Text style={styles.infoValue}>{systemInfo.location}</Text>
            </View>
            <View style={styles.infoCardRow}>
              <Text style={styles.infoLabel}>Session Duration</Text>
              <Text style={styles.infoValue}>{formatDuration(Date.now() - systemInfo.sessionStart)}</Text>
            </View>
          </View>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              "Logout",
              "Are you sure you want to logout?",
              [
                { text: i18n.t('cancel'), style: "cancel" },
                { 
                  text: i18n.t('logout'), 
                  onPress: async () => {
                    try {
                      await AsyncStorage.removeItem('currentUser');
                      navigation.navigate('Login');
                    } catch (error) {
                      console.error('Error logging out:', error);
                    }
                  }
                }
              ]
            );
          }}
        >
          <Icon name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Language Selector */}
        <TouchableOpacity style={styles.languageSelector} onPress={() => setLanguageModalVisible(true)}>
          <Icon name="language-outline" size={20} color="#2A6F2B" />
          <Text style={styles.languageSelectorText}>Language: {languageOptions.find(l => l.code === selectedLanguage)?.label || 'English'}</Text>
          <Icon name="chevron-down" size={18} color="#2A6F2B" />
        </TouchableOpacity>
      </ScrollView>
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
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      setAlertsError('Failed to load alerts.');
    } finally {
      setAlertsLoading(false);
      setAlertsRefreshing(false);
    }
  };

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
                      <View style={{ backgroundColor: getSeverityColor(item.severity), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
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
    if (activeTab === 'reports') {
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

  // Load commander categories
  useEffect(() => {
    const loadCommanderCategory = async () => {
      if (!(activeTab === 'reports' && isCommander)) return;
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
      if (!(activeTab === 'reports' && isCommander)) return;
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
        // Determine commander's current zone based on device location
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({});
            const myLat = loc?.coords?.latitude;
            const myLng = loc?.coords?.longitude;
            if (typeof myLat === 'number' && typeof myLng === 'number') {
              const inside = uniqueZones.filter(z => Array.isArray(z.coordinates) && z.coordinates.length > 0 && pointInPolygon({ latitude: myLat, longitude: myLng }, z.coordinates));
              const zoneNames = inside.map(z => z.name);
              setCommanderZones(zoneNames);
            }
          }
        } catch {}
      } catch {}
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
      {isCommander ? (
        <>
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="Soldier Report" active={selectedCategory === 'soldier'} onPress={() => setSelectedCategory('soldier')} icon="people" />
              <FilterChip label="Operation Report" active={selectedCategory === 'operation'} onPress={() => setSelectedCategory('operation')} icon="construct" />
              <FilterChip label="Ammo & Equipment" active={selectedCategory === 'ammo'} onPress={() => setSelectedCategory('ammo')} icon="cube" />
              <FilterChip label="Alerts & Incidents" active={selectedCategory === 'alerts'} onPress={() => setSelectedCategory('alerts')} icon="alert-circle" />
              <FilterChip label="Unit Change Requests" active={selectedCategory === 'unitChange'} onPress={() => setSelectedCategory('unitChange')} icon="swap-horizontal" />
            </ScrollView>
          </View>
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
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, profileReportsTab === 'status' && styles.activeTab]}
              onPress={() => setProfileReportsTab('status')}
            >
              <Icon name="pulse" size={20} color={profileReportsTab === 'status' ? '#2196F3' : '#757575'} />
              <Text style={[styles.tabText, profileReportsTab === 'status' && styles.activeTabText]}>{i18n.t('status')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, profileReportsTab === 'history' && styles.activeTab]}
              onPress={() => setProfileReportsTab('history')}
            >
              <Icon name="time" size={20} color={profileReportsTab === 'history' ? '#2196F3' : '#757575'} />
              <Text style={[styles.tabText, profileReportsTab === 'history' && styles.activeTabText]}>{i18n.t('history')}</Text>
            </TouchableOpacity>
          </View>
          {profileReportsLoading ? (
            <View style={styles.listContainer}><Text>{i18n.t('loading') || 'Loading...'}</Text></View>
          ) : profileReportsError ? (
            <View style={styles.listContainer}><Text style={{color:'red'}}>{profileReportsError}</Text></View>
          ) : profileReportsTab === 'status' ? (
            <FlatList
              data={assetStatusData}
              renderItem={renderAssetStatusItem}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={<Text>{i18n.t('noReports')}</Text>}
            />
          ) : (
            <FlatList
              data={historyData}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={<Text>{i18n.t('noReports')}</Text>}
            />
          )}
        </>
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
  const handleSoldierPress = (soldier) => {
    setSelectedSoldierForDetail(soldier);
    setSoldierDetailModalVisible(true);
  };

  // Helper function to get role name
  const getRoleName = (role) => {
    switch(role) {
      case 'unitAdmin': return 'Unit Admin';
      case 'commander': return 'Commander';
      case 'soldier': return 'Soldier';
      default: return 'Unknown';
    }
  };

  // Helper function to get task status color
  const getTaskStatusColor = (status) => {
    switch((status || '').toLowerCase()) {
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
                  {item.tasks.length} task{item.tasks.length !== 1 ? 's' : ''} assigned
                </Text>
              ) : (
                <Text style={styles.soldierCardInfoText}>No tasks assigned</Text>
              )}
            </View>
          </View>

          {/* View More Button */}
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => handleSoldierPress(item)}
          >
            <Text style={styles.viewMoreButtonText}>View More</Text>
            <Icon name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 8 }}>
        <View style={styles.soldierOverviewHeader}>
          <Text style={styles.soldierOverviewTitle}>Soldiers Overview</Text>
          <TouchableOpacity onPress={refreshSoldierOverview} style={styles.refreshSoldierButton}>
            <Icon name="refresh" size={22} color="#2E3192" />
          </TouchableOpacity>
        </View>
        {initialLoad ? (
          <View style={styles.soldierLoadingContainer}>
            <ActivityIndicator size="large" color="#2E3192" />
            <Text style={styles.soldierLoadingText}>Loading soldiers...</Text>
          </View>
        ) : soldierError ? (
          <View style={styles.soldierErrorContainer}>
            <Icon name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.soldierErrorText}>{soldierError}</Text>
          </View>
        ) : soldierOverview.length === 0 ? (
          <View style={styles.soldierEmptyContainer}>
            <Icon name="people-outline" size={48} color="#757575" />
            <Text style={styles.soldierEmptyText}>No soldiers found</Text>
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

  const [systemInfo, setSystemInfo] = useState({
    deviceModel: '',
    os: '',
    ip: '',
    networkType: '',
    location: '',
    sessionStart: Date.now(),
  });

  useEffect(() => {
    async function fetchSystemInfo() {
      // Device Model and OS
      const deviceModel = Device.modelName || Device.deviceName || '-';
      const os = `${Device.osName} ${Device.osVersion}`;
      // Network Info
      let ip = '-';
      let networkType = '-';
      try {
        const net = await NetInfo.fetch();
        networkType = net.type || '-';
        ip = net.details?.ipAddress || '-';
      } catch {}
      // Location
      let locationStr = '-';
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          locationStr = `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`;
        }
      } catch {}
      setSystemInfo(info => ({
        ...info,
        deviceModel,
        os,
        ip,
        networkType,
        location: locationStr,
      }));
    }
    fetchSystemInfo();
  }, []);

  // Helper to format session duration
  function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
  }

  return (
    <View style={styles.safeArea}>
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
            hideIcons={activeTab === 'profile' || activeTab === 'notifications' || activeTab === 'reports' || activeTab === 'soldiers'}
          />
        </View>
        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {/* Profile Tab */}
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'profile' && styles.activeTabButton]}
            onPress={() => setActiveTab('profile')}
          >
            <Icon name="person" size={24} color={activeTab === 'profile' ? '#2E3192' : '#757575'} />
            {activeTab === 'profile' && (
              <Text style={[styles.tabButtonText, styles.sharedTabLabel, styles.activeTabButtonText]} numberOfLines={1} ellipsizeMode='tail'>{i18n.t('profile')}</Text>
            )}
          </TouchableOpacity>
          {/* Notifications Tab */}
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'notifications' && styles.activeTabButton]}
            onPress={() => setActiveTab('notifications')}
          >
            <Icon name="notifications" size={24} color={activeTab === 'notifications' ? '#2E3192' : '#757575'} />
            {activeTab === 'notifications' && (
              <Text style={[styles.tabButtonText, styles.sharedTabLabel, styles.activeTabButtonText]} numberOfLines={1} ellipsizeMode='tail'>{i18n.t('alerts')}</Text>
            )}
          </TouchableOpacity>
          {/* Reports Tab */}
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'reports' && styles.activeTabButton]}
            onPress={() => setActiveTab('reports')}
          >
            <Icon name="document-text" size={24} color={activeTab === 'reports' ? '#2E3192' : '#757575'} />
            {activeTab === 'reports' && (
              <Text style={[styles.tabButtonText, styles.sharedTabLabel, styles.activeTabButtonText]} numberOfLines={1} ellipsizeMode='tail'>{i18n.t('reports')}</Text>
            )}
          </TouchableOpacity>
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
          {activeTab === 'profile' && renderProfileContent()}
          {activeTab === 'notifications' && renderNotificationsContent()}
          {activeTab === 'reports' && renderReportsContent()}
          {activeTab === 'soldiers' && userData && userData.role && userData.role.trim().toLowerCase() === 'commander' && renderSoldiersContent()}
        </View>

        {/* Password Change Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={passwordModalVisible}
          onRequestClose={() => setPasswordModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{i18n.t('changePassword')}</Text>
                <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                  <Icon name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalContent}>
                {/* Current Password */}
                <View style={styles.passwordInputContainer}>
                  <Icon name="lock-closed" size={20} color="#2E3192" style={styles.passwordIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={i18n.t('currentPassword')}
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Icon 
                      name={showCurrentPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color="#757575" 
                    />
                  </TouchableOpacity>
                </View>
                
                {/* New Password */}
                <View style={styles.passwordInputContainer}>
                  <Icon name="key" size={20} color="#2E3192" style={styles.passwordIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={i18n.t('newPassword')}
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Icon 
                      name={showNewPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color="#757575" 
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Confirm New Password */}
                <View style={styles.passwordInputContainer}>
                  <Icon name="key" size={20} color="#2E3192" style={styles.passwordIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={i18n.t('confirmNewPassword')}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Icon 
                      name={showConfirmPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color="#757575" 
                    />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={styles.changePasswordButton}
                  onPress={handlePasswordChange}
                >
                  <Text style={styles.changePasswordText}>{i18n.t('updatePassword')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Language Selector Modal */}
        <Modal visible={languageModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.languageModalCard}>
              <Text style={styles.languageModalTitle}>{i18n.t('selectLanguage') || 'Select Language'}</Text>
              {languageOptions.map(lang => (
                <TouchableOpacity key={lang.code} style={styles.languageModalItem} onPress={() => handleLanguageSelect(lang.code)}>
                  <Text style={styles.languageModalItemText}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.languageModalCancelButton} onPress={() => setLanguageModalVisible(false)}>
                <Text style={styles.languageModalCancelText}>{i18n.t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Soldier Detail Modal */}
        <Modal visible={soldierDetailModalVisible} transparent animationType="slide" onRequestClose={() => {
          setSoldierDetailModalVisible(false);
          setSelectedSoldierForDetail(null);
        }}>
          <View style={styles.modalOverlay}>
            <View style={styles.soldierDetailModalContainer}>
              <View style={styles.soldierDetailModalHeader}>
                <Text style={styles.soldierDetailModalTitle}>Soldier Details</Text>
                <TouchableOpacity onPress={() => {
                  setSoldierDetailModalVisible(false);
                  setSelectedSoldierForDetail(null);
                }}>
                  <Icon name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.soldierDetailModalContent}>
                {selectedSoldierForDetail && (
                  <>
                    {/* Soldier Name */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="person" size={24} color="#2E3192" />
                        <Text style={styles.soldierDetailSectionTitle}>Soldier Information</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Soldier Name:</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.name || 'N/A'}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Soldier ID:</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.username || selectedSoldierForDetail.id || 'N/A'}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Unit:</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.unit || 'N/A'}</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Rank:</Text>
                        <Text style={styles.soldierDetailValue}>{selectedSoldierForDetail.rank || 'N/A'}</Text>
                      </View>
                    </View>

                    {/* Location */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="location" size={24} color="#F44336" />
                        <Text style={styles.soldierDetailSectionTitle}>Current Location</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Coordinates:</Text>
                        <Text style={styles.soldierDetailValue}>
                          {selectedSoldierForDetail.location && selectedSoldierForDetail.location.latitude && selectedSoldierForDetail.location.longitude
                            ? `${selectedSoldierForDetail.location.latitude.toFixed(6)}, ${selectedSoldierForDetail.location.longitude.toFixed(6)}`
                            : 'No location data available'}
                        </Text>
                      </View>
                      {selectedSoldierForDetail.location && selectedSoldierForDetail.location.recorded_at && (
                        <View style={styles.soldierDetailField}>
                          <Text style={styles.soldierDetailLabel}>Last Updated:</Text>
                          <Text style={styles.soldierDetailValue}>
                            {new Date(selectedSoldierForDetail.location.recorded_at).toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Health Vitals */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="heart" size={24} color="#E91E63" />
                        <Text style={styles.soldierDetailSectionTitle}>Health Vitals</Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Heart Rate:</Text>
                        <Text style={styles.soldierDetailValue}>
                          {selectedSoldierForDetail.health?.heart_rate || selectedSoldierForDetail.heartRate || '72'} bpm
                        </Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Temperature:</Text>
                        <Text style={styles.soldierDetailValue}>
                          {selectedSoldierForDetail.health?.temperature || selectedSoldierForDetail.temperature || '36.8'}°C
                        </Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Blood Pressure:</Text>
                        <Text style={styles.soldierDetailValue}>
                          {selectedSoldierForDetail.health?.blood_pressure || '120/80'} mmHg
                        </Text>
                      </View>
                      <View style={styles.soldierDetailField}>
                        <Text style={styles.soldierDetailLabel}>Oxygen Saturation:</Text>
                        <Text style={styles.soldierDetailValue}>
                          {selectedSoldierForDetail.health?.oxygen_saturation || '98'}%
                        </Text>
                      </View>
                    </View>

                    {/* Tasks */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="clipboard-outline" size={24} color="#4CAF50" />
                        <Text style={styles.soldierDetailSectionTitle}>Assigned Tasks</Text>
                      </View>
                      {selectedSoldierForDetail.tasks && selectedSoldierForDetail.tasks.length > 0 ? (
                        selectedSoldierForDetail.tasks.map((task, index) => (
                          <View key={index} style={styles.soldierDetailTask}>
                            <Text style={styles.soldierDetailTaskTitle}>{task.title || task.name || `Task ${index + 1}`}</Text>
                            <Text style={styles.soldierDetailTaskDescription}>{task.description || 'No description'}</Text>
                            <View style={[styles.soldierDetailTaskStatus, { backgroundColor: getTaskStatusColor(task.status) }]}>
                              <Text style={styles.soldierDetailTaskStatusText}>{task.status || 'Pending'}</Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <>
                          <View style={styles.soldierDetailTask}>
                            <Text style={styles.soldierDetailTaskTitle}>Patrol Duty</Text>
                            <Text style={styles.soldierDetailTaskDescription}>Conduct routine patrol in assigned sector</Text>
                            <View style={[styles.soldierDetailTaskStatus, { backgroundColor: getTaskStatusColor('in_progress') }]}>
                              <Text style={styles.soldierDetailTaskStatusText}>In Progress</Text>
                            </View>
                          </View>
                          <View style={styles.soldierDetailTask}>
                            <Text style={styles.soldierDetailTaskTitle}>Equipment Maintenance</Text>
                            <Text style={styles.soldierDetailTaskDescription}>Check and maintain assigned equipment</Text>
                            <View style={[styles.soldierDetailTaskStatus, { backgroundColor: getTaskStatusColor('pending') }]}>
                              <Text style={styles.soldierDetailTaskStatusText}>Pending</Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>

                    {/* Recent Alerts */}
                    <View style={styles.soldierDetailSection}>
                      <View style={styles.soldierDetailHeader}>
                        <Icon name="alert-circle" size={24} color="#FF9800" />
                        <Text style={styles.soldierDetailSectionTitle}>Recent Alerts</Text>
                      </View>
                      <View style={styles.soldierDetailAlert}>
                        <View style={styles.soldierDetailAlertHeader}>
                          <Text style={styles.soldierDetailAlertTitle}>Zone Breach Alert</Text>
                          <View style={[styles.soldierDetailAlertSeverity, { backgroundColor: '#F44336' }]}>
                            <Text style={styles.soldierDetailAlertSeverityText}>HIGH</Text>
                          </View>
                        </View>
                        <Text style={styles.soldierDetailAlertMessage}>Soldier entered restricted zone at 14:30</Text>
                        <Text style={styles.soldierDetailAlertTime}>2 hours ago</Text>
                      </View>
                      <View style={styles.soldierDetailAlert}>
                        <View style={styles.soldierDetailAlertHeader}>
                          <Text style={styles.soldierDetailAlertTitle}>Equipment Check</Text>
                          <View style={[styles.soldierDetailAlertSeverity, { backgroundColor: '#FF9800' }]}>
                            <Text style={styles.soldierDetailAlertSeverityText}>MEDIUM</Text>
                          </View>
                        </View>
                        <Text style={styles.soldierDetailAlertMessage}>Scheduled equipment maintenance due</Text>
                        <Text style={styles.soldierDetailAlertTime}>1 day ago</Text>
                      </View>
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
    </View>
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
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerWrapper: {
    // No extra margin needed since SafeAreaView handles it
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  serviceId: {
    color: '#757575',
    marginBottom: 5,
  },
  unitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitText: {
    marginLeft: 5,
    color: '#2E3192',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E3192',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 5,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 15,
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontWeight: 'bold',
  },
  infoValue: {
    fontWeight: 'bold',
  },
  infoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 5,
    fontSize: 14,
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
  },
  tabContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 20, // Add some padding at the bottom for the new section
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
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
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
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 15,
    marginVertical: 10,
    justifyContent: 'center',
  },
  changePasswordText: {
    color: '#2E3192',
    fontWeight: 'bold',
    marginLeft: 10,
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
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 15,
    marginVertical: 10,
  },
  languageSelectorText: {
    flex: 1,
    marginHorizontal: 10,
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
  languageModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    elevation: 8,
  },
  languageModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2E3192',
  },
  languageModalItem: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  languageModalItemText: {
    fontSize: 16,
    color: '#222',
  },
  languageModalCancelButton: {
    marginTop: 16,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  languageModalCancelText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold',
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
}); 