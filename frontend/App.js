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
import { ActivityIndicator, View } from 'react-native';
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
import PasswordRecoveryScreen from './screens/PasswordRecoveryScreen';
import SoldierDetailScreen from './screens/SoldierDetailScreen';
import { NotificationProvider } from './NotificationContext';
import NotificationBadge from './components/NotificationBadge';
import { initializeFirebaseNotifications } from './firebase-config';
import 'react-native-get-random-values';
import AssignmentScreen from './screens/AssignmentScreen';
import AssignmentDetailScreen from './screens/AssignmentDetailScreen';
import i18n, { addLanguageChangeListener, setLocale } from './utils/i18n';
import { startBackgroundLocation, updateCachedUserData } from './services/backgroundLocationService';

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
  
  return (
    <Tab.Navigator
      key={currentLanguage} // Force re-render when language changes
      screenOptions={{
        tabBarStyle: { 
          height: 60 + insets.bottom, // Add bottom safe area height
          paddingBottom: insets.bottom, // Add padding for bottom safe area
          paddingTop: 5,
          backgroundColor: green.background,
          borderTopColor: green.primary,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: green.primary,
        tabBarInactiveTintColor: green.dark,
        headerStyle: {
          backgroundColor: green.primary,
        },
        headerTintColor: green.background,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          headerTitle: i18n.t('assetTracking'),
          tabBarIcon: ({ color, size, focused }) => (
            <Icon name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
          tabBarLabel: i18n.t('track')
        }}
      />
      {userRole !== 'soldier' && (
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{
            headerTitle: i18n.t('dashboard'),
            tabBarIcon: ({ color, size, focused }) => (
              <Icon name={focused ? 'speedometer' : 'speedometer-outline'} size={size} color={color} />
            ),
            tabBarLabel: i18n.t('dashboard')
          }}
        />
      )}
      <Tab.Screen 
        name="Geospatial" 
        component={GeospatialScreen} 
        options={{
          headerTitle: i18n.t('geospatial'),
          tabBarIcon: ({ color, size, focused }) => (
            <Icon name={focused ? 'location' : 'location-outline'} size={size} color={color} />
          ),
          tabBarLabel: i18n.t('search')
        }}
      />
      {userRole === 'soldier' && (
        <Tab.Screen
          name="Assignment"
          component={AssignmentScreen}
          options={{
            headerTitle: i18n.t('assignment'),
            tabBarIcon: ({ color, size, focused }) => (
              <Icon name={focused ? 'clipboard-outline' : 'clipboard'} size={size} color={color} />
            ),
            tabBarLabel: i18n.t('assignment'),
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
          tabBarLabel: i18n.t('profile')
        }}
      />
    </Tab.Navigator>
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
        if (savedLanguage) {
          setLocale(savedLanguage);
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
        return () => {};
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

  useEffect(() => {
    // Start background location tracking if user is logged in
    const checkAndStartBackgroundLocation = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          if (user && user.id) {
            // Update cached user data
            await updateCachedUserData();
            // Start background location tracking
            const success = await startBackgroundLocation();
            if (success) {
              console.log('[App] Background location tracking started successfully');
            } else {
              console.warn('[App] Failed to start background location tracking');
            }
          }
        }
      } catch (error) {
        console.error('[App] Error starting background location:', error);
      }
    };
    checkAndStartBackgroundLocation();
  }, []);

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
              headerRight: () => 
                route.name !== 'Login' && route.name !== 'Register' && route.name !== 'SoldierDetail'
                  ? <NotificationBadge /> 
                  : null,
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
              name="Reports" 
              component={ReportsScreen} 
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
  } catch {}
}

let __notifNavBound = false;
if (!__notifNavBound) {
  __notifNavBound = true;
  // Listener for taps when app is running/backgrounded
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    // Route all pushes to Notifications screen
    if (navigationRef?.isReady()) {
      try { navigationRef.navigate('Notifications'); } catch {}
    } else {
      // If nav not ready yet, defer briefly
      setTimeout(() => { if (navigationRef?.isReady()) { try { navigationRef.navigate('Notifications'); } catch {} } }, 500);
    }
  });

  // Handle taps that launched the app from a quit state
  (async () => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        setTimeout(() => {
          if (navigationRef?.isReady()) {
            try { navigationRef.navigate('Notifications'); } catch {}
          }
        }, 800);
      }
    } catch {}
  })();
}