import React, { useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
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
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
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
import i18n from '../utils/i18n';
import NotificationItem from '../components/NotificationItem';
import EmptyState from '../components/EmptyState';
import FilterChip from '../components/FilterChip';
// import { apiService } from '../services/api';

const { width, height } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [filter, setFilter] = useState('all');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showTestSection, setShowTestSection] = useState(false);
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
    markFilteredAsRead,
    clearFilteredRead,
    clearFilteredAll,
    refreshNotifications
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
          setUserId(user.serviceId);
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      }
    };
    
    loadUserData();
  }, []);
  
  // Filter notifications based on user role
  useEffect(() => {
    if (!notifications) return;
    
    if (userRole === 'soldier') {
      setFilteredNotifications(
        notifications.filter(notification => 
          !notification.soldierId || notification.soldierId === userId
        )
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
        `Permissions: ${status.permissionsGranted ? i18n.t('granted') : i18n.t('denied')}\n` +
        `Stored Notifications: ${status.hasStoredNotifications ? i18n.t('yes') : i18n.t('no')}\n` +
        `Push Token: ${status.hasPushToken ? i18n.t('available') : i18n.t('notAvailable')}\n` +
        `Status: ${status.status || i18n.t('unknown')}`,
        [
          {
            text: i18n.t('requestPermissions'),
            onPress: async () => {
              const { status } = await Notifications.requestPermissionsAsync();
              Alert.alert(i18n.t('permissionStatus'), `New status: ${status}`);
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

  // Apply type filter across items
  const displayNotifications = (filteredNotifications || []).filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const renderNotificationItem = ({ item, index }) => (
    <NotificationItem
      notification={item}
      onPress={(notification) => markAsRead(notification.id)}
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
    return (filteredNotifications || []).filter(n => n.type === filterType).length;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Premium Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            transform: [{ translateY: headerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, 0]
            })}],
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
              <Animated.Text style={[styles.headerSubtitle, { transform: [{ translateY: titleTranslateY }] }]}>Notifications</Animated.Text>
              <Text style={styles.headerCount}>
                {getFilterCount(filter)} {getFilterCount(filter) === 1 ? 'notification' : 'notifications'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setShowTestSection(!showTestSection)}
            activeOpacity={0.7}
          >
            <Icon name="settings-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </Animated.View>
        
        <View style={styles.headerControls}>
          <View style={styles.toggleContainer}>
            <View style={styles.toggleLabelContainer}>
              <Icon name="notifications-circle" size={16} color="#10B981" style={styles.toggleIcon} />
              <Text style={styles.toggleLabel}>Enable Notifications</Text>
            </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
              ios_backgroundColor="#E5E7EB"
          />
        </View>
      </View>
      </Animated.View>
      
      {/* Enhanced Filter Section */}
      <Animated.View 
        style={[
          styles.filterContainer,
          {
            transform: [{ translateY: filterAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-30, 0]
            })}],
            opacity: filterAnim
          }
        ]}
      >
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filter by Type</Text>
          <View style={styles.filterCount}>
            <Text style={styles.filterCountText}>{filteredNotifications.length}</Text>
          </View>
      </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { type: 'all', label: 'All', icon: 'apps' },
            { type: 'emergency', label: 'Emergency', icon: 'warning' },
            { type: 'warning', label: 'Warning', icon: 'alert-circle' },
            { type: 'info', label: 'Info', icon: 'information-circle' }
          ]}
          renderItem={({ item }) => renderFilterChip(item.type, item.label, item.icon)}
          keyExtractor={item => item.type}
          contentContainerStyle={styles.filterList}
        />
      </Animated.View>
      
      {/* Enhanced Action Buttons */}
      <Animated.View 
        style={[
          styles.actionsContainer,
          {
            transform: [{ translateY: actionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0]
            })}],
            opacity: actionAnim
          }
        ]}
      >
        <View style={styles.actionButtonsRow}>
        <TouchableOpacity 
          style={styles.actionButton}
            onPress={() => markFilteredAsRead(filter)}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Icon name="checkmark-done" size={16} color="#10B981" />
              <Text style={[styles.actionButtonText, { color: '#10B981' }]}> 
                Mark {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Read
              </Text>
            </View>
        </TouchableOpacity>
          
        <TouchableOpacity 
          style={styles.actionButton}
            onPress={() => clearFilteredRead(filter)}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Icon name="trash-outline" size={16} color="#6B7280" />
              <Text style={styles.actionButtonText}>
                Clear {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Read
              </Text>
            </View>
        </TouchableOpacity>
          
        <TouchableOpacity 
          style={styles.actionButton}
            onPress={() => clearFilteredAll(filter)}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Icon name="trash" size={16} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}> 
                Clear {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </View>
        </TouchableOpacity>
      </View>
      </Animated.View>

      {/* Enhanced Notifications List */}
        <FlatList
          data={displayNotifications}
          keyExtractor={(item) => item.id}
        renderItem={renderNotificationItem}
        contentContainerStyle={styles.listContainer}
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
            subtitle="You're all caught up! New notifications will appear here."
            iconColor="#D1D5DB"
          />
        }
      />
        
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
              <Text style={styles.testTitle}>Test Notifications</Text>
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
                  'Test Local Notification',
                  'This is a test local notification',
                  { type: 'info' }
                );
              }}
              activeOpacity={0.7}
            >
              <Icon name="phone-portrait" size={16} color="#FFFFFF" />
              <Text style={styles.testButtonText}>Local</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => {
                simulateFirebaseNotification({
                  title: i18n.t('testFirebaseNotification'),
                  message: 'This is a test Firebase notification',
                  type: 'info'
                });
              }}
              activeOpacity={0.7}
            >
              <Icon name="cloud" size={16} color="#FFFFFF" />
              <Text style={styles.testButtonText}>Firebase</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.testButton}
              onPress={diagnosePushNotifications}
              activeOpacity={0.7}
            >
              <Icon name="medical" size={16} color="#FFFFFF" />
              <Text style={styles.testButtonText}>Diagnose</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
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
}); 