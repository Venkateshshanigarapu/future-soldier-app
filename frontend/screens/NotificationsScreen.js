import React, { useState, useLayoutEffect, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  RefreshControl,
  Platform,
  Modal
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MenuIcon from './MenuIcon';
import { useNotifications } from '../NotificationContext';
import { format, formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  sendLocalNotification,
  simulateFirebaseNotification,
  checkNotificationStatus
} from '../sendTestNotification';
import i18n, { addLanguageChangeListener } from '../utils/i18n';
import NotificationItem from '../components/NotificationItem';
import ZoneBreachNotification from '../components/ZoneBreachNotification';
import ZoneBreachTestButton from '../components/ZoneBreachTestButton';
import EmptyState from '../components/EmptyState';
import FilterChip from '../components/FilterChip';
// import { apiService } from '../services/api';

const { width, height } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [filter, setFilter] = useState('all');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showTestSection, setShowTestSection] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);
  const [showZoneBreachSection, setShowZoneBreachSection] = useState(true);
  const filterOptions = useMemo(() => ([
    { type: 'all', label: i18n.t('all'), icon: 'apps' },
    { type: 'unread', label: i18n.t('filterUnread'), icon: 'mail-unread' },
    { type: 'zone_breach', label: i18n.t('filterZoneAlerts'), icon: 'location' },
    { type: 'emergency', label: i18n.t('filterEmergency'), icon: 'warning' },
    { type: 'warning', label: i18n.t('filterWarning'), icon: 'alert-circle' },
    { type: 'info', label: i18n.t('filterInfo'), icon: 'information-circle' }
  ]), [currentLanguage]);
  // Using notifications from context (already mapped from alerts by apiService)
  // const [alerts, setAlerts] = useState([]);
  // const [mergedItems, setMergedItems] = useState([]);

  // Animation values
  const headerAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  const actionAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Collapsing header values
  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [16, 6],
    extrapolate: 'clamp',
  });
  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [20, 6],
    extrapolate: 'clamp',
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });
  const iconScale = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 20],
    outputRange: [0.05, 0.12],
    extrapolate: 'clamp',
  });
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -28],
    extrapolate: 'clamp',
  });

  const {
    notifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    clearRead,
    deleteNotification,
    markFilteredAsRead,
    clearFilteredRead,
    clearFilteredAll,
    refreshNotifications,
    soundEnabled,
    toggleSound
  } = useNotifications();

  // Refresh notifications when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshNotifications && refreshNotifications();
    });
    return unsubscribe;
  }, [navigation, refreshNotifications]);

  // Filtered notifications based on user role
  const [filteredNotifications, setFilteredNotifications] = useState([]);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          setUserRole(user.role);
          setUserId(user.id); // Use numeric ID for database consistency
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      }
    };

    loadUserData();
  }, []);

  // Load persisted preference
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('notifications_enabled');
        if (stored !== null) setNotificationsEnabled(stored === 'true');
      } catch { }
    })();
  }, []);

  // Persist preference on change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('notifications_enabled', notificationsEnabled ? 'true' : 'false');
      } catch { }
    })();
  }, [notificationsEnabled]);

  // Filter notifications based on user role
  useEffect(() => {
    if (!notifications) return;

    if (userRole === 'soldier') {
      setFilteredNotifications(
        notifications.filter(notification => {
          // If the notification has a userId, it must match the current user
          // If it doesn't have one (though it should), we show it as a fallback
          return !notification.userId || Number(notification.userId) === Number(userId);
        })
      );
    } else {
      setFilteredNotifications(notifications);
    }
  }, [notifications, userRole, userId]);

  // No local alert merge; filteredNotifications already reflects alert data mapping

  // Animate components on mount
  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(filterAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(actionAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, []);

  const toggleDropdown = () => {
    setDropdownVisible(prev => !prev);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: undefined
    });
  }, [navigation]);

  // Diagnose push notification issues
  const diagnosePushNotifications = async () => {
    try {
      const status = await checkNotificationStatus();

      Alert.alert(
        i18n.t('notificationDiagnosticTitle'),
        [
          `${i18n.t('permissionStatus')}: ${status.permissionsGranted ? i18n.t('granted') : i18n.t('denied')}`,
          `${i18n.t('storedNotifications')}: ${status.hasStoredNotifications ? i18n.t('yes') : i18n.t('no')}`,
          `${i18n.t('pushToken')}: ${status.hasPushToken ? i18n.t('available') : i18n.t('notAvailable')}`,
          `${i18n.t('status')}: ${status.status || i18n.t('unknown')}`
        ].join('\n'),
        [
          {
            text: i18n.t('requestPermissions'),
            onPress: async () => {
              const { status } = await Notifications.requestPermissionsAsync();
              Alert.alert(i18n.t('permissionStatus'), `${i18n.t('newStatus')}: ${status}`);
            }
          },
          {
            text: i18n.t('refreshNotifications'),
            onPress: () => refreshNotifications()
          },
          {
            text: i18n.t('ok'),
            style: "cancel"
          }
        ]
      );
    } catch (error) {
      Alert.alert(i18n.t('error'), `Failed to check notification status: ${error.message}`);
    }
  };

  // Separate zone breach and return notifications from regular notifications
  const zoneBreachNotifications = (filteredNotifications || [])
    .filter(item => item.type === 'zone_breach' || item.type === 'zone_return' || item.category === 'zone_breach' || item.category === 'zone_return')
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
      const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
      return timeB - timeA;
    });

  const regularNotifications = (filteredNotifications || [])
    .filter(item => item.type !== 'zone_breach' && item.type !== 'zone_return' && item.category !== 'zone_breach' && item.category !== 'zone_return')
    .filter(item => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !item.read;
      return item.type === filter;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
      const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
      return timeB - timeA;
    });

  // Apply type filter across items and sort by newest first
  const displayNotifications = (filteredNotifications || [])
    .filter(item => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !item.read;
      return item.type === filter;
    })
    .sort((a, b) => {
      // Sort by newest first (most recent timestamp first)
      const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
      const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
      return timeB - timeA;
    });

  const renderNotificationItem = ({ item, index }) => (
    <NotificationItem
      notification={item}
      onPress={(notification) => markAsRead(notification.id)}
      onDelete={(id) => deleteNotification(id)}
      index={index}
    />
  );

  const renderZoneBreachItem = ({ item, index }) => (
    <ZoneBreachNotification
      notification={item}
      onPress={(notification) => markAsRead(notification.id)}
      onDelete={(id) => deleteNotification(id)}
      index={index}
    />
  );

  const renderFilterChip = (filterType, label, icon) => (
    <FilterChip
      label={label}
      icon={icon}
      isActive={filter === filterType}
      onPress={() => setFilter(filterType)}
    />
  );

  const getFilterCount = (filterType) => {
    if (filterType === 'all') return (filteredNotifications || []).length;
    if (filterType === 'unread') return (filteredNotifications || []).filter(n => !n.read).length;
    return (filteredNotifications || []).filter(n => n.type === filterType).length;
  };

  const headerCountValue = getFilterCount(filter);
  const headerCountText = i18n.t(headerCountValue === 1 ? 'notificationCountSingular' : 'notificationCountPlural', { count: headerCountValue });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Premium Header */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0]
              })
            }],
            opacity: headerAnim,
            paddingTop: headerPaddingTop,
            paddingBottom: headerPaddingBottom,
            shadowOpacity: headerShadowOpacity
          }
        ]}
      >
        <Animated.View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Animated.View style={[styles.headerIconContainer, { transform: [{ scale: iconScale }] }]}>
              <Icon name="notifications" size={24} color="#10B981" />
            </Animated.View>
            <View style={styles.headerTextContainer}>
              <Animated.Text style={[styles.headerSubtitle, { transform: [{ translateY: titleTranslateY }] }]}>
                {i18n.t('notifications')}
              </Animated.Text>
              <Text style={styles.headerCount}>
                {headerCountText}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
          >
            <Icon name="settings-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </Animated.View>


      </Animated.View>

      {/* Enhanced Filter Section */}
      <Animated.View
        style={[
          styles.filterContainer,
          {
            transform: [{
              translateY: filterAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-30, 0]
              })
            }],
            opacity: filterAnim
          }
        ]}
      >
        <View style={styles.filterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.filterTitle}>{i18n.t('filterByType')}</Text>
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{filteredNotifications.length}</Text>
            </View>
          </View>

          {/* Sound Controls */}
          <View style={styles.soundControls}>
            <TouchableOpacity
              style={[
                styles.soundButton,
                soundEnabled && styles.soundButtonActiveOn
              ]}
              onPress={() => !soundEnabled && toggleSound()}
              activeOpacity={0.7}
            >
              <Icon
                name="volume-high"
                size={14}
                color={soundEnabled ? '#FFFFFF' : '#6B7280'}
                style={{ marginRight: 4 }}
              />
              <Text style={[
                styles.soundButtonText,
                soundEnabled && styles.soundButtonTextActive
              ]}>SOUND ON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.soundButton,
                !soundEnabled && styles.soundButtonActiveOff,
                { marginLeft: 8 }
              ]}
              onPress={() => soundEnabled && toggleSound()}
              activeOpacity={0.7}
            >
              <Icon
                name="volume-mute"
                size={14}
                color={!soundEnabled ? '#FFFFFF' : '#6B7280'}
                style={{ marginRight: 4 }}
              />
              <Text style={[
                styles.soundButtonText,
                !soundEnabled && styles.soundButtonTextActive
              ]}>SOUND OFF</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterOptions}
          renderItem={({ item }) => renderFilterChip(item.type, item.label, item.icon)}
          keyExtractor={item => item.type}
          contentContainerStyle={styles.filterList}
        />
      </Animated.View>

      {/* Page-level actions removed (use settings menu instead) */}

      {/* Zone Breach Notifications Section */}
      {showZoneBreachSection && zoneBreachNotifications.length > 0 && (
        <Animated.View
          style={[
            styles.sectionContainer,
            {
              transform: [{
                translateY: actionAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }],
              opacity: actionAnim
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Icon name="location" size={20} color="#DC2626" />
              <Text style={styles.sectionTitle}>{i18n.t('zoneAlerts')}</Text>
              <View style={styles.breachCount}>
                <Text style={styles.breachCountText}>{zoneBreachNotifications.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.collapseButton}
              onPress={() => setShowZoneBreachSection(!showZoneBreachSection)}
            >
              <Icon
                name={showZoneBreachSection ? "chevron-up" : "chevron-down"}
                size={16}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={zoneBreachNotifications}
            keyExtractor={(item) => `zone-${item.id}`}
            renderItem={renderZoneBreachItem}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            contentContainerStyle={styles.zoneBreachList}
          />
        </Animated.View>
      )}

      {/* Regular Notifications Section */}
      <View style={styles.regularNotificationsContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Icon name="notifications" size={20} color="#10B981" />
            <Text style={styles.sectionTitle}>{i18n.t('otherNotifications')}</Text>
            <View style={styles.regularCount}>
              <Text style={styles.regularCountText}>{regularNotifications.length}</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={regularNotifications}
          keyExtractor={(item) => `regular-${item.id}`}
          renderItem={renderNotificationItem}
          contentContainerStyle={[styles.listContainer, { paddingBottom: styles.listContainer.paddingBottom + Math.max(insets.bottom, 16) }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
              progressBackgroundColor="#FFFFFF"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off"
              title={i18n.t('noNotifications')}
              subtitle={i18n.t('notificationEmptySubtitle')}
              iconColor="#D1D5DB"
            />
          }
        />
      </View>

      {/* Enhanced Test Section */}
      {showTestSection && (
        <Animated.View
          style={styles.testContainer}
          entering={Animated.spring({
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          })}
          exiting={Animated.timing({
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          })}
        >
          <View style={styles.testHeader}>
            <View style={styles.testHeaderLeft}>
              <Icon name="flask" size={20} color="#10B981" />
              <Text style={styles.testTitle}>{i18n.t('testNotifications')}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTestSection(false)}
              activeOpacity={0.7}
            >
              <Icon name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.testButtons}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => {
                sendLocalNotification(
                  i18n.t('testLocalNotificationTitle'),
                  i18n.t('testLocalNotificationMessage'),
                  { type: 'info' }
                );
              }}
              activeOpacity={0.7}
            >
              <Icon name="phone-portrait" size={16} color="#FFFFFF" />
              <Text style={styles.testButtonText}>{i18n.t('local')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => {
                simulateFirebaseNotification({
                  title: i18n.t('testFirebaseNotification'),
                  message: i18n.t('testFirebaseNotificationMessage'),
                  type: 'info'
                });
              }}
              activeOpacity={0.7}
            >
              <Icon name="cloud" size={16} color="#FFFFFF" />
              <Text style={styles.testButtonText}>{i18n.t('firebase')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={diagnosePushNotifications}
              activeOpacity={0.7}
            >
              <Icon name="medical" size={16} color="#FFFFFF" />
              <Text style={styles.testButtonText}>{i18n.t('diagnose')}</Text>
            </TouchableOpacity>

            <ZoneBreachTestButton />
          </View>
        </Animated.View>
      )}

      {/* Settings Modal */}
      <Modal transparent visible={settingsVisible} animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('notificationSettingsTitle')}</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Icon name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="notifications" size={18} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 15, color: '#374151', fontWeight: '600' }}>{i18n.t('enableNotifications')}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
                ios_backgroundColor="#E5E7EB"
              />
            </View>
            <View style={styles.divider} />
            {/* Bulk action buttons removed as requested */}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  toggleLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIcon: {
    marginRight: 8,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  filterCount: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterList: {
    paddingHorizontal: 24,
  },
  actionsContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  testContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  testHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
    flex: 1,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  modalActionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionContainer: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  breachCount: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  breachCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  regularCount: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  regularCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneBreachList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  regularNotificationsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  soundControls: {
    flexDirection: 'row',
  },
  soundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  soundButtonActiveOn: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  soundButtonActiveOff: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  soundButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  soundButtonTextActive: {
    color: '#FFFFFF',
  },
}); 