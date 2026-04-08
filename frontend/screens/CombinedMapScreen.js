import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  FlatList,
  ActivityIndicator,
  PermissionsAndroid,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import HomeScreen from './HomeScreen';
import GeospatialScreen from './GeospatialScreen';
import { green } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import indianCitiesData from '../india_cities_2026.json';
import { apiService } from '../services/api';
import * as ExpoLocation from 'expo-location';

export default function CombinedMapScreen(props) {
  const [mode, setMode] = useState('track'); // 'track' | 'search' | 'routes'
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [fromLocationType, setFromLocationType] = useState('current'); // 'current' | 'gps' | 'custom'
  const [fromLocation, setFromLocation] = useState('');
  const [customFromLocation, setCustomFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [hasAutoSetFromLocation, setHasAutoSetFromLocation] = useState(false);

  // Store selected user data with coordinates
  const [selectedFromUser, setSelectedFromUser] = useState(null);
  const [selectedToUser, setSelectedToUser] = useState(null);

  // Autocomplete states
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'from' or 'to'
  const [unitUsers, setUnitUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('soldier');
  const [currentUserId, setCurrentUserId] = useState(null);

  // Fetch user's current location and unit users on component mount
  useEffect(() => {
    fetchUserLocation();
    fetchUnitUsers();
  }, []);

  // Update fromLocation when userLocation is fetched (only once)
  useEffect(() => {
    if (userLocation && !hasAutoSetFromLocation) {
      setFromLocation('Your Location');
      setHasAutoSetFromLocation(true);
      console.log('[CombinedMapScreen] Auto-set fromLocation to Your Location after fetching user location');
    }
  }, [userLocation, hasAutoSetFromLocation]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const getCurrentGpsLocation = async () => {
    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
    };
  };

  const fetchGpsLocation = async () => {
    try {
      setGpsLoading(true);

      // Request permission first
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Location permission is required to use Mobile GPS.');
        setGpsLoading(false);
        return false;
      }

      // Get current GPS location
      const location = await getCurrentGpsLocation();

      if (location && location.latitude && location.longitude) {
        setGpsLocation(location);
        setFromLocationType('gps');
        setFromLocation('Mobile GPS');
        console.log('[CombinedMapScreen] GPS location obtained:', location);
        return true;
      } else {
        Alert.alert('Error', 'Could not get GPS location. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('[CombinedMapScreen] Error getting GPS location:', error);
      Alert.alert('GPS Error', 'Failed to get current location. Please check your GPS settings.');
      return false;
    } finally {
      setGpsLoading(false);
    }
  };

  const fetchUserLocation = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        console.log('[CombinedMapScreen] Full user data:', JSON.stringify(user, null, 2));

        // Store user info
        setCurrentUserId(user.id);
        setCurrentUserRole(user.role || 'soldier');

        // Check different possible field names for location
        const lat = user.latitude || user.lat || user.user_latitude;
        const lng = user.longitude || user.lng || user.user_longitude || user.long;

        console.log('[CombinedMapScreen] Location fields - lat:', lat, 'lng:', lng);

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          const location = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng)
          };
          setUserLocation(location);
          setFromLocation('Your Location');
          console.log('[CombinedMapScreen] User location successfully set:', location);
        } else {
          console.log('[CombinedMapScreen] No valid latitude/longitude found in user data');

          // Try to get location from API as fallback
          try {
            const response = await fetch(`http://117.251.19.107:3000/api/users/${user.id}/location`);
            if (response.ok) {
              const locationData = await response.json();
              if (locationData.latitude && locationData.longitude) {
                const location = {
                  latitude: locationData.latitude,
                  longitude: locationData.longitude
                };
                setUserLocation(location);
                setFromLocation('Your Location');
                console.log('[CombinedMapScreen] User location fetched from API:', location);
              }
            }
          } catch (apiError) {
            console.log('[CombinedMapScreen] API location fetch failed:', apiError);
          }
        }
      } else {
        console.log('[CombinedMapScreen] No user data found in AsyncStorage');
      }
    } catch (error) {
      console.error('[CombinedMapScreen] Error fetching user location:', error);
    }
  };

  const fetchUnitUsers = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const currentUser = JSON.parse(userData);
        const unit = currentUser.unit || currentUser.unit_name;

        if (unit) {
          console.log('[CombinedMapScreen] Fetching users for unit:', unit);

          // Fetch all users in the same unit
          let soldiers = [];
          let commanders = [];

          try {
            soldiers = await apiService.getUsersByRoleAndUnit('soldier', unit) || [];
          } catch (error) {
            console.warn('[CombinedMapScreen] Failed to fetch soldiers:', error);
          }

          try {
            commanders = await apiService.getUsersByRoleAndUnit('commander', unit) || [];
          } catch (error) {
            console.warn('[CombinedMapScreen] Failed to fetch commanders:', error);
          }

          // Combine and filter out current user
          const allUsers = [...soldiers, ...commanders];
          const otherUsers = allUsers.filter(u => u.id !== currentUser.id);

          // Process users
          const usersWithLocations = otherUsers.map(user => {
            const hasValidLocation = user.latitude !== null &&
              user.longitude !== null &&
              user.latitude !== 0 &&
              user.longitude !== 0 &&
              !isNaN(user.latitude) &&
              !isNaN(user.longitude);

            return {
              ...user,
              latitude: hasValidLocation ? user.latitude : null,
              longitude: hasValidLocation ? user.longitude : null,
              heading: user.heading || 0,
              lastUpdate: user.lastUpdate || new Date().toLocaleTimeString(),
              displayName: `${user.name || user.username} (${user.role})`,
              hasLocation: hasValidLocation
            };
          });

          setUnitUsers(usersWithLocations);
          console.log('[CombinedMapScreen] Fetched', usersWithLocations.length, 'unit users');
        }
      }
    } catch (error) {
      console.error('[CombinedMapScreen] Error fetching unit users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoutes = () => {
    console.log('[CombinedMapScreen] Route button clicked');
    console.log('[CombinedMapScreen] Current userLocation:', userLocation);
    console.log('[CombinedMapScreen] Current fromLocation:', fromLocation);

    setShowRouteModal(true);
    fetchUnitUsers(); // Refresh users list

    // If we don't have user location yet, try to fetch it again
    if (!userLocation) {
      console.log('[CombinedMapScreen] No user location, fetching again...');
      fetchUserLocation();
    }
  };

  // Handle from location text change with autocomplete (only when custom is selected)
  const handleFromLocationChange = (text) => {
    setCustomFromLocation(text);
    setActiveDropdown('from');
    // Clear selected user when typing
    setSelectedFromUser(null);

    if (text.length >= 2) {
      // Filter users that match the input
      const matches = unitUsers.filter(user =>
        user.username.toLowerCase().includes(text.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(text.toLowerCase()))
      ).slice(0, 5); // Limit to 5 suggestions

      // Add city suggestions from indianCitiesData
      const cityMatches = Object.keys(indianCitiesData)
        .filter(city => city.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 3)
        .map(city => ({
          id: `city-${city}`,
          type: 'city',
          displayName: city.charAt(0).toUpperCase() + city.slice(1),
          username: city,
          latitude: indianCitiesData[city].latitude,
          longitude: indianCitiesData[city].longitude
        }));

      setFromSuggestions([...cityMatches, ...matches]);
      setShowFromDropdown(true);
      setShowToDropdown(false); // Close other dropdown
    } else {
      setFromSuggestions([]);
      setShowFromDropdown(false);
    }
  };

  // Handle to location text change with autocomplete
  const handleToLocationChange = (text) => {
    setToLocation(text);
    setActiveDropdown('to');
    // Clear selected user when typing
    setSelectedToUser(null);

    if (text.length >= 2) {
      // Filter users that match the input
      const matches = unitUsers.filter(user =>
        user.username.toLowerCase().includes(text.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(text.toLowerCase()))
      ).slice(0, 5); // Limit to 5 suggestions

      // Add city suggestions from indianCitiesData
      const cityMatches = Object.keys(indianCitiesData)
        .filter(city => city.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 5)
        .map(city => ({
          id: `city-${city}`,
          type: 'city',
          displayName: city.charAt(0).toUpperCase() + city.slice(1),
          username: city,
          latitude: indianCitiesData[city].latitude,
          longitude: indianCitiesData[city].longitude
        }));

      setToSuggestions([...cityMatches, ...matches]);
      setShowToDropdown(true);
      setShowFromDropdown(false); // Close other dropdown
    } else {
      setToSuggestions([]);
      setShowToDropdown(false);
    }
  };

  const selectFromSuggestion = (suggestion) => {
    setCustomFromLocation(suggestion.displayName || suggestion.username);
    setShowFromDropdown(false);
    setActiveDropdown(null);

    // Store the selected user data if it's a user (not a city)
    if (suggestion.type !== 'city') {
      // Find the full user data from unitUsers
      const fullUser = unitUsers.find(u => u.id === suggestion.id);
      if (fullUser) {
        setSelectedFromUser(fullUser);
        console.log('[CombinedMapScreen] Selected from user:', fullUser.username, 'with coordinates:', fullUser.latitude, fullUser.longitude);
      }
    } else {
      // For cities, store the coordinates directly
      setSelectedFromUser({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        displayName: suggestion.displayName,
        isCity: true
      });
    }
  };

  const selectToSuggestion = (suggestion) => {
    setToLocation(suggestion.displayName || suggestion.username);
    setShowToDropdown(false);
    setActiveDropdown(null);

    // Store the selected user data if it's a user (not a city)
    if (suggestion.type !== 'city') {
      // Find the full user data from unitUsers
      const fullUser = unitUsers.find(u => u.id === suggestion.id);
      if (fullUser) {
        setSelectedToUser(fullUser);
        console.log('[CombinedMapScreen] Selected to user:', fullUser.username, 'with coordinates:', fullUser.latitude, fullUser.longitude);
      }
    } else {
      // For cities, store the coordinates directly
      setSelectedToUser({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        displayName: suggestion.displayName,
        isCity: true
      });
    }
  };

  const handleCalculateRoute = async () => {
    // Determine the actual from location based on type
    let actualFromLocation = '';
    if (fromLocationType === 'current') actualFromLocation = 'Your Location';
    else if (fromLocationType === 'gps') actualFromLocation = 'Mobile GPS';
    else actualFromLocation = customFromLocation;

    console.log('[CombinedMapScreen] Calculating route...');
    console.log('[CombinedMapScreen] From type:', fromLocationType);
    console.log('[CombinedMapScreen] From:', actualFromLocation);
    console.log('[CombinedMapScreen] To:', toLocation);
    console.log('[CombinedMapScreen] User location:', userLocation);
    console.log('[CombinedMapScreen] GPS location:', gpsLocation);
    console.log('[CombinedMapScreen] Selected from user:', selectedFromUser);
    console.log('[CombinedMapScreen] Selected to user:', selectedToUser);

    // Validate based on from location type
    if (fromLocationType === 'current' && !userLocation) {
      Alert.alert('Error', 'Your location is not available. Please select another option.');
      return;
    }

    if (fromLocationType === 'gps' && !gpsLocation) {
      Alert.alert('Error', 'Mobile GPS location is not available. Please try fetching GPS again.');
      return;
    }

    if (fromLocationType === 'custom' && !customFromLocation.trim() && !selectedFromUser) {
      Alert.alert('Error', 'Please enter a starting location or select a user');
      return;
    }

    if (!toLocation.trim() && !selectedToUser) {
      Alert.alert('Error', 'Please enter destination location or select a user');
      return;
    }

    try {
      setLoading(true);
      let from, to;
      let displayFromLocation = actualFromLocation;
      let displayToLocation = toLocation;

      // Handle FROM location based on type
      if (fromLocationType === 'current' && userLocation) {
        from = userLocation;
        displayFromLocation = 'Your Location';
        console.log('[CombinedMapScreen] Using your location:', from);
      } else if (fromLocationType === 'gps' && gpsLocation) {
        from = {
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude
        };
        displayFromLocation = 'Mobile GPS';
        console.log('[CombinedMapScreen] Using Mobile GPS location:', from);
      } else {
        // Custom location - check if we have a selected user with coordinates
        if (selectedFromUser && selectedFromUser.latitude && selectedFromUser.longitude) {
          from = {
            latitude: selectedFromUser.latitude,
            longitude: selectedFromUser.longitude
          };
          displayFromLocation = selectedFromUser.displayName || selectedFromUser.name || selectedFromUser.username || customFromLocation;
          console.log('[CombinedMapScreen] Using selected from user coordinates:', from);
        } else {
          // Geocode as regular location
          from = await geocodeLocation(customFromLocation);
          console.log('[CombinedMapScreen] Geocoded from location:', from);
        }
      }

      // Handle TO location
      if (selectedToUser && selectedToUser.latitude && selectedToUser.longitude) {
        to = {
          latitude: selectedToUser.latitude,
          longitude: selectedToUser.longitude
        };
        displayToLocation = selectedToUser.displayName || selectedToUser.name || selectedToUser.username || toLocation;
        console.log('[CombinedMapScreen] Using selected to user coordinates:', to);
      } else {
        // Geocode the to location
        to = await geocodeLocation(toLocation);
        console.log('[CombinedMapScreen] Geocoded to location:', to);
      }

      if (!from || !to) {
        Alert.alert('Error', 'Could not find one or both locations. Please check the addresses or usernames.');
        setLoading(false);
        return;
      }

      // Get actual route from routing service
      const route = await getRoute(from, to);

      if (route && route.length > 0) {
        setRouteCoords(route);
        // Update the display from location based on type
        setFromLocation(displayFromLocation);

        Alert.alert('Route Calculated', `Route from: ${displayFromLocation}\nTo: ${displayToLocation}\n\nRoute displayed on map!`, [
          { text: 'OK', onPress: () => setShowRouteModal(false) },
          { text: 'Clear Route', onPress: () => { clearRoute(); setShowRouteModal(false); } }
        ]);
      } else {
        Alert.alert('Error', 'Could not calculate route. Please try different locations.');
      }

    } catch (error) {
      console.error('[CombinedMapScreen] Route calculation error:', error);
      Alert.alert('Error', 'Failed to calculate route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Search location in local Indian cities database
  const searchLocationInFile = (locationName) => {
    const searchKey = locationName.toLowerCase().trim();

    // Direct match first
    if (indianCitiesData[searchKey]) {
      return {
        latitude: indianCitiesData[searchKey].latitude,
        longitude: indianCitiesData[searchKey].longitude
      };
    }

    // Partial match - search through all cities
    for (const [cityKey, cityData] of Object.entries(indianCitiesData)) {
      if (cityKey.includes(searchKey) || searchKey.includes(cityKey)) {
        return {
          latitude: cityData.latitude,
          longitude: cityData.longitude
        };
      }
    }

    return null;
  };

  // Geocode location name to coordinates
  const geocodeLocation = async (locationName) => {
    try {
      if (locationName === 'Your Location' && userLocation) {
        return userLocation;
      }

      // Service 1: Try local Indian cities database first
      let coordinates = searchLocationInFile(locationName);
      if (coordinates) {
        console.log('[CombinedMapScreen] Using local Indian cities database for:', locationName, coordinates);
        return coordinates;
      }

      // Service 2: Nominatim with user agent
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`, {
          headers: {
            'User-Agent': 'ATMS-Mobile-App/1.0'
          }
        });
        const text = await response.text();

        if (response.ok && text.startsWith('[')) {
          const data = JSON.parse(text);
          if (data && data.length > 0) {
            coordinates = {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon)
            };
            console.log('[CombinedMapScreen] Nominatim success:', coordinates);
            return coordinates;
          }
        }
      } catch (error) {
        console.log('[CombinedMapScreen] Nominatim failed:', error.message);
      }

      // Service 3: OpenCage (if Nominatim fails) - using demo key
      try {
        const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(locationName)}&key=demo&limit=1`);
        const data = await response.json();

        if (data && data.results && data.results.length > 0) {
          coordinates = {
            latitude: data.results[0].geometry.lat,
            longitude: data.results[0].geometry.lng
          };
          console.log('[CombinedMapScreen] OpenCage success:', coordinates);
          return coordinates;
        }
      } catch (error) {
        console.log('[CombinedMapScreen] OpenCage failed:', error.message);
      }

      return null;
    } catch (error) {
      console.error('[CombinedMapScreen] Geocoding error:', error);
      return null;
    }
  };

  // Get actual route from routing service
  const getRoute = async (from, to) => {
    try {
      // Using OSRM (Open Source Routing Machine) - free and no API key required
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));

        console.log('[CombinedMapScreen] Route fetched with', coordinates.length, 'points');
        return coordinates;
      }
      return null;
    } catch (error) {
      console.error('[CombinedMapScreen] Routing error:', error);
      // Fallback to straight line if routing fails
      return [
        from,
        { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2 },
        to
      ];
    }
  };

  const clearRoute = () => {
    setRouteCoords(null);
    setFromLocationType('current');
    setFromLocation(userLocation ? 'Your Location' : '');
    setCustomFromLocation('');
    setToLocation('');
    setSelectedFromUser(null);
    setSelectedToUser(null);
    setShowFromDropdown(false);
    setShowToDropdown(false);
    setActiveDropdown(null);
  };

  // Render suggestion item for dropdown
  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => {
        if (activeDropdown === 'from') {
          selectFromSuggestion(item);
        } else if (activeDropdown === 'to') {
          selectToSuggestion(item);
        }
      }}
    >
      <Icon
        name={
          item.type === 'city' ? 'business' :
            item.role === 'commander' ? 'star' : 'shield'
        }
        size={20}
        color={green.primary}
      />
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionText}>{item.displayName || item.username}</Text>
        {item.type === 'city' && (
          <Text style={styles.suggestionSubtext}>City</Text>
        )}
        {item.role && (
          <Text style={styles.suggestionSubtext}>{item.role}</Text>
        )}
        {item.latitude && item.longitude ? (
          <Text style={styles.locationAvailable}>📍 Location available</Text>
        ) : (
          <Text style={styles.locationUnavailable}>📍 No location</Text>
        )}
      </View>
      {item.latitude && item.longitude ? (
        <Icon name="checkmark-circle" size={16} color="#4CAF50" />
      ) : (
        <Icon name="alert-circle" size={16} color="#f39c12" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'track' && styles.toggleActive]}
          onPress={() => setMode('track')}
        >
          <Icon name={mode === 'track' ? 'map' : 'map-outline'} size={18} color={mode === 'track' ? '#fff' : green.primary} />
          <Text style={[styles.toggleText, mode === 'track' && styles.toggleTextActive]}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'search' && styles.toggleActive]}
          onPress={() => setMode('search')}
        >
          <Icon name={mode === 'search' ? 'search' : 'search-outline'} size={18} color={mode === 'search' ? '#fff' : green.primary} />
          <Text style={[styles.toggleText, mode === 'search' && styles.toggleTextActive]}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'routes' && styles.toggleActive]}
          onPress={() => {
            setMode('routes');
            handleRoutes();
          }}
        >
          <Icon name={mode === 'routes' ? 'navigate' : 'navigate-outline'} size={18} color={mode === 'routes' ? '#fff' : green.primary} />
          <Text style={[styles.toggleText, mode === 'routes' && styles.toggleTextActive]}>Route</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {mode === 'track' ? (
          <HomeScreen {...props} fromLocation={fromLocation} gpsMode={fromLocationType === 'gps'} />
        ) : mode === 'search' ? (
          <GeospatialScreen {...props} />
        ) : (
          <View style={styles.routeMapContainer}>
            <HomeScreen {...props} routeCoords={routeCoords} fromLocation={fromLocation} gpsMode={fromLocationType === 'gps'} />
          </View>
        )}
      </View>

      {/* Route Modal */}
      <Modal
        visible={showRouteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRouteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowFromDropdown(false);
            setShowToDropdown(false);
            setActiveDropdown(null);
          }}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan Route</Text>
              <TouchableOpacity onPress={() => setShowRouteModal(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>From Location</Text>

              {/* Location Type Picker - Your Location, Enter Location in row, Mobile GPS below */}
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={[styles.pickerOption, fromLocationType === 'current' && styles.pickerOptionActive]}
                  onPress={() => {
                    setFromLocationType('current');
                    setShowFromDropdown(false);
                    setActiveDropdown(null);
                    setSelectedFromUser(null);
                    setCustomFromLocation('');
                    if (!userLocation) {
                      fetchUserLocation();
                    }
                  }}
                >
                  <Icon
                    name="locate"
                    size={18}
                    color={fromLocationType === 'current' ? '#fff' : green.primary}
                  />
                  <Text style={[styles.pickerOptionText, fromLocationType === 'current' && styles.pickerOptionTextActive]}>
                    Your Location
                  </Text>
                  {fromLocationType === 'current' && (
                    <Icon name="checkmark-circle" size={18} color="#fff" style={styles.checkIcon} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickerOption, fromLocationType === 'custom' && styles.pickerOptionActive]}
                  onPress={() => {
                    setFromLocationType('custom');
                    setActiveDropdown(null);
                  }}
                >
                  <Icon
                    name="create"
                    size={18}
                    color={fromLocationType === 'custom' ? '#fff' : green.primary}
                  />
                  <Text style={[styles.pickerOptionText, fromLocationType === 'custom' && styles.pickerOptionTextActive]}>
                    Enter Location
                  </Text>
                  {fromLocationType === 'custom' && (
                    <Icon name="checkmark-circle" size={18} color="#fff" style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Mobile GPS Button - Separate row below */}
              <TouchableOpacity
                style={[styles.gpsButton, fromLocationType === 'gps' && styles.pickerOptionActive]}
                onPress={async () => {
                  const success = await fetchGpsLocation();
                  if (success) {
                    setShowFromDropdown(false);
                    setActiveDropdown(null);
                    setSelectedFromUser(null);
                    setCustomFromLocation('');
                  }
                }}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={fromLocationType === 'gps' ? '#fff' : green.primary} />
                ) : (
                  <Icon
                    name="phone-portrait"
                    size={18}
                    color={fromLocationType === 'gps' ? '#fff' : green.primary}
                  />
                )}
                <Text style={[styles.pickerOptionText, fromLocationType === 'gps' && styles.pickerOptionTextActive]}>
                  Mobile GPS
                </Text>
                {fromLocationType === 'gps' && (
                  <Icon name="checkmark-circle" size={18} color="#fff" style={styles.checkIcon} />
                )}
              </TouchableOpacity>

              {/* Custom Location Input with Autocomplete (only shown when custom is selected) */}
              {fromLocationType === 'custom' && (
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter username or city name"
                    value={customFromLocation}
                    onChangeText={handleFromLocationChange}
                    onFocus={() => {
                      if (customFromLocation.length >= 2) {
                        setActiveDropdown('from');
                        setShowFromDropdown(true);
                        setShowToDropdown(false);
                      }
                    }}
                    autoFocus={true}
                  />

                  {/* Dropdown Arrow */}
                  {fromSuggestions.length > 0 && (
                    <TouchableOpacity
                      style={styles.dropdownArrow}
                      onPress={() => {
                        setShowFromDropdown(!showFromDropdown);
                        setShowToDropdown(false);
                        setActiveDropdown(showFromDropdown ? null : 'from');
                      }}
                    >
                      <Icon
                        name={showFromDropdown ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#666"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Show selected user info */}
              {selectedFromUser && selectedFromUser.name && (
                <View style={styles.selectedUserInfo}>
                  <Icon name="person" size={16} color={green.primary} />
                  <Text style={styles.selectedUserText}>
                    Selected: {selectedFromUser.name} ({selectedFromUser.role})
                    {selectedFromUser.latitude && selectedFromUser.longitude ? ' ✓' : ' ⚠ No location'}
                  </Text>
                </View>
              )}

              {/* Show current location status */}
              {fromLocationType === 'current' && (
                <View style={styles.locationStatus}>
                  <Icon name="information-circle" size={16} color={green.primary} />
                  <Text style={styles.locationStatusText}>
                    {userLocation
                      ? '✓ Using your current location'
                      : '⚠ Location not available'}
                  </Text>
                </View>
              )}

              {/* Show GPS location status */}
              {fromLocationType === 'gps' && (
                <View style={styles.locationStatus}>
                  <Icon name="information-circle" size={16} color={green.primary} />
                  <Text style={styles.locationStatusText}>
                    {gpsLocation
                      ? `✓ Using Mobile GPS (accuracy: ${Math.round(gpsLocation.accuracy)}m)`
                      : '📍 Mobile GPS ready'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>To Location</Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter username or city name"
                  value={toLocation}
                  onChangeText={handleToLocationChange}
                  onFocus={() => {
                    if (toLocation.length >= 2) {
                      setActiveDropdown('to');
                      setShowToDropdown(true);
                      setShowFromDropdown(false);
                    }
                  }}
                />

                {/* Dropdown Arrow */}
                {toSuggestions.length > 0 && (
                  <TouchableOpacity
                    style={styles.dropdownArrow}
                    onPress={() => {
                      setShowToDropdown(!showToDropdown);
                      setShowFromDropdown(false);
                      setActiveDropdown(showToDropdown ? null : 'to');
                    }}
                  >
                    <Icon
                      name={showToDropdown ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Show selected user info */}
              {selectedToUser && selectedToUser.name && (
                <View style={styles.selectedUserInfo}>
                  <Icon name="person" size={16} color={green.primary} />
                  <Text style={styles.selectedUserText}>
                    Selected: {selectedToUser.name} ({selectedToUser.role})
                    {selectedToUser.latitude && selectedToUser.longitude ? ' ✓' : ' ⚠ No location'}
                  </Text>
                </View>
              )}
            </View>

            {/* From Suggestions Dropdown - Rendered at top level */}
            {showFromDropdown && fromSuggestions.length > 0 && (
              <View style={[styles.dropdownContainer, styles.fromDropdown]}>
                <FlatList
                  data={fromSuggestions}
                  keyExtractor={(item) => item.id || item.username}
                  renderItem={renderSuggestion}
                  keyboardShouldPersistTaps="always"
                  style={styles.dropdownList}
                />
              </View>
            )}

            {/* To Suggestions Dropdown - Rendered at top level */}
            {showToDropdown && toSuggestions.length > 0 && (
              <View style={[styles.dropdownContainer, styles.toDropdown]}>
                <FlatList
                  data={toSuggestions}
                  keyExtractor={(item) => item.id || item.username}
                  renderItem={renderSuggestion}
                  keyboardShouldPersistTaps="always"
                  style={styles.dropdownList}
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.calculateButton,
                ((fromLocationType === 'current' && !userLocation) ||
                  (fromLocationType === 'gps' && !gpsLocation) ||
                  (fromLocationType === 'custom' && !customFromLocation.trim() && !selectedFromUser) ||
                  (!toLocation.trim() && !selectedToUser)) && styles.calculateButtonDisabled
              ]}
              onPress={handleCalculateRoute}
              disabled={(fromLocationType === 'current' && !userLocation) ||
                (fromLocationType === 'gps' && !gpsLocation) ||
                (fromLocationType === 'custom' && !customFromLocation.trim() && !selectedFromUser) ||
                (!toLocation.trim() && !selectedToUser)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="navigate" size={20} color="#fff" />
                  <Text style={styles.calculateButtonText}>Calculate Route</Text>
                </>
              )}
            </TouchableOpacity>

            {routeCoords && (
              <TouchableOpacity style={styles.clearButton} onPress={clearRoute}>
                <Icon name="close-circle" size={20} color="#fff" />
                <Text style={styles.clearButtonText}>Clear Route</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: green.background,
  },
  toggleBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: green.primary,
    marginRight: 8,
  },
  toggleActive: {
    backgroundColor: green.primary,
    borderColor: green.primary,
  },
  toggleText: {
    marginLeft: 6,
    color: green.primary,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  routeMapContainer: {
    flex: 1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    position: 'relative',
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
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  pickerOption: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: green.primary,
    backgroundColor: '#fff',
    position: 'relative',
  },
  pickerOptionActive: {
    backgroundColor: green.primary,
    borderColor: green.primary,
  },
  pickerOptionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
    color: green.primary,
  },
  pickerOptionTextActive: {
    color: '#fff',
  },
  checkIcon: {
    marginLeft: 4,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: green.primary,
    backgroundColor: '#fff',
    position: 'relative',
    width: '100%',
    marginTop: 8,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    paddingRight: 40, // Space for dropdown arrow
  },
  dropdownArrow: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 200,
    width: '90%',
    alignSelf: 'center',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fromDropdown: {
    top: 240, // Adjusted for three buttons
  },
  toDropdown: {
    top: 360,
  },
  dropdownList: {
    padding: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  locationAvailable: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 2,
  },
  locationUnavailable: {
    fontSize: 10,
    color: '#f39c12',
    marginTop: 2,
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 4,
  },
  selectedUserText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 6,
    flex: 1,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  locationStatusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: green.primary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  calculateButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});


