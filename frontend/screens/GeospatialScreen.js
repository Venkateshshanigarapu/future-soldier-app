import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, Image, Linking, Platform } from 'react-native';
import LeafletMap from '../components/LeafletMap';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, socket } from '../services/api';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function GeospatialScreen({ navigation, route }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState({
    latitude: 17.4822,
    longitude: 78.4790,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [userZones, setUserZones] = useState([]);
  const [zones, setZones] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const mapRef = useRef(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
  const [mapType, setMapType] = useState('standard');
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const layers = [
    { id: 'standard', name: 'Normal Map', icon: 'map-outline' },
    { id: 'satellite', name: 'Satellite', icon: 'earth-outline' },
    { id: 'geoStreet', name: 'Street View', icon: 'navigate-outline' },
    { id: 'geoTerrain', name: 'Terrain View', icon: 'mountain-outline' },
    // { id: 'geoTraffic', name: 'Geo Traffic', icon: 'bus-outline' },
  ];

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

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
        // Fetch zones - filter by user's unit (for all users)
        let computedZones = [];
        try {
          // For all users, pass unit parameter to backend for server-side filtering
          const fetchedZones = user.unit
            ? await apiService.getZones(user.unit, user.id)
            : await apiService.getZones(null, user.id);
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
            color: zone.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`
          }));

          // Additional client-side filtering for all users (double-check, backend should already filter)
          let filteredZones = formattedZones;
          if (user.unit) {
            // STRICT matching: Only match zones where unit_name exactly matches user's unit (case-insensitive)
            const userUnit = (user.unit || '').toString().trim().toLowerCase();

            console.log(`[Geospatial] Client-side filtering zones for user unit: "${user.unit}" (normalized: "${userUnit}")`);
            console.log(`[Geospatial] Zones received from backend:`, formattedZones.length);

            // Filter again on client side as a safety check
            filteredZones = formattedZones.filter(zone => {
              const zoneUnit = (zone.unit_name || zone.unit || '').toString().trim().toLowerCase();
              const matches = zoneUnit === userUnit;

              if (!matches) {
                console.warn(`[Geospatial] ⚠️ Zone "${zone.name}" (unit: "${zone.unit_name || zone.unit}") from backend does NOT match user unit "${user.unit}" - filtering out`);
              }

              return matches;
            });

            // For soldiers: Only show the first/primary assigned zone (not all zones from unit)
            if (user.role === 'soldier' && filteredZones.length > 0) {
              // Take only the first zone as the soldier's assigned zone
              filteredZones = [filteredZones[0]];
              console.log(`[Geospatial] Soldier - showing only assigned zone: "${filteredZones[0]?.name}"`);
            }

            console.log(`[Geospatial] ✅ Final filtered zones for user unit "${user.unit}":`, filteredZones.length);
            filteredZones.forEach(z => {
              const centerLat = z.center?.latitude;
              const centerLng = z.center?.longitude;
              const centerStr = (centerLat != null && centerLng != null)
                ? `${Number(centerLat).toFixed(4)}, ${Number(centerLng).toFixed(4)}`
                : 'N/A';
              const location = (centerLat != null)
                ? (centerLat > 30 ? 'Likely India/Hyderabad' : centerLat < 20 ? 'Likely China/Other' : 'Unknown')
                : 'N/A';

              console.log(`[Geospatial] Zone "${z.name}":`, {
                id: z.id,
                unit: z.unit_name || z.unit,
                hasCoordinates: Array.isArray(z.coordinates) && z.coordinates.length > 0,
                coordCount: z.coordinates?.length || 0,
                hasCenter: !!z.center,
                center: centerStr,
                location: location
              });
            });
          }

          const uniqueZones = Array.from(new Map(filteredZones.map(z => [z.id, z])).values());
          computedZones = uniqueZones;
          setZones(uniqueZones);
          console.log(`[Geospatial] Total zones loaded:`, uniqueZones.length);

          // DISABLED: Device GPS zone detection - using assigned zone only
          /*
          // Determine user's current zone based on device location
          try {
            if (status === 'granted') {

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
                    setRegionSafely({
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
          */
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
    if (passed && typeof passed.latitude === 'number' && typeof passed.longitude === 'number' && isFinite(passed.latitude) && isFinite(passed.longitude)) {
      setSelectedSoldier(passed);
      setRegionSafely({
        latitude: passed.latitude,
        longitude: passed.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [route?.params?.selectedSoldier]);

  // Socket listener for live location updates
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (data) => {
      if (data && data.userId) {
        setSoldiers(prev => {
          const index = prev.findIndex(u => u.id === data.userId || u.username === data.userId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading,
              zoneName: inferZoneName({ latitude: data.latitude, longitude: data.longitude }, zones)
            };
            return updated;
          }
          return prev;
        });
      }
    };

    socket.on('locationUpdate', handleLocationUpdate);
    console.log('[Geospatial] Socket locationUpdate listener attached');

    return () => {
      socket.off('locationUpdate', handleLocationUpdate);
    };
  }, [socket, zones]);

  // Use global header menu from TabNavigator; do not override here

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
        // If no unit found, don't show any soldiers (only show user's unit soldiers)
        combined = [];
      }
      // Apply query filter; if no match, show error and do not display everyone on map
      const q = searchQuery.trim().toLowerCase();
      const filtered = (combined || []).filter(p => {
        const name = String(p.name || p.username || '').toLowerCase();
        const idStr = String(p.id || p.username || '').toLowerCase();
        const rank = String(p.rank || '').toLowerCase();
        const unitStr = String(p.unit || '').toLowerCase();
        return (
          name.includes(q) ||
          idStr.includes(q) ||
          rank.includes(q) ||
          unitStr.includes(q)
        );
      });

      if (!filtered || filtered.length === 0) {
        Alert.alert('No Results', 'User does not exist. Please refine your search.');
        // Do not alter existing markers; just show empty list
        setShowSearchResults(true);
        return;
      }

      // Narrow map markers to the filtered set and show list
      setSoldiers(filtered);
      setShowSearchResults(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch search results from database.');
    }
  };

  // Filter soldiers and zones based on search query and user's zone access
  const getFilteredResults = () => {
    const query = searchQuery.toLowerCase();

    // Filter soldiers based on user's unit, zone access, and search query
    const userUnit = currentUser?.unit ? String(currentUser.unit).trim().toLowerCase() : null;

    const filteredSoldiers = soldiers
      .filter(soldier => {
        // First filter: Only show soldiers from user's unit
        if (userUnit) {
          const soldierUnit = String(soldier.unit || '').trim().toLowerCase();
          if (soldierUnit !== userUnit) {
            return false;
          }
        }
        return true;
      })
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
      })
      .map(soldier => ({ ...soldier, category: 'personnel' }));

    // Filter zones based on search query - only show user's zones
    const filteredZones = zones
      .filter(zone => {
        // Zones are already filtered to user's unit when loaded, but double-check here
        const userUnit = currentUser?.unit ? String(currentUser.unit).trim().toLowerCase() : null;
        const zoneUnit = String(zone.unit_name || zone.unit || '').trim().toLowerCase();

        // Only include zones matching user's unit
        if (userUnit && zoneUnit !== userUnit) {
          return false;
        }

        // Then filter by search query
        const name = (zone.name || '').toLowerCase();
        const type = String(zone.zone_type || zone.type || '').toLowerCase();
        return (
          name.includes(query) ||
          zoneUnit.includes(query) ||
          type.includes(query)
        );
      })
      .map(zone => ({ ...zone, category: 'zone' }));

    return [...filteredSoldiers, ...filteredZones];
  };

  const handleSelectLocation = (item) => {
    setSelectedLocation(item);
    if (item && typeof item.latitude === 'number' && typeof item.longitude === 'number' && isFinite(item.latitude) && isFinite(item.longitude)) {
      setRegionSafely({
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
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

  // Calculate center from polygon coordinates if center is missing
  const calculateZoneCenter = (zone) => {
    // Validate center: must be object with valid numeric latitude/longitude
    if (zone.center &&
      typeof zone.center === 'object' &&
      zone.center.latitude != null &&
      zone.center.longitude != null &&
      typeof zone.center.latitude === 'number' &&
      typeof zone.center.longitude === 'number' &&
      isFinite(zone.center.latitude) &&
      isFinite(zone.center.longitude)) {
      return {
        latitude: Number(zone.center.latitude),
        longitude: Number(zone.center.longitude)
      };
    }

    // Calculate center from polygon coordinates
    if (Array.isArray(zone.coordinates) && zone.coordinates.length > 0) {
      const coords = zone.coordinates.filter(c =>
        c &&
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        isFinite(c.latitude) &&
        isFinite(c.longitude)
      );
      if (coords.length > 0) {
        const sumLat = coords.reduce((sum, c) => sum + c.latitude, 0);
        const sumLng = coords.reduce((sum, c) => sum + c.longitude, 0);
        return {
          latitude: sumLat / coords.length,
          longitude: sumLng / coords.length
        };
      }
    }

    // Fallback: If zone name is "Hyderabad" or unit is "Hyderabad", use Hyderabad coordinates
    if (zone.name === 'Hyderabad' || zone.unit_name === 'Hyderabad' || zone.unit === 'Hyderabad') {
      console.log(`[Geospatial] Using fallback Hyderabad coordinates for zone "${zone.name}"`);
      return { latitude: 17.3850, longitude: 78.4867 }; // Hyderabad city center
    }

    return null;
  };

  // Calculate bounding box for better map view
  const calculateZoneBounds = (zone) => {
    if (!Array.isArray(zone.coordinates) || zone.coordinates.length === 0) {
      return null;
    }

    const coords = zone.coordinates.filter(c =>
      c && typeof c.latitude === 'number' && typeof c.longitude === 'number'
    );

    if (coords.length === 0) return null;

    const lats = coords.map(c => c.latitude);
    const lngs = coords.map(c => c.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Add padding
    const latDelta = (maxLat - minLat) * 1.5;
    const lngDelta = (maxLng - minLng) * 1.5;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01)
    };
  };

  const handleZoneChange = (zoneName) => {
    console.log(`[Geospatial] handleZoneChange called for: "${zoneName}"`);
    setSelectedZone(zoneName);

    // Find zone by name - if multiple zones with same name, prefer the one matching commander's unit
    let selected = zones.find(z => z.name === zoneName);

    // If multiple zones with same name, ensure we get the right one
    const matchingZones = zones.filter(z => z.name === zoneName);
    if (matchingZones.length > 1) {
      console.warn(`[Geospatial] ⚠️ Multiple zones found with name "${zoneName}":`, matchingZones.length);
      // If commander, prefer zone matching their unit
      if (currentUser && currentUser.role === 'commander' && currentUser.unit) {
        const commanderUnit = (currentUser.unit || '').toString().trim().toLowerCase();
        const unitMatch = matchingZones.find(z => {
          const zoneUnit = (z.unit_name || z.unit || '').toString().trim().toLowerCase();
          return zoneUnit === commanderUnit;
        });
        if (unitMatch) {
          selected = unitMatch;
          console.log(`[Geospatial] ✅ Selected zone matching commander's unit`);
        }
      }
    }

    const centerLat = selected?.center?.latitude;
    const centerLng = selected?.center?.longitude;
    const centerStr = (centerLat != null && centerLng != null)
      ? `${Number(centerLat).toFixed(4)}, ${Number(centerLng).toFixed(4)}`
      : 'N/A';
    const location = (centerLat != null)
      ? (centerLat > 30 ? 'Likely India/Hyderabad' : centerLat < 20 ? 'Likely China/Other' : 'Unknown')
      : 'N/A';

    console.log(`[Geospatial] Found zone:`, selected ? {
      id: selected.id,
      name: selected.name,
      unit: selected.unit_name || selected.unit,
      hasCoordinates: Array.isArray(selected.coordinates) && selected.coordinates.length > 0,
      coordCount: selected.coordinates?.length || 0,
      hasCenter: !!selected.center,
      center: centerStr,
      location: location
    } : 'NOT FOUND');

    if (selected) {
      console.log(`[Geospatial] Processing zone "${selected.name}":`, {
        hasCenter: !!selected.center,
        centerData: selected.center,
        hasCoordinates: Array.isArray(selected.coordinates) && selected.coordinates.length > 0,
        coordCount: selected.coordinates?.length || 0,
        unit: selected.unit_name || selected.unit,
        radius: selected.radius_meters
      });

      // Try to get center first (calculateZoneCenter now has fallback for Hyderabad)
      const center = calculateZoneCenter(selected);
      console.log(`[Geospatial] Calculated center for "${selected.name}":`, center);

      if (center) {
        // Try to get bounds first (better view) if coordinates exist
        const bounds = calculateZoneBounds(selected);
        const newRegion = bounds || {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: selected.radius_meters ? (selected.radius_meters / 111000) * 2 : 0.1, // Convert meters to degrees
          longitudeDelta: selected.radius_meters ? (selected.radius_meters / 111000) * 2 : 0.1,
        };

        console.log(`[Geospatial] ✅ Setting map region to:`, newRegion);
        console.log(`[Geospatial] Map ref available:`, !!mapRef.current);

        // Update state first (validate before setting)
        if (isValidRegion(newRegion)) {
          setRegion(newRegion);
        } else {
          console.warn('[Geospatial] Invalid region, using fallback:', newRegion);
          setRegion(fallbackRegion);
        }

        // Animate map to the new region (with retry if map ref not ready)
        const animateMap = () => {
          if (mapRef.current) {
            try {
              mapRef.current.animateToRegion(newRegion, 1000);
              console.log(`[Geospatial] ✅ Map animation started`);
            } catch (err) {
              console.error(`[Geospatial] ❌ Error animating map:`, err);
            }
          } else {
            console.warn(`[Geospatial] ⚠️ Map ref not ready, retrying in 100ms...`);
            setTimeout(animateMap, 100);
          }
        };

        // Try immediately, then retry if needed
        setTimeout(animateMap, 50);
      } else {
        console.error(`[Geospatial] ❌ Zone "${zoneName}" has no valid coordinates or center, and no fallback available`);
        console.error(`[Geospatial] Zone data:`, JSON.stringify(selected, null, 2));
        Alert.alert(
          'Zone Location Unavailable',
          `The zone "${zoneName}" does not have location data available. Please contact support to add coordinates for this zone.`
        );
      }
    } else {
      console.warn(`[Geospatial] ❌ Zone "${zoneName}" not found in zones list`);
      console.warn(`[Geospatial] Available zones:`, zones.map(z => z.name));
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

  const renderSearchResult = ({ item }) => {
    // Handle zone items differently from personnel
    if (item.category === 'zone') {
      const center = calculateZoneCenter(item);
      const coordCount = Array.isArray(item.coordinates) ? item.coordinates.length : 0;
      return (
        <TouchableOpacity
          style={styles.searchResultItem}
          onPress={() => {
            if (center) {
              handleSelectLocation({
                latitude: center.latitude,
                longitude: center.longitude,
                name: item.name,
                type: 'zone'
              });
            }
            handleZoneChange(item.name);
          }}
        >
          <Icon
            name="location"
            size={24}
            color={item.color || '#009688'}
          />
          <View style={styles.searchResultContent}>
            <Text style={styles.searchResultTitle}>{item.name || `Zone ${item.id}`}</Text>
            <Text style={styles.searchResultSubtitle}>
              {`Unit: ${item.unit_name || item.unit || 'N/A'} | Type: ${item.zone_type || item.type || 'N/A'} | Coordinates: ${coordCount}`}
            </Text>
            {center && (
              <Text style={[styles.searchResultSubtitle, { fontSize: 11, color: '#666' }]}>
                Center: {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // Handle personnel items
    return (
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
  };

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
    const userUnit = currentUser?.unit ? String(currentUser.unit).trim().toLowerCase() : null;

    // First filter by user's unit
    let filtered = soldiers;
    if (userUnit) {
      filtered = soldiers.filter(p => {
        const soldierUnit = String(p.unit || '').trim().toLowerCase();
        return soldierUnit === userUnit;
      });
    }

    // Then filter by selected zone if one is selected
    if (!selectedZone) return filtered;
    return filtered.filter(p => (p.zoneName || p.zone) === selectedZone);
  };

  const isValidRegion = region =>
    region &&
    typeof region.latitude === 'number' &&
    isFinite(region.latitude) &&
    typeof region.longitude === 'number' &&
    isFinite(region.longitude) &&
    typeof region.latitudeDelta === 'number' &&
    isFinite(region.latitudeDelta) &&
    region.latitudeDelta > 0 &&
    typeof region.longitudeDelta === 'number' &&
    isFinite(region.longitudeDelta) &&
    region.longitudeDelta > 0;

  const fallbackRegion = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  };

  const safeNumber = (v, fallback) => (typeof v === 'number' && !isNaN(v) ? v : fallback);

  // Helper function to validate and set region safely
  const setRegionSafely = (newRegion) => {
    if (!newRegion) {
      setRegion(fallbackRegion);
      return;
    }

    const lat = typeof newRegion.latitude === 'number' && isFinite(newRegion.latitude)
      ? newRegion.latitude : fallbackRegion.latitude;
    const lng = typeof newRegion.longitude === 'number' && isFinite(newRegion.longitude)
      ? newRegion.longitude : fallbackRegion.longitude;
    const latDelta = typeof newRegion.latitudeDelta === 'number' && isFinite(newRegion.latitudeDelta) && newRegion.latitudeDelta > 0
      ? Math.abs(newRegion.latitudeDelta) : fallbackRegion.latitudeDelta;
    const lngDelta = typeof newRegion.longitudeDelta === 'number' && isFinite(newRegion.longitudeDelta) && newRegion.longitudeDelta > 0
      ? Math.abs(newRegion.longitudeDelta) : fallbackRegion.longitudeDelta;

    setRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    });
  };

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

      {/* Zone Selector - Visible to all users */}
      {zones.length > 0 && (
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
        <LeafletMap
          region={isValidRegion(region) ? region : fallbackRegion}
          mapLayer={mapType}
          markers={[
            // Commander view markers
            ...(currentUser?.role === 'commander' ? getZonePersonnel().filter(soldier =>
              typeof soldier.latitude === 'number' && typeof soldier.longitude === 'number' &&
              !isNaN(soldier.latitude) && !isNaN(soldier.longitude)
            ).map(soldier => ({
              latitude: soldier.latitude,
              longitude: soldier.longitude,
              title: soldier.name || soldier.username || i18n.t('soldier')
            })) : []),
            // Soldier view markers
            ...(currentUser?.role === 'soldier' ? getZonePersonnel().filter(person =>
              typeof person.latitude === 'number' && typeof person.longitude === 'number' &&
              !isNaN(person.latitude) && !isNaN(person.longitude)
            ).map(person => ({
              latitude: person.latitude,
              longitude: person.longitude,
              title: person.name || person.username || (String(person.role || '').toLowerCase() === 'commander' ? i18n.t('commander') : i18n.t('soldier'))
            })) : []),
            // Selected location marker
            ...(selectedLocation && typeof selectedLocation.latitude === 'number' && !isNaN(selectedLocation.latitude) ? [{
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
              title: selectedLocation.name || selectedLocation.username || i18n.t('soldier')
            }] : [])
          ]}
          circles={zones.filter(z => z.center && z.center.latitude != null && z.radius_meters).map(z => ({
            center: {
              latitude: Number(z.center.latitude),
              longitude: Number(z.center.longitude)
            },
            radius: Number(z.radius_meters),
            strokeColor: z.color || '#009688',
            fillColor: z.color || '#009688'
          }))}
          polygons={zones.filter(z => (Array.isArray(z.coordinates) && z.coordinates.length >= 3) || (Array.isArray(z.polygon) && z.polygon.length >= 3)).map(z => ({
            coordinates: (Array.isArray(z.coordinates) && z.coordinates.length >= 3 ? z.coordinates : z.polygon).map(c => ({
              latitude: Number(c.lat || c.latitude),
              longitude: Number(c.lng || c.longitude)
            })),
            strokeColor: z.color || '#009688',
            fillColor: z.color || '#009688'
          }))}
        />

        {/* Layer Selection Panel */}
        {showLayerPanel && (
          <View style={styles.layerPanel}>
            <Text style={styles.panelTitle}>Select Map Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerScroll}>
              {layers.map(layer => (
                <TouchableOpacity
                  key={layer.id}
                  style={[styles.layerItem, mapType === layer.id && styles.activeLayerItem]}
                  onPress={() => {
                    setMapType(layer.id);
                    setShowLayerPanel(false);
                  }}
                >
                  <Icon name={layer.icon} size={24} color={mapType === layer.id ? '#fff' : '#4CAF50'} />
                  <Text style={[styles.layerItemText, mapType === layer.id && styles.activeLayerItemText]}>{layer.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={[styles.controlButton, showLayerPanel && { backgroundColor: '#4CAF50' }]}
            onPress={() => setShowLayerPanel(!showLayerPanel)}
          >
            <Icon name="layers" size={24} color={showLayerPanel ? '#fff' : '#333'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selected Location Info */}
      {
        selectedLocation && (
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

            <View style={[styles.locationInfoActions, { justifyContent: 'center' }]}>
              <TouchableOpacity
                style={[styles.actionButton, { paddingHorizontal: 28 }]}
                onPress={() => openExternalNavigation(selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name || selectedLocation.username)}
              >
                <Icon name="eye" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>{i18n.t('track')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      }
    </View >
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
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 30,
    zIndex: 10,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  layerPanel: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 6.68,
    zIndex: 20,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  layerScroll: {
    paddingBottom: 4,
  },
  layerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    minWidth: 90,
  },
  activeLayerItem: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  layerItemText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
    fontWeight: '500',
  },
  activeLayerItemText: {
    color: '#fff',
    fontWeight: '700',
  },
});
