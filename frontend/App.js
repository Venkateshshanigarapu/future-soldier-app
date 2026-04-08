import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { green } from './theme';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, View, TouchableOpacity, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';


import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import DashboardScreen from './screens/DashboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ReportsScreen from './screens/ReportsScreen';
import GeospatialScreen from './screens/GeospatialScreen';
import CombinedMapScreen from './screens/CombinedMapScreen';
import PasswordRecoveryScreen from './screens/PasswordRecoveryScreen';
import SoldierDetailScreen from './screens/SoldierDetailScreen';
import { NotificationProvider } from './NotificationContext';
import NotificationBadge from './components/NotificationBadge';
import { initializeFirebaseNotifications } from './firebase-config';
import 'react-native-get-random-values';
import AssignmentScreen from './screens/AssignmentScreen';
import AssignmentDetailScreen from './screens/AssignmentDetailScreen';
import MoreOptionsScreen from './screens/MoreOptionsScreen';
import OperationDetailsScreen from './screens/OperationDetailsScreen';
import HealthDetailsScreen from './screens/HealthDetailsScreen';
import TimelineScreen from './screens/TimelineScreen';
import AssignmentEditScreen from './screens/AssignmentEditScreen';
import SoldierDashboardScreen from './screens/SoldierDashboardScreen';
import SettingsScreen from './screens/SettingsScreen';
import AmmoScreen from './screens/AmmoScreen';
import i18n, { addLanguageChangeListener, setLocale } from './utils/i18n';
import { apiService } from './services/api';
// Background location service disabled - using database location only
// import { startBackgroundLocation, updateCachedUserData, retryFailedLocationUpdates, queueLocationStart, startLocationServiceMonitor } from './services/backgroundLocationService';
import SideDrawer from './components/SideDrawer';

// Create the navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Navigation ref to enable navigation from non-component contexts (e.g., notification taps)
export const navigationRef = createNavigationContainerRef();

// Main tab navigator that will show at the bottom of the screen
function TabNavigator() {
  const [userRole, setUserRole] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
  const insets = useSafeAreaInsets();
  const [globalDrawerVisible, setGlobalDrawerVisible] = useState(false);

  // Listen for language changes
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      console.log('[TabNavigator] Language changed to:', i18n.locale);
      setCurrentLanguage(i18n.locale);
    });

    return unsubscribe;
  }, []);

  // Always reload userRole when TabNavigator is focused
  useFocusEffect(
    React.useCallback(() => {
      const loadUserRole = async () => {
        try {
          const userData = await AsyncStorage.getItem('currentUser');
          if (userData) {
            const user = JSON.parse(userData);
            setUserRole(user.role);
          }
        } catch (error) {
          console.error('Error loading user role:', error);
        }
      };
      loadUserRole();
    }, [])
  );

  // Role-adaptive wrappers to unify layout
  const DashboardUnified = (props) => {
    return userRole === 'soldier' ? (
      <SoldierDashboardScreen {...props} />
    ) : (
      <DashboardScreen {...props} />
    );
  };

  return (
    <>
      <Tab.Navigator
        initialRouteName="Map"
        key={currentLanguage} // Force re-render when language changes
        screenOptions={{
          tabBarStyle: {
            height: 60 + insets.bottom, // Add bottom safe area height
            paddingBottom: insets.bottom, // Add padding for bottom safe area
            paddingTop: 5,
            paddingHorizontal: 10,
            backgroundColor: green.background,
            borderTopColor: green.primary,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: green.primary,
          tabBarInactiveTintColor: green.dark,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
          headerStyle: {
            backgroundColor: green.primary,
          },
          headerTintColor: green.background,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  try { navigationRef.navigate('Notifications'); } catch { }
                }}
                style={{ marginRight: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <View>
                  <Icon name={'notifications'} size={22} color={green.background} />
                  <NotificationBadge style={{ position: 'absolute', top: -8, right: -8 }} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setGlobalDrawerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Open menu"
              >
                <Icon name={'menu'} size={22} color={green.background} />
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        <Tab.Screen
          name="Map"
          component={CombinedMapScreen}
          options={{
            headerTitle: i18n.t('assetTracking'),
            tabBarIcon: ({ color, size, focused }) => (
              <Icon name={focused ? 'map' : 'map-outline'} size={size} color={color} />
            ),
            tabBarLabel: i18n.t('map') || 'Map'
          }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardUnified}
          options={{
            headerTitle: i18n.t('dashboard'),
            tabBarIcon: ({ color, size, focused }) => (
              <Icon name={focused ? 'speedometer' : 'speedometer-outline'} size={size} color={color} />
            ),
            tabBarLabel: i18n.t('dashboard') || 'Dashboard'
          }}
        />
        <Tab.Screen
          name="Assignments"
          component={AssignmentScreen}
          options={{
            headerTitle: i18n.t('assignment') || 'Assignments',
            tabBarIcon: ({ color, size, focused }) => (
              <Icon name={focused ? 'clipboard' : 'clipboard-outline'} size={size} color={color} />
            ),
            tabBarLabel: i18n.t('assignment') || 'Assignments',
          }}
        />
        {/* Reports tab (hide for soldiers) */}
        {userRole !== 'soldier' && (
          <Tab.Screen
            name="Reports"
            component={ReportsScreen}
            options={{
              headerTitle: i18n.t('reports') || 'Reports',
              tabBarIcon: ({ color, size, focused }) => (
                <Icon name={focused ? 'document-text' : 'document-text-outline'} size={size} color={color} />
              ),
              tabBarLabel: i18n.t('reports') || i18n.t('report') || 'Reports',
            }}
          />
        )}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            headerTitle: i18n.t('profile'),
            tabBarIcon: ({ color, size, focused }) => (
              <Icon name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
            tabBarLabel: i18n.t('profile') || 'Profile'
          }}
        />
      </Tab.Navigator>
      <SideDrawer
        visible={globalDrawerVisible}
        onClose={() => setGlobalDrawerVisible(false)}
        navigation={navigationRef}
      />
    </>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      console.log('[App] Language changed to:', i18n.locale);
      setCurrentLanguage(i18n.locale);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // One-time notification permission + Android channel setup
    const initNotifications = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10B981',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            showBadge: true,
            bypassDnd: false,
            enableVibrate: true,
            enableLights: true,
            sound: 'default',
          });
        }

        const asked = await AsyncStorage.getItem('notifAsked');
        const settings = await Notifications.getPermissionsAsync();
        if (settings.status !== 'granted' && !asked) {
          await Notifications.requestPermissionsAsync();
          await AsyncStorage.setItem('notifAsked', '1');
        }
      } catch (e) {
        console.warn('Notification permission setup failed:', e);
      }
    };

    initNotifications();
  }, []);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          setInitialRoute('MainApp');
        } else {
          setInitialRoute('Login');
        }
      } catch (e) {
        setInitialRoute('Login');
      } finally {
        setCheckingLogin(false);
      }
    };

    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('appLanguage');
        // Only use supported languages: English, Hindi, Tamil
        const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'];
        if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage)) {
          // Only set locale if it's different from current to avoid unnecessary resets
          if (i18n.locale !== savedLanguage) {
            setLocale(savedLanguage);
          }
        } else if (savedLanguage && !SUPPORTED_LANGUAGES.includes(savedLanguage)) {
          // If saved language is not supported, reset to English
          await AsyncStorage.setItem('appLanguage', 'en');
          if (i18n.locale !== 'en') {
            setLocale('en');
          }
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
      }
    };

    checkLoginStatus();
    loadLanguage();
  }, []);

  // Initialize Firebase notifications
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Initialize Firebase notifications
        const cleanup = await initializeFirebaseNotifications();
        return cleanup;
      } catch (error) {
        console.error('Error initializing notifications:', error);
        // Return empty cleanup function
        return () => { };
      }
    };

    // Initialize and store the cleanup function
    const cleanupPromise = initializeNotifications();

    // Cleanup on unmount
    return () => {
      cleanupPromise.then(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, []);

  // DISABLED: Background location service removed - using database location only
  // useEffect(() => {
  //   // Background location tracking disabled
  //   const checkAndStartBackgroundLocation = async () => {
  //     // ... disabled code
  //   };
  //   checkAndStartBackgroundLocation();
  // }, []);

  if (checkingLogin || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: green.background }}>
        <ActivityIndicator size="large" color={green.primary} />
      </View>
    );
  }

  return (
    <NotificationProvider>
      <SafeAreaProvider style={{ backgroundColor: green.background }}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            key={currentLanguage} // Force re-render when language changes
            screenOptions={({ route }) => ({
              headerStyle: {
                backgroundColor: green.primary,
              },
              headerTintColor: green.background,
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              // Only show notification badge on screens other than Login, Register, and SoldierDetail
              headerRight: () => {
                const hideBadgeOn = new Set(['Login', 'Register', 'SoldierDetail', 'MoreOptions', 'Settings', 'OperationDetails', 'HealthDetails', 'Timeline', 'Ammo']);
                return hideBadgeOn.has(route.name) ? null : <NotificationBadge />;
              },
            })}
          >
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: i18n.t('createAccount') }}
            />

            <Stack.Screen
              name="MainApp"
              component={TabNavigator}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
            />

            <Stack.Screen
              name="PasswordRecovery"
              component={PasswordRecoveryScreen}
              options={{ title: i18n.t('passwordRecovery') }}
            />
            <Stack.Screen
              name="AssignmentDetail"
              component={AssignmentDetailScreen}
              options={{ title: 'Assignment Details' }}
            />
            <Stack.Screen
              name="SoldierDetail"
              component={SoldierDetailScreen}
              options={{ title: 'Soldier Details' }}
            />
            <Stack.Screen
              name="MoreOptions"
              component={MoreOptionsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: i18n.t('settings') || 'Settings' }}
            />
            <Stack.Screen name="OperationDetails" component={OperationDetailsScreen} options={{ title: 'Operation Details' }} />
            <Stack.Screen name="Ammo" component={AmmoScreen} options={{ title: 'Ammo' }} />
            <Stack.Screen name="HealthDetails" component={HealthDetailsScreen} options={{ title: 'Advanced Health Details' }} />
            <Stack.Screen name="Timeline" component={TimelineScreen} options={{ title: 'Timeline' }} />
            <Stack.Screen name="EditAssignment" component={AssignmentEditScreen} options={{ title: 'Edit Assignment' }} />
            <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </NotificationProvider>
  );
}

// Handle navigation when user taps a push notification
// Attach once at module level lifecycle via a safe effect
useEffectOnceForNotificationNavigation();

function useEffectOnceForNotificationNavigation() {
  try {
    // Guard against calling hooks conditionally; we call this function at module bottom
    // and internally manage single-subscription via a static flag.
  } catch { }
}

let __notifNavBound = false;
if (!__notifNavBound) {
  __notifNavBound = true;
  // Listener for taps when app is running/backgrounded
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    // Route all pushes to Notifications screen
    if (navigationRef?.isReady()) {
      try { navigationRef.navigate('Notifications'); } catch { }
    } else {
      // If nav not ready yet, defer briefly
      setTimeout(() => { if (navigationRef?.isReady()) { try { navigationRef.navigate('Notifications'); } catch { } } }, 500);
    }
  });
}