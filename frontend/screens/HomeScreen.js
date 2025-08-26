import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, SafeAreaView, Alert, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import MenuIcon from './MenuIcon';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNotifications } from '../NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../utils/i18n';
import { useLocationSync } from '../utils/useLocationSync';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation, route }) {
  // Default values for user info
  const [userRole, setUserRole] = useState('soldier');
  // Removed userName/userUnit usage
  
  // Load user info from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.role) setUserRole(user.role);
          // name/unit not used
        }
      } catch (error) {
        console.error('Error loading user data in HomeScreen:', error);
      }
    };
    
    loadUserData();
  }, []);
  
  // Extract user info from route params if available - use params only if provided
  useEffect(() => {
    if (route.params) {
      if (route.params.userRole) setUserRole(route.params.userRole);
      if (route.params.userName) setUserName(route.params.userName);
      if (route.params.userUnit) setUserUnit(route.params.userUnit);
    }
  }, [route.params]);
  
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(null);
  // removed selectedAsset/trackingEnabled
  const [mapType, setMapType] = useState('standard');
  
  const [userId, setUserId] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  // Load userId and photo from AsyncStorage (mount + focus)
  const loadUserFromStorage = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.id) setUserId(user.id);
        if (user.photo || user.profileImage) {
          setUserPhoto(user.photo || user.profileImage);
        }
      }
    } catch (error) {
      console.error('Error loading user in HomeScreen:', error);
    }
  };

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserFromStorage();
    }, [])
  );

  // Call useLocationSync with userId
  useLocationSync(userId);
  
  // Remove unit-based filtering (not used)
  
  // Mock data removed: show only user's location
  const allPersonnel = [];
  
  // Personnel and socket updates removed

  // Geofences removed
  const operationalZones = [];

  const toggleDropdown = () => {
    setDropdownVisible(prev => !prev);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MenuIcon
          toggleDropdown={toggleDropdown}
          dropdownVisible={dropdownVisible}
          setDropdownVisible={setDropdownVisible}
        />
      ),
      title: 'Your Location',
    });
  }, [navigation, dropdownVisible]);

  // Get the addNotification function from context
  const { addNotification } = useNotifications();

  useEffect(() => {
    (async () => {
      try {
        // Request permission to access location
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          addNotification({
            title: i18n.t('permissionDenied'),
            message: i18n.t('locationPermissionDenied'),
            type: 'warning'
          });
          // Set default region even without location permission
          setRegion(defaultRegion);
          return;
        }

        // Get current location
        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
          maximumAge: 60000
        });
        
        if (!loc || !loc.coords) {
          console.warn('Location not available, using default region');
          setRegion(defaultRegion);
          return;
        }
        
        setLocation(loc.coords);
        console.log('Current location:', loc.coords); // Debug log

        // Set map region to center on user location
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        console.error('Error getting location:', error);
        // Set default region on error
        setRegion(defaultRegion);
        addNotification({
          title: i18n.t('locationError'),
          message: 'Using default location. Please check your location settings.',
          type: 'warning'
        });
      }
    })();
  }, [addNotification]);

  // Get status color based on status
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4CAF50'; // Green
      case 'warning':
        return '#FF9800'; // Orange
      case 'critical':
        return '#F44336'; // Red
      case 'offline':
        return '#757575'; // Gray
      default:
        return '#757575';
    }
  };

  // Get status text for display
  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'warning':
        return 'Warning';
      case 'critical':
        return 'Critical';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getMarkerIcon = (type) => {
    return type === 'commander' ? 'star' : 'shield';
  };

  const toggleMapType = () => {
    setMapType(mapType === 'standard' ? 'satellite' : 'standard');
  };

  // Removed view mode and personnel centering

  const centerOnUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        addNotification({
          title: i18n.t('permissionDenied'),
          message: i18n.t('locationPermissionDenied'),
          type: 'warning'
        });
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02, // slightly larger for a more visible recenter
        longitudeDelta: 0.02,
      });
      setSelectedAsset(null);
    } catch (error) {
      addNotification({
        title: i18n.t('locationError'),
        message: i18n.t('failedToGetCurrentLocation'),
        type: 'warning'
      });
    }
  };

  const switchUnit = (unit) => {
    setCurrentUnit(unit);
    setSelectedAsset(null);
  };

  const sendEmergencyAlert = (person) => {
    addNotification({
      title: i18n.t('emergencyAlert'),
      message: `Emergency response has been dispatched to ${person.name}'s location.`,
      type: 'emergency',
      soldierId: person.id
    });
  };

  const sendMessage = (person) => {
    addNotification({
      title: i18n.t('messageSent'),
      message: `Your message has been sent to ${person.name}.`,
      type: 'info',
      soldierId: person.id
    });
  };

  // Set a default region if region is not set
  const defaultRegion = {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        region={region || defaultRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType={mapType}
        provider={undefined}
        onError={(error) => {
          console.error('Map Error:', error);
          console.error('Map Error Details:', JSON.stringify(error, null, 2));
          setMapError(true);
        }}
        onMapReady={() => {
          console.log('Map is ready');
          setMapError(false);
          setMapLoading(false);
        }}
      >
        {/* Show user's current location as a custom marker */}
        {location && (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="You are here"
            pinColor="#2E3192"
          >
            {(() => {
              const uri = (() => {
                if (typeof userPhoto !== 'string' || userPhoto.length === 0) return null;
                const v = userPhoto.trim();
                if (v.startsWith('data:')) return v; // data URI
                if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('file://')) return v; // direct URL or file
                // assume raw base64
                return `data:image/jpeg;base64,${v}`;
              })();
              if (uri) {
                return (
                  <Image source={{ uri }} style={styles.userMarkerImage} />
                );
              }
              return (
                <View style={{ backgroundColor: '#2E3192', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: '#fff' }}>
                  <Icon name="person" size={18} color="#fff" />
                </View>
              );
            })()}
          </Marker>
        )}
        {/* No additional overlays */}
      </MapView>
      
      {/* Loading indicator */}
      {mapLoading && (
        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
          <ActivityIndicator size="large" color="#2E3192" />
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginTop: 10 }}>
            Loading map...
          </Text>
        </View>
      )}
      
      {/* Fallback view if map fails to load */}
      {mapError && !mapLoading && (
        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
          <Text style={{ fontSize: 18, color: '#666', textAlign: 'center' }}>
            Map could not be loaded{'\n'}
            Please check your internet connection{'\n'}
            and try again
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 20, padding: 10, backgroundColor: '#2E3192', borderRadius: 5 }}
            onPress={() => {
              setMapError(false);
              setMapLoading(true);
            }}
          >
            <Text style={{ color: '#fff' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* No unit selector */}
      
      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity 
          style={styles.mapControlButton}
          onPress={toggleMapType}
        >
          <Icon name={mapType === 'standard' ? 'map' : 'earth'} size={24} color="#fff" />
        </TouchableOpacity>
        
        
        <TouchableOpacity 
          style={styles.mapControlButton}
          onPress={centerOnUserLocation}
        >
          <Icon name="locate" size={24} color="#fff" />
        </TouchableOpacity>
        
        
      </View>
      
      {/* No personnel info panel */}
    </View>
    </SafeAreaView>
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
  map: {
    width: '100%',
    height: '100%',
  },
  userMarkerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#eee'
  },
  unitSelector: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 5,
    padding: 5,
  },
  unitButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginHorizontal: 2,
    borderRadius: 3,
  },
  activeUnitButton: {
    backgroundColor: '#2E3192',
  },
  unitButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  activeUnitButtonText: {
    color: '#fff',
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'column',
  },
  mapControlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  personnelMarker: {
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  personnelMarkerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
    marginLeft: 3,
  },
  personnelInfoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 15,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    elevation: 5,
  },
  personnelInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  personnelInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  personnelInfoId: {
    fontSize: 14,
    color: '#757575',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  personnelInfoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
  },
  personnelInfoDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 5,
    color: '#333',
    fontWeight: 'bold',
  },
  personnelInfoSubDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  personnelInfoSubDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subDetailText: {
    marginLeft: 5,
    color: '#757575',
    fontSize: 12,
  },
  personnelInfoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  personnelInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  personnelInfoButtonText: {
    marginLeft: 5,
    fontWeight: 'bold',
    color: '#333',
  },
  alertButton: {
    backgroundColor: '#F44336',
  },
  alertButtonText: {
    marginLeft: 5,
    fontWeight: 'bold',
    color: '#fff',
  },
});
