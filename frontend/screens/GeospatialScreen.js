import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, Image, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import MenuIcon from './MenuIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import i18n from '../utils/i18n';

export default function GeospatialScreen({ navigation, route }) {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [userZones, setUserZones] = useState([]);
  const [zones, setZones] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldier, setSelectedSoldier] = useState(null);

  // Load user data from AsyncStorage
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return; // guard double-invoke in dev
    didInitRef.current = true;
    const loadInitialData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (!userData) return;

          const user = JSON.parse(userData);
          setCurrentUser(user);
        // Fetch all zones for geospatial logic (both commander and soldier)
        let computedZones = [];
          try {
            const fetchedZones = await apiService.getZones();
          const formattedZones = fetchedZones.map((zone) => ({
              ...zone,
              name: zone.unit_name || zone.name || `Zone ${zone.id}`,
              coordinates: Array.isArray(zone.coordinates)
                ? zone.coordinates
                    .map(pt =>
                      Array.isArray(pt) && pt.length === 2
                        ? { latitude: Number(pt[0]), longitude: Number(pt[1]) }
                        : pt
                    )
                    .filter(
                      pt =>
                        pt &&
                      typeof pt.latitude === 'number' && !isNaN(pt.latitude) &&
                      typeof pt.longitude === 'number' && !isNaN(pt.longitude)
                    )
                : [],
              color: zone.color || `#${Math.floor(Math.random()*16777215).toString(16)}`
            }));

            const uniqueZones = Array.from(new Map(formattedZones.map(z => [z.id, z])).values());
          computedZones = uniqueZones;
            setZones(uniqueZones);

          // Determine user's current zone based on device location
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const loc = await Location.getCurrentPositionAsync({});
              const myLat = loc?.coords?.latitude;
              const myLng = loc?.coords?.longitude;
              if (typeof myLat === 'number' && typeof myLng === 'number') {
                const inside = uniqueZones.filter(z => Array.isArray(z.coordinates) && z.coordinates.length > 0 && pointInPolygon({ latitude: myLat, longitude: myLng }, z.coordinates));
                const myZoneNames = inside.map(z => z.name);
                if (myZoneNames.length > 0) {
                  setUserZones(myZoneNames);
                  setSelectedZone(myZoneNames[0]);
                  const selected = inside[0];
                  if (selected?.center) {
              setRegion({
                      latitude: safeNumber(selected.center.latitude, fallbackRegion.latitude),
                      longitude: safeNumber(selected.center.longitude, fallbackRegion.longitude),
                  latitudeDelta: 0.1,
                  longitudeDelta: 0.1,
              });
                  }
                }
              }
            }
          } catch (e) {
            // Non-fatal if location not available
            }
          } catch (zoneError) {
            console.error("Failed to fetch zones:", zoneError);
            Alert.alert("Error", "Could not load operational zones.");
        }

        // Fetch personnel based on role and compute zone membership
        if (user.unit) {
          try {
            const unitSoldiers = await apiService.getSoldiersByUnit(user.unit);
            if (user.role === 'commander') {
              const enriched = (unitSoldiers || []).map(p => ({ ...p, zoneName: inferZoneName(p, computedZones) }));
              setSoldiers(enriched);
            } else {
              // Soldier: include commanders and soldiers in same unit
              const commanders = await apiService.getUsersByRoleAndUnit('commander', user.unit);
              const combined = [...(unitSoldiers || []), ...(commanders || [])].map(p => ({ ...p, zoneName: inferZoneName(p, computedZones) }));
              setSoldiers(combined);
            }
          } catch (e) {
            console.error('Error fetching personnel:', e);
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        Alert.alert('Error', 'Failed to load data.');
      }
    };
    loadInitialData();
  }, []);

  // Center map if a soldier is passed via navigation params
  useEffect(() => {
    const passed = route?.params?.selectedSoldier;
    if (passed && typeof passed.latitude === 'number' && typeof passed.longitude === 'number' && !isNaN(passed.latitude) && !isNaN(passed.longitude)) {
      setSelectedSoldier(passed);
      setRegion({
        latitude: passed.latitude,
        longitude: passed.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [route?.params?.selectedSoldier]);

  // Removed continuous polling; data refresh is manual via search or zone change

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
    });
  }, [navigation, dropdownVisible]);

  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      setShowSearchResults(false);
      return;
    }
    try {
      const userDataStr = await AsyncStorage.getItem('currentUser');
      let unit = null;
      if (userDataStr) {
        const user = JSON.parse(userDataStr);
        unit = user?.unit || null;
      }
      let combined = [];
      if (unit) {
        const soldiersInUnit = await apiService.getUsersByRoleAndUnit('soldier', unit);
        const commandersInUnit = await apiService.getUsersByRoleAndUnit('commander', unit);
        combined = [...(soldiersInUnit || []), ...(commandersInUnit || [])]
          .map(p => ({ ...p, zoneName: inferZoneName(p, zones) }));
      } else {
        // Fallback: fetch all soldiers if unit not found
        combined = (await apiService.getAllSoldiers()).map(p => ({ ...p, zoneName: inferZoneName(p, zones) }));
      }
      setSoldiers(combined || []);
      setShowSearchResults(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch search results from database.');
    }
  };

  // Filter soldiers based on search query and user's zone access
  const getFilteredResults = () => {
    const query = searchQuery.toLowerCase();
    
    // Filter soldiers based on user's zone access and search query
    const filteredSoldiers = soldiers
      .filter(soldier => {
        // If zones list is populated, filter by that; otherwise skip zone filter
        const inZone = userZones && userZones.length > 0 ? userZones.includes(soldier.zoneName || soldier.zone) : true;
        return inZone;
      })
      .filter(soldier => {
        const name = (soldier.name || soldier.username || '').toLowerCase();
        const idStr = String(soldier.id || soldier.username || '').toLowerCase();
        const rank = String(soldier.rank || '').toLowerCase();
        const zone = String(soldier.zoneName || soldier.zone || soldier.unit || '').toLowerCase();
        return (
          name.includes(query) ||
          idStr.includes(query) ||
          rank.includes(query) ||
          zone.includes(query)
        );
      });
    
    return filteredSoldiers.map(soldier => ({...soldier, category: 'personnel'}));
  };

  const handleSelectLocation = (item) => {
    setSelectedLocation(item);
    setRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setShowSearchResults(false);
  };

  const openExternalNavigation = async (lat, lng, label) => {
    try {
      const encodedLabel = encodeURIComponent(label || 'Destination');
      let url = '';
      if (Platform.OS === 'ios') {
        url = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${encodedLabel}`;
      } else {
        // Prefer Google Maps if available
        url = `google.navigation:q=${lat},${lng}`;
        const canOpenGoogle = await Linking.canOpenURL(url);
        if (!canOpenGoogle) {
          url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`; 
        }
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Could not open navigation.');
    }
  };

  const handleZoneChange = (zoneName) => {
    setSelectedZone(zoneName);
    const selected = zones.find(z => z.name === zoneName);
    if (selected) {
    setRegion({
            latitude: safeNumber(selected.center.latitude, fallbackRegion.latitude),
            longitude: safeNumber(selected.center.longitude, fallbackRegion.longitude),
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    });
    }
  };

  const getMarkerColor = (type) => {
    switch (type) {
      case 'personnel':
        return '#009688';
      default:
        return '#757575';
    }
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => handleSelectLocation(item)}
    >
      <Icon 
        name={(String(item.role || '').toLowerCase() === 'commander') ? 'shield' : 'person'}
        size={24}
        color={getMarkerColor(item.type)}
      />
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultTitle}>{item.name || item.username}</Text>
        <Text style={styles.searchResultSubtitle}>
          {`${item.rank || ''} | ID: ${item.id || item.username} | Zone: ${item.zone || item.unit || ''}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Use default map pin markers for clarity instead of body icon

  // Custom Callout component
  const renderCustomCallout = (soldier) => (
    <View style={{ minWidth: 200, padding: 10, backgroundColor: '#fff', borderRadius: 8, borderColor: '#333', borderWidth: 1 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 17, color: '#111' }}>
        {soldier.name || i18n.t('soldier')}
      </Text>
      <Text style={{ fontSize: 14, marginTop: 6, color: '#333' }}>User Login ID: {soldier.id}</Text>
      <Text style={{ fontSize: 14, color: '#333' }}>Username: {soldier.username}</Text>
    </View>
  );

  // Get personnel filtered by the selected zone
  const getZonePersonnel = () => {
    if (!selectedZone) return soldiers;
    return soldiers.filter(p => (p.zoneName || p.zone) === selectedZone);
  };

  const isValidRegion = region =>
    region &&
    typeof region.latitude === 'number' &&
    !isNaN(region.latitude) &&
    typeof region.longitude === 'number' &&
    !isNaN(region.longitude) &&
    typeof region.latitudeDelta === 'number' &&
    !isNaN(region.latitudeDelta) &&
    typeof region.longitudeDelta === 'number' &&
    !isNaN(region.longitudeDelta);

  const fallbackRegion = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  };

  const safeNumber = (v, fallback) => (typeof v === 'number' && !isNaN(v) ? v : fallback);

  return (
      <View style={styles.container}>
      {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={i18n.t('search_placeholder')}
            placeholderTextColor="#757575"
            value={searchQuery}
            onChangeText={text => {
              setSearchQuery(text);
              if (text.length > 2) {
                handleSearch();
              } else if (text.length === 0) {
                setShowSearchResults(false);
              }
            }}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Icon name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Zone Selector - Only visible for commander */}
        {currentUser && currentUser.role === 'commander' && zones.length > 0 && (
          <View style={styles.zoneSelector}>
          <Text style={styles.zoneSelectorTitle}>{i18n.t('select_zone')}:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneButton,
                    selectedZone === zone.name && { backgroundColor: zone.color || '#009688' }
                ]}
                  onPress={() => handleZoneChange(zone.name)}
              >
                <Text 
                  style={[
                    styles.zoneButtonText,
                      selectedZone === zone.name && { color: '#fff' }
                  ]}
                >
                    {zone.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
      {/* Search Results */}
      {showSearchResults && (
        <FlatList
          data={getFilteredResults()}
          keyExtractor={item => item.id}
          renderItem={renderSearchResult}
          style={styles.searchResultsList}
        />
      )}
      
      {/* Map View */}
      <View style={{ flex: 1 }}>
        <MapView
          style={styles.map}
        provider={PROVIDER_GOOGLE}
          region={isValidRegion(region) ? region : fallbackRegion}
        onPress={() => setSelectedLocation(null)}
          showsMyLocationButton={false}
        >
          {/* Render Zone Polygons if any */}
          {currentUser && currentUser.role === 'commander' && zones.map(zone => (
            Array.isArray(zone.coordinates) && zone.coordinates.length > 0 ? (
            <Polygon
                key={zone.id}
                  coordinates={zone.coordinates}
                fillColor={`${zone.color}40`}
                strokeColor={zone.color}
              strokeWidth={2}
            />
            ) : null
          ))}
          {/* Show soldiers (filtered by selected zone) as markers for commander */}
          {currentUser && currentUser.role === 'commander' && getZonePersonnel().filter(soldier =>
  typeof soldier.latitude === 'number' && typeof soldier.longitude === 'number' &&
  !isNaN(soldier.latitude) && !isNaN(soldier.longitude)
).map(soldier => (
  <Marker
    key={soldier.id || soldier.username}
    coordinate={{ latitude: soldier.latitude, longitude: soldier.longitude }}
    pinColor={'red'}
    title={`${soldier.name || soldier.username || i18n.t('soldier')}`}
    description={`User Login ID: ${soldier.id}${soldier.username ? ` • Username: ${soldier.username}` : ''}`}
    onPress={() => setSelectedSoldier(soldier)}
  />
))}

          {/* Soldiers can see commanders and soldiers in their current zone */}
          {currentUser && currentUser.role === 'soldier' && getZonePersonnel().filter(person =>
            typeof person.latitude === 'number' && typeof person.longitude === 'number' &&
            !isNaN(person.latitude) && !isNaN(person.longitude)
          ).map(person => (
            <Marker
              key={person.id || person.username}
              coordinate={{ latitude: person.latitude, longitude: person.longitude }}
              pinColor={(String(person.role || '').toLowerCase() === 'commander') ? '#2E3192' : '#009688'}
              title={`${person.name || person.username || (String(person.role || '').toLowerCase() === 'commander' ? i18n.t('commander') : i18n.t('soldier'))}`}
              description={`User Login ID: ${person.id}${person.username ? ` • Username: ${person.username}` : ''}`}
              onPress={() => setSelectedSoldier(person)}
  />
))}

          {/* Always show marker for the selected search result (for soldiers and commanders) */}
          {selectedLocation && typeof selectedLocation.latitude === 'number' && typeof selectedLocation.longitude === 'number' &&
            !isNaN(selectedLocation.latitude) && !isNaN(selectedLocation.longitude) && (
              <Marker
                key={`selected-${selectedLocation.id || selectedLocation.username || 'target'}`}
                coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }}
                pinColor={'red'}
                title={`${selectedLocation.name || selectedLocation.username || i18n.t('soldier')}`}
                description={`${i18n.t('id')}: ${selectedLocation.id || selectedLocation.username}${selectedLocation.unit ? ` • ${i18n.t('unit')}: ${selectedLocation.unit}` : ''}`}
              />
          )}
        </MapView>
      </View>
      
      {/* Selected Location Info */}
      {selectedLocation && (
        <View style={styles.locationInfoContainer}>
          <View style={styles.locationInfoHeader}>
            <Text style={styles.locationInfoTitle}>{selectedLocation.name}</Text>
            <TouchableOpacity onPress={() => setSelectedLocation(null)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.locationInfoDetails}>
            <Text style={styles.locationInfoDetail}>
              <Text style={styles.detailLabel}>{i18n.t('id')}: </Text>
              {selectedLocation.id}
            </Text>
            <Text style={styles.locationInfoDetail}>
              <Text style={styles.detailLabel}>{i18n.t('rank')}: </Text>
              {selectedLocation.rank}
            </Text>
            <Text style={styles.locationInfoDetail}>
              <Text style={styles.detailLabel}>{i18n.t('zone')}: </Text>
              {selectedLocation.zone} ({zones[selectedLocation.zone]?.city || ''})
            </Text>
            <Text style={styles.locationInfoDetail}>
              <Text style={styles.detailLabel}>{i18n.t('coordinates')}: </Text>
              {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
            </Text>
          </View>
          
          <View style={styles.locationInfoActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => openExternalNavigation(selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name || selectedLocation.username)}
            >
              <Icon name="eye" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>{i18n.t('track')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => {
                // Navigate to messaging screen or open communication channel
                Alert.alert('Contact', `${i18n.t('contacting')} ${selectedLocation.name}...`);
              }}
            >
              <Icon name="chatbubble" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>{i18n.t('contact')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        )}
      </View>
  );
}

// ————————————————————————————————————————————————
// Geometry helpers
// ————————————————————————————————————————————————
function pointInPolygon(point, polygon) {
  // Ray-casting algorithm
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Remove white background
    // paddingBottom: 60, // Remove or adjust if not needed
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  searchButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2E3192',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
  },
  zoneSelector: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  zoneSelectorTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  zoneButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
  },
  zoneButtonText: {
    fontWeight: 'bold',
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
    maxHeight: 300,
    elevation: 5,
    zIndex: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultContent: {
    marginLeft: 10,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: '#757575',
  },
  noResultsText: {
    padding: 15,
    textAlign: 'center',
    color: '#757575',
  },
  map: {
    flex: 1,
  },
  locationInfoContainer: {
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
  locationInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationInfoDetails: {
    marginBottom: 15,
  },
  locationInfoDetail: {
    fontSize: 14,
    marginBottom: 5,
  },
  detailLabel: {
    fontWeight: 'bold',
  },
  locationInfoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E3192',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  searchResultsList: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
    maxHeight: 300,
    elevation: 5,
    zIndex: 10,
  },
}); 