import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, SafeAreaView, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import LeafletMap from '../components/LeafletMap';
import NotificationBadge from '../components/NotificationBadge';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNotifications } from '../NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { addLanguageChangeListener } from '../utils/i18n';
// Removed useLocationSync import - using database location instead
import { useFocusEffect } from '@react-navigation/native';
import { socket } from '../services/api';
import * as ExpoLocation from 'expo-location';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation, route: routeParam, routeCoords, fromLocation, gpsMode = false }) {
  // Default values for user info
  const [userRole, setUserRole] = useState('soldier');
  const [userUnit, setUserUnit] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
  // Removed userName/userUnit usage

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  // Load user info from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.role) setUserRole(user.role);
          if (user.unit) setUserUnit(user.unit);
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
    if (routeParam.params) {
      if (routeParam.params.userRole) setUserRole(routeParam.params.userRole);
      if (routeParam.params.userName) setUsername(routeParam.params.userName);
      if (routeParam.params.userUnit) setUserUnit(routeParam.params.userUnit);
    }
  }, [routeParam.params]);

  // Load user data from AsyncStorage on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.role) setUserRole(user.role);
          if (user.unit) setUserUnit(user.unit);
          if (user.username) setUsername(user.username);
        }
      } catch (error) {
        console.error('Error loading user data in HomeScreen:', error);
      }
    };

    loadUserData();
  }, []);

  // Removed legacy dropdown header; global drawer handles menu
  const [location, setLocation] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [mobileGpsLocation, setMobileGpsLocation] = useState(null);
  const positionWatchRef = useRef(null);
  const headingWatchRef = useRef(null);
  const lastMobileFixRef = useRef(null);
  // Initialize region with valid default values to prevent NaN errors
  const defaultRegion = {
    latitude: 17.4821836,
    longitude: 78.4789815,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  const [region, setRegion] = useState(defaultRegion);
  // removed selectedAsset/trackingEnabled
  const [mapType, setMapType] = useState('standard');

  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  const normalizeHeading = (h) => {
    if (typeof h !== 'number' || !isFinite(h)) return 0;
    const v = ((h % 360) + 360) % 360;
    return v;
  };

  const smoothHeading = (prev, next, alpha = 0.2) => {
    const p = normalizeHeading(prev);
    const n = normalizeHeading(next);
    let delta = n - p;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return normalizeHeading(p + delta * alpha);
  };

  const smoothPosition = (prev, next, alpha = 0.25) => {
    if (!prev) return next;
    if (!next) return prev;
    return {
      ...next,
      latitude: prev.latitude + (next.latitude - prev.latitude) * alpha,
      longitude: prev.longitude + (next.longitude - prev.longitude) * alpha,
    };
  };

  useEffect(() => {
    let cancelled = false;

    const stopWatches = async () => {
      try {
        if (positionWatchRef.current) {
          try { positionWatchRef.current.remove(); } catch { }
          positionWatchRef.current = null;
        }
        if (headingWatchRef.current) {
          try { headingWatchRef.current.remove(); } catch { }
          headingWatchRef.current = null;
        }
      } catch { }
    };

    const startWatches = async () => {
      await stopWatches();

      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use Mobile GPS.');
        return;
      }

      try {
        const current = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });
        if (cancelled) return;
        if (current?.coords?.latitude && current?.coords?.longitude) {
          const initial = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            accuracy: current.coords.accuracy,
            heading: normalizeHeading(typeof current.coords.heading === 'number' ? current.coords.heading : 0),
          };
          lastMobileFixRef.current = initial;
          setMobileGpsLocation(initial);
          setDeviceHeading(initial.heading);
        }
      } catch { }

      try {
        headingWatchRef.current = await ExpoLocation.watchHeadingAsync((h) => {
          if (cancelled) return;
          const trueHeading = typeof h?.trueHeading === 'number' ? h.trueHeading : h?.magHeading;
          const next = normalizeHeading(trueHeading);
          setDeviceHeading((prev) => smoothHeading(prev, next, 0.25));
        });
      } catch (e) {
        console.warn('[Home] watchHeadingAsync failed:', e?.message);
      }

      try {
        positionWatchRef.current = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (pos) => {
            if (cancelled) return;
            const lat = pos?.coords?.latitude;
            const lng = pos?.coords?.longitude;
            if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) return;

            const rawHeading = typeof pos.coords.heading === 'number' ? pos.coords.heading : null;
            const next = {
              latitude: lat,
              longitude: lng,
              accuracy: pos.coords.accuracy,
              heading: normalizeHeading(rawHeading ?? deviceHeading ?? 0),
            };

            const prev = lastMobileFixRef.current;
            const smoothed = smoothPosition(prev, next, 0.35);
            smoothed.heading = smoothHeading(prev?.heading ?? deviceHeading ?? 0, next.heading, 0.25);

            lastMobileFixRef.current = smoothed;
            setMobileGpsLocation(smoothed);
            setDeviceHeading((prevH) => smoothHeading(prevH, smoothed.heading, 0.35));
          }
        );
      } catch (e) {
        console.warn('[Home] watchPositionAsync failed:', e?.message);
      }
    };

    if (gpsMode) {
      startWatches();
    } else {
      stopWatches();
      setMobileGpsLocation(null);
    }

    return () => {
      cancelled = true;
      stopWatches();
    };
  }, [gpsMode]);

  // Load userId and photo from AsyncStorage (mount + focus)
  const loadUserFromStorage = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.id) setUserId(user.id);
        if (user.username) setUsername(user.username);
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

  // Unit members for real-time tracking
  const [unitMembers, setUnitMembers] = useState([]);

  // Socket listener for live location updates
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (data) => {
      console.log('[Home] Socket location update received:', data);
      if (data && data.userId) {
        setUnitMembers(prev => {
          const index = prev.findIndex(u => u.id === data.userId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], latitude: data.latitude, longitude: data.longitude, heading: data.heading };
            return updated;
          }
          return prev;
        });

        // Also update unitMembersInZone if the user is in that list
        setUnitMembersInZone(prev => {
          const index = prev.findIndex(u => u.id === data.userId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], latitude: data.latitude, longitude: data.longitude, heading: data.heading };
            return updated;
          }
          return prev;
        });
      }
    };

    socket.on('locationUpdate', handleLocationUpdate);
    console.log('[Home] Socket locationUpdate listener attached');

    return () => {
      socket.off('locationUpdate', handleLocationUpdate);
    };
  }, [socket]);

  // Current zone and unit members in that zone
  const [currentZone, setCurrentZone] = useState(null);
  const [unitMembersInZone, setUnitMembersInZone] = useState([]);
  const [allCircles, setAllCircles] = useState([]); // from /zones/all
  const [allPolygons, setAllPolygons] = useState([]); // from /zones/all
  const [legacyZones, setLegacyZones] = useState([]); // from /api/zones legacy

  // Use global header menu from TabNavigator; do not override here

  // Get the addNotification function from context
  const { addNotification, stopAlertSound } = useNotifications();
  const [isBreachingLink, setIsBreachingLink] = useState(false); // Track local breach state to prevent spam

  // Monitor Geofence Status - Aggregated Safety Check
  useEffect(() => {
    if (!location) return;

    // Filter assigned zones (Circles + Polygons)
    let myAssignedZones = [];
    if (userUnit) {
      const u = String(userUnit).trim().toLowerCase();
      // Use robust defaults if allCircles/allPolygons are not yet loaded
      const circles = Array.isArray(allCircles) ? allCircles : [];
      const polygons = Array.isArray(allPolygons) ? allPolygons : [];

      myAssignedZones = [
        ...circles.filter(z => String(z.unit || z.unit_name || '').trim().toLowerCase() === u),
        ...polygons.filter(z => String(z.unit || z.unit_name || '').trim().toLowerCase() === u)
      ];

      console.log(`[Home] Zone Check: userUnit='${u}', circles=${circles.length}, polygons=${polygons.length}, myZones=${myAssignedZones.length}`);
    } else {
      console.log('[Home] Zone Check: userUnit is NULL/undefined');
    }

    // FIXED: Check if inside ANY zone at all (regardless of unit assignment)
    // This prevents false breach alerts when user is inside a zone but unit names don't match
    const allZones = [...(Array.isArray(allCircles) ? allCircles : []), ...(Array.isArray(allPolygons) ? allPolygons : [])];
    const isInsideAnyZone = allZones.some(z => isInsideZone(location, z));
    const isSafe = isInsideAnyZone;

    console.log(`[Home] Safety: isSafe=${isSafe}, breaching=${isBreachingLink}, totalZones=${allZones.length}`);

    // Only trigger breach alerts if zones actually exist
    // This prevents false alerts immediately after login when zones haven't loaded yet
    if (!isSafe && allZones.length > 0) {
      // User is OUTSIDE ALL assigned zones AND zones exist
      if (!isBreachingLink) {
        console.log('[Home] Geofence Breach Detected (Outside ALL assigned zones)!');
        setIsBreachingLink(true);
        // Trigger notification which handles the sound loop
        addNotification({
          title: i18n.t('zoneBreachAlert') || 'Zone Breach',
          message: i18n.t('zoneBreachMessage') || 'You have left your assigned zone!',
          type: 'zone_breach',
          priority: 'urgent',
          source: 'app_geofence'
        });
      }
    } else {
      // User is INSIDE at least one zone (or has no zones)
      if (isBreachingLink) {
        // Enforce sound stop multiple times to be safe against race conditions
        console.log('[Home] User returned to safe zone(s). Stopping Sound.');
        setIsBreachingLink(false);
        stopAlertSound();

        addNotification({
          title: i18n.t('zoneReturn') || 'Zone Return',
          message: i18n.t('zoneReturnMessage') || 'You are back in the safe zone.',
          type: 'info', // Info doesn't loop
          priority: 'normal'
        });
      }
    }
  }, [location, allCircles, allPolygons, userUnit]);

  useEffect(() => {
    let pollingInterval = null;
    let isCancelled = false; // Flag to cancel pending operations on cleanup

    (async () => {
      console.log('[Home] useEffect started - loading location from database');
      try {
        // Fetch current zone and unit members
        try {
          const { apiService } = require('../services/api');

          // Get user info to determine role and unit
          let userRole = 'soldier';
          let userUnit = null;
          let currentUserId = null;
          try {
            const raw = await AsyncStorage.getItem('currentUser');
            if (raw) {
              const user = JSON.parse(raw);
              userRole = user?.role || 'soldier';
              userUnit = user?.unit || null;
              currentUserId = user?.id || null;
            }
          } catch { }

          // Function to fetch and update user location from database
          const fetchUserLocationFromDB = async () => {
            if (!username || isCancelled) return; // Check cancellation flag

            // CRITICAL: Verify this is still the current user (prevent stale fetches after logout)
            try {
              const currentUserData = await AsyncStorage.getItem('currentUser');
              if (currentUserData) {
                const currentUser = JSON.parse(currentUserData);
                if (currentUser.username !== username) {
                  console.log(`[Home] Skipping fetch for stale username '${username}' (current: '${currentUser.username}')`);
                  return; // User has changed, don't fetch old user's data
                }
              } else {
                // No current user means logged out
                console.log('[Home] No current user in storage, skipping fetch');
                return;
              }
            } catch (e) {
              console.warn('[Home] Failed to verify current user:', e);
            }

            if (isCancelled) return; // Double-check before API call

            try {
              console.log('[Home] Fetching location from database for username:', username);
              // Fetch user data from database (includes latitude, longitude, heading)
              const userDataArray = await apiService.getUserByUsername(username);

              // The API returns an array, get first match
              let userData = null;
              if (Array.isArray(userDataArray) && userDataArray.length > 0) {
                userData = userDataArray[0];
              } else if (userDataArray && !Array.isArray(userDataArray)) {
                userData = userDataArray;
              }

              if (userData && typeof userData.latitude === 'number' && typeof userData.longitude === 'number') {
                console.log('[Home] Database location:', userData.latitude, userData.longitude, 'heading:', userData.heading);

                // Update location state with database coordinates
                setLocation({
                  latitude: userData.latitude,
                  longitude: userData.longitude,
                  heading: typeof userData.heading === 'number' ? userData.heading : 0
                });

                // Also update deviceHeading if available
                if (typeof userData.heading === 'number') {
                  setDeviceHeading(userData.heading);
                }

                // Center map on first load only
                if (!region || region.latitude === defaultRegion.latitude) {
                  setRegion({
                    latitude: userData.latitude,
                    longitude: userData.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }
              } else {
                console.warn('[Home] No valid location found in database for user');
              }
            } catch (err) {
              console.warn('[Home] Failed to fetch location from database:', err.message);
            }
          };

          // Initial fetch
          await fetchUserLocationFromDB();

          // Set up polling every 5 seconds
          pollingInterval = setInterval(fetchUserLocationFromDB, 5000);
          console.log('[Home] Database location polling started (every 5 seconds)');

          // For soldiers: Get assigned zone from their unit (not based on current location)
          // For commanders: Get zone based on current location
          let zone = null;

          if (userRole === 'soldier' && userUnit) {
            // Soldier: Get assigned zone from their unit
            try {
              const all = await apiService.getAllZones(userUnit, currentUserId);
              const unitMatch = (val) => {
                if (!userUnit) return false;
                const a = String(val || '').trim().toLowerCase();
                const b = String(userUnit || '').trim().toLowerCase();
                return a === b || a.includes(b) || b.includes(a);
              };

              // Find first zone matching soldier's unit (their assigned zone)
              const circles = Array.isArray(all?.circles) ? all.circles : [];
              const polygons = Array.isArray(all?.polygons) ? all.polygons : [];

              const assignedCircle = circles.find(z => unitMatch(z?.unit || z?.unit_name));
              const assignedPolygon = polygons.find(z => unitMatch(z?.unit || z?.unit_name));

              // Prefer circle zone if available, otherwise use polygon
              zone = assignedCircle || assignedPolygon || null;

              if (zone) {
                // Ensure zone has valid center coordinates
                if (!zone.center && Array.isArray(zone.polygon) && zone.polygon.length >= 3) {
                  const lats = zone.polygon.map(p => Number(p.lat || p.latitude)).filter(x => isFinite(x));
                  const lngs = zone.polygon.map(p => Number(p.lng || p.longitude)).filter(x => isFinite(x));
                  if (lats.length > 0 && lngs.length > 0) {
                    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                    zone.center = { latitude: centerLat, longitude: centerLng };
                    console.log('[Home] Calculated center for soldier assigned zone:', zone.center);
                  }
                }

                // Also check coordinates array format
                if (!zone.center && Array.isArray(zone.coordinates) && zone.coordinates.length >= 3) {
                  const lats = zone.coordinates.map(c => Number(c.latitude || c.lat)).filter(x => isFinite(x));
                  const lngs = zone.coordinates.map(c => Number(c.longitude || c.lng)).filter(x => isFinite(x));
                  if (lats.length > 0 && lngs.length > 0) {
                    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                    zone.center = { latitude: centerLat, longitude: centerLng };
                    console.log('[Home] Calculated center from coordinates for soldier assigned zone:', zone.center);
                  }
                }
              }

              // Still load all zones for display
              try { setAllCircles(circles); } catch { }
              try { setAllPolygons(polygons); } catch { }
            } catch (e) {
              console.warn('[Home] Failed to get assigned zone for soldier:', e?.message);
            }
          } else {
            // Commander: Get zone based on Unit FIRST (like soldier), then location
            console.log('[Home] Commander Logic: Attempting to fetch zones by unit:', userUnit);
            try {
              // 1. Try to get zones assigned to commander's unit
              if (userUnit) {
                const all = await apiService.getAllZones(userUnit, currentUserId);
                console.log(`[Home] getAllZones response items: circles=${all?.circles?.length}, polygons=${all?.polygons?.length}`);

                const unitMatch = (val) => {
                  const a = String(val || '').trim().toLowerCase();
                  const b = String(userUnit || '').trim().toLowerCase();
                  if (!a || !b) return false; // Strict: both must exist and be non-empty
                  return a === b || a.includes(b) || b.includes(a);
                };

                const circles = Array.isArray(all?.circles) ? all.circles : [];
                const polygons = Array.isArray(all?.polygons) ? all.polygons : [];

                // Filter zones by unit
                const unitCircles = circles.filter(z => unitMatch(z?.unit || z?.unit_name));
                const unitPolygons = polygons.filter(z => unitMatch(z?.unit || z?.unit_name));

                // Always populate map with ALL zones or at least Unit zones, so something shows up
                // If we found specific unit zones, focus on them
                try { setAllCircles(circles); } catch { }
                try { setAllPolygons(polygons); } catch { }

                if (unitCircles.length > 0 || unitPolygons.length > 0) {
                  console.log(`[Home] Commander found ${unitCircles.length} circles and ${unitPolygons.length} polygons for unit '${userUnit}'`);
                  // Set current zone to the first available one (prefer circle)
                  zone = unitCircles[0] || unitPolygons[0] || null;
                } else {
                  console.log(`[Home] Commander: No zones found specifically for unit '${userUnit}'. Showing all ${circles.length + polygons.length} zones.`);
                }
              }

              // 2. If no unit zones found (or userUnit null), fallback to location-based lookup
              if (!zone) {
                const lat = (location || {}).latitude || region.latitude;
                const lng = (location || {}).longitude || region.longitude;
                if (lat && lng) {
                  zone = await apiService.getZoneByPoint(lat, lng).catch(err => {
                    console.warn('[Home] getZoneByPoint failed:', err);
                    return null;
                  });
                }
              }
            } catch (e) {
              console.error('[Home] Error fetching commander zones:', e);
            }


          }

          setCurrentZone(zone);

          if (zone && zone.center && Number(zone.radius_meters) > 0) {
            const lat = Number(zone.center.latitude);
            const lng = Number(zone.center.longitude);
            const r = Number(zone.radius_meters);
            const latDelta = Math.max(0.005, (r / 111000) * 2.5);
            const lonDelta = Math.max(0.005, (r / (111000 * Math.cos(lat * Math.PI / 180))) * 2.5);
            if (isFinite(lat) && isFinite(lng)) {
              setRegionSafely({ latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lonDelta });
            }
          }

          // Load current user to filter members by unit
          let unit = null;
          try {
            const userRaw = await AsyncStorage.getItem('currentUser');
            unit = userRaw ? (JSON.parse(userRaw)?.unit || null) : null;
          } catch { }

          if (unit) {
            // Fetch all users in unit for "Live Map"
            if (userRole === 'soldier') {
              // VISIBILITY RESTRICTION: Soldier sees only themselves.
              setUnitMembers([]);
              setUnitMembersInZone([]);
            } else {
              // Commander sees all unit members
              try {
                const allUsers = await apiService.getUsersByRoleAndUnit('soldier', unit);
                const commanders = await apiService.getUsersByRoleAndUnit('commander', unit);
                const candidates = [...(allUsers || []), ...(commanders || [])];
                setUnitMembers(candidates);

                if (zone) {
                  const inZone = candidates.filter(u => typeof isInsideZone === 'function' ? isInsideZone(u, zone) : true);
                  setUnitMembersInZone(inZone);
                } else {
                  setUnitMembersInZone([]);
                }
              } catch (err) {
                console.warn('[Home] Failed to fetch unit members:', err.message);
              }
            }
          } else {
            setUnitMembers([]);
            setUnitMembersInZone([]);
          }

        } catch (e) {
          console.warn('[Home] Error loading data:', e);
        }

      } catch (error) {
        console.warn('Error in HomeScreen setup:', error);
        setRegionSafely(defaultRegion);
        addNotification({
          title: 'Map Loading',
          message: 'Initializing map with default view.',
          type: 'info'
        });
      }
    })();

    // cleanup logic
    return () => {
      isCancelled = true; // Set flag to cancel all pending operations
      if (pollingInterval) {
        console.log('[Home] Cleaning up database polling interval');
        clearInterval(pollingInterval);
      }
    };
  }, [addNotification, userId, username]);

  const toRad = (x) => (x * Math.PI) / 180;
  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const pointInPolygon = (pt, poly) => {
    try {
      if (!Array.isArray(poly) || poly.length < 3) return false;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = Number(poly[i].lat), yi = Number(poly[i].lng);
        const xj = Number(poly[j].lat), yj = Number(poly[j].lng);
        const intersect = ((yi > pt.lng) !== (yj > pt.lng)) &&
          (pt.lat < (xj - xi) * (pt.lng - yi) / ((yj - yi) || 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    } catch { return false; }
  };

  const isInsideZone = (user, zone) => {
    if (!zone) return false;
    const lat = Number(user?.latitude);
    const lng = Number(user?.longitude);
    if (!isFinite(lat) || !isFinite(lng)) return false;
    // polygon first
    if (Array.isArray(zone?.polygon) && zone.polygon.length >= 3) {
      return pointInPolygon({ lat, lng }, zone.polygon);
    }
    const dist = haversineMeters(lat, lng, Number(zone?.center?.latitude), Number(zone?.center?.longitude));
    return isFinite(dist) && dist <= Number(zone?.radius_meters || 0);
  };

  // When the selected/current zone changes, fetch unit members assigned to that zone and show markers
  useEffect(() => {
    (async () => {
      try {
        if (!currentZone) { setUnitMembersInZone([]); return; }
        const unitName = currentZone.unit || currentZone.unit_name || null;
        if (!unitName) { setUnitMembersInZone([]); return; }
        const { apiService } = require('../services/api');
        const soldiers = await apiService.getUsersByRoleAndUnit('soldier', unitName).catch(() => []);
        const commanders = await apiService.getUsersByRoleAndUnit('commander', unitName).catch(() => []);
        const candidates = [...(soldiers || []), ...(commanders || [])];
        const inZone = candidates.filter(u => isInsideZone(u, currentZone));
        setUnitMembersInZone(inZone);
      } catch { setUnitMembersInZone([]); }
    })();
  }, [currentZone]);

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
      console.log('[Home] Recentering to user location from database...');

      // Fetch location from database
      const { apiService } = require('../services/api');

      if (!userId && !username) {
        console.warn('[Home] No user ID or username available to fetch location');
        addNotification({
          title: 'Location Unavailable',
          message: 'Cannot fetch location: user information not available.',
          type: 'warning'
        });
        return;
      }

      try {
        console.log('[Home] Fetching location from database for user:', userId || username);
        const userDataArray = await apiService.getUserByUsername(username);

        // The API returns an array, get first match
        let userData = null;
        if (Array.isArray(userDataArray) && userDataArray.length > 0) {
          userData = userDataArray[0];
        } else if (userDataArray && !Array.isArray(userDataArray)) {
          userData = userDataArray;
        }

        if (userData && typeof userData.latitude === 'number' && typeof userData.longitude === 'number' && isFinite(userData.latitude) && isFinite(userData.longitude) && (userData.latitude !== 0 || userData.longitude !== 0)) {
          console.log('[Home] Database location found:', userData.latitude, userData.longitude);
          const lat = userData.latitude;
          const lng = userData.longitude;

          // Update location state
          setLocation({
            latitude: lat,
            longitude: lng,
            heading: typeof userData.heading === 'number' ? userData.heading : 0
          });

          // Center map
          setRegionSafely({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });

          console.log('[Home] Successfully recentered to database location:', lat, lng);
          addNotification({
            title: i18n.t('locationFound'),
            message: 'Centered on your database location.',
            type: 'info'
          });
        } else {
          const reason = !userData ? 'No user data found in database' : 'Invalid coordinates (0/0 or missing)';
          console.error('[Home] Cannot center: Reason:', reason);
          addNotification({
            title: i18n.t('locationError'),
            message: `Could not retrieve location from database. Please ensure your location is set.`,
            type: 'warning'
          });
        }
      } catch (error) {
        console.warn('[Home] Database fetch error:', error.message);
        addNotification({
          title: 'Location Unavailable',
          message: `Could not fetch location from database: ${error.message}`,
          type: 'warning'
        });
      }
    } catch (error) {
      console.warn('[Home] Recenter error:', error.message);
      addNotification({
        title: 'Location Unavailable',
        message: `Could not center map: ${error.message}`,
        type: 'warning'
      });
    }
  };



  // Helper function to validate and set region safely
  const setRegionSafely = (newRegion) => {
    if (!newRegion) {
      setRegion(defaultRegion);
      return;
    }

    const lat = typeof newRegion.latitude === 'number' && isFinite(newRegion.latitude)
      ? newRegion.latitude : defaultRegion.latitude;
    const lng = typeof newRegion.longitude === 'number' && isFinite(newRegion.longitude)
      ? newRegion.longitude : defaultRegion.longitude;
    const latDelta = typeof newRegion.latitudeDelta === 'number' && isFinite(newRegion.latitudeDelta) && newRegion.latitudeDelta > 0
      ? newRegion.latitudeDelta : defaultRegion.latitudeDelta;
    const lngDelta = typeof newRegion.longitudeDelta === 'number' && isFinite(newRegion.longitudeDelta) && newRegion.longitudeDelta > 0
      ? newRegion.longitudeDelta : defaultRegion.longitudeDelta;

    // Ensure latitudeDelta is positive (southern latitude must be less than northern)
    const validatedRegion = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: Math.abs(latDelta),
      longitudeDelta: Math.abs(lngDelta),
    };

    setRegion(validatedRegion);
  };

  // Function to validate region before passing to MapView
  const getValidRegion = () => {
    if (!region) return defaultRegion;

    const lat = typeof region.latitude === 'number' && isFinite(region.latitude)
      ? region.latitude : defaultRegion.latitude;
    const lng = typeof region.longitude === 'number' && isFinite(region.longitude)
      ? region.longitude : defaultRegion.longitude;
    const latDelta = typeof region.latitudeDelta === 'number' && isFinite(region.latitudeDelta) && region.latitudeDelta > 0
      ? Math.abs(region.latitudeDelta) : defaultRegion.latitudeDelta;
    const lngDelta = typeof region.longitudeDelta === 'number' && isFinite(region.longitudeDelta) && region.longitudeDelta > 0
      ? Math.abs(region.longitudeDelta) : defaultRegion.longitudeDelta;

    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const layers = [
    { id: 'standard', name: 'Normal Map', icon: 'map-outline' },
    { id: 'satellite', name: 'Satellite', icon: 'earth-outline' },
    { id: 'geoStreet', name: 'Street View', icon: 'navigate-outline' },
    { id: 'geoTerrain', name: 'Terrain View', icon: 'mountain-outline' },
    // { id: 'geoTraffic', name: 'Geo Traffic', icon: 'bus-outline' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LeafletMap
          region={getValidRegion()}
          mapLayer={mapType}
          onLoad={() => {
            setMapLoading(false);
          }}
          markers={[
            // Only show user marker if not in route mode with "Your Location"
            ...(!routeCoords || fromLocation !== 'Your Location' ? ((gpsMode && routeCoords) ? [] : ((gpsMode ? mobileGpsLocation : location) ? [{
              latitude: (gpsMode ? mobileGpsLocation : location).latitude,
              longitude: (gpsMode ? mobileGpsLocation : location).longitude,
              heading: deviceHeading || (gpsMode ? mobileGpsLocation : location).heading || 0,
              title: "You are here",
              type: 'user'
            }] : [])) : []),
            // Only show unit members if not in route mode with "Your Location"
            ...(!routeCoords || fromLocation !== 'Your Location' ? unitMembers.map(m => ({
              latitude: m.latitude,
              longitude: m.longitude,
              heading: m.heading,
              title: m.role === 'commander'
                ? `Commander ${m.name || m.username}`
                : `Soldier ${m.name || m.username}`,
              id: m.id,
              type: m.role || 'soldier'
            })) : []),
            // Starting point marker (green arrow) - always show if route exists
            ...(routeCoords && routeCoords.length >= 2 ? [
              {
                latitude: (gpsMode && mobileGpsLocation ? mobileGpsLocation.latitude : routeCoords[0].latitude),
                longitude: (gpsMode && mobileGpsLocation ? mobileGpsLocation.longitude : routeCoords[0].longitude),
                title: fromLocation === 'Your Location' ? `${username || 'User'} - Start` : 'Start',
                description: 'Starting Location',
                id: 'route-start',
                type: 'route-start',
                icon: 'navigate',
                color: '#00FF00',
                heading: gpsMode ? (deviceHeading || 0) : 0
              }
            ] : []),
            // Destination marker (red location pin) - always show if route exists
            ...(routeCoords && routeCoords.length >= 2 ? [
              {
                latitude: routeCoords[routeCoords.length - 1].latitude,
                longitude: routeCoords[routeCoords.length - 1].longitude,
                title: 'Destination',
                description: 'Final Destination',
                id: 'route-end',
                type: 'route-end',
                icon: 'location',
                color: '#FF0000'
              }
            ] : [])
          ]}
          polylines={
            routeCoords ? [{
              coordinates: routeCoords,
              color: '#0000FF',
              strokeWidth: 4,
              strokeColor: 'rgba(0, 0, 255, 0.8)'
            }] : []
          }
          circles={
            allCircles.map(c => ({
              latitude: c.center.latitude,
              longitude: c.center.longitude,
              radius: c.radius_meters,
              color: 'rgba(0, 255, 0, 0.2)',
              strokeColor: 'rgba(0, 100, 0, 0.5)'
            }))
          }
          polygons={
            allPolygons.map(p => ({
              coordinates: p.polygon.map(pt => ({
                latitude: Number(pt.lat || pt.latitude),
                longitude: Number(pt.lng || pt.longitude)
              })),
              color: 'rgba(0, 255, 0, 0.2)',
              strokeColor: 'rgba(0, 100, 0, 0.5)'
            }))
          }
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
          <TouchableOpacity style={styles.controlButton} onPress={centerOnUserLocation}>
            <Icon name="locate" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, showLayerPanel && { backgroundColor: '#4CAF50' }]}
            onPress={() => setShowLayerPanel(!showLayerPanel)}
          >
            <Icon name="layers" size={24} color={showLayerPanel ? '#fff' : '#333'} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
