import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LeafletMap from '../components/LeafletMap';
import { apiService } from '../services/api';
import { green } from '../theme';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function TimelineScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [coords, setCoords] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  const t = useCallback((key, fallback, options) => {
    const value = i18n.t(key, options);
    if (typeof value === 'string' && value !== key) return value;
    return fallback ?? key;
  }, [currentLanguage]);
  const mapRef = useRef(null);
  const defaultRegion = {
    latitude: 17.4822,
    longitude: 78.4790,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };
  const [region, setRegion] = useState(defaultRegion);

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
      ? Math.abs(newRegion.latitudeDelta) : defaultRegion.latitudeDelta;
    const lngDelta = typeof newRegion.longitudeDelta === 'number' && isFinite(newRegion.longitudeDelta) && newRegion.longitudeDelta > 0
      ? Math.abs(newRegion.longitudeDelta) : defaultRegion.longitudeDelta;

    setRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    });
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

  const simplifyPath = (points) => {
    if (!points || points.length === 0) return [];
    const simplified = [points[0]];
    const threshold = 0.0001; // ~11m
    for (let i = 1; i < points.length; i++) {
      const prev = simplified[simplified.length - 1];
      const cur = points[i];
      const dLat = Math.abs(cur.latitude - prev.latitude);
      const dLng = Math.abs(cur.longitude - prev.longitude);
      if (dLat > threshold || dLng > threshold) {
        simplified.push(cur);
      }
    }
    // Always ensure the final point from the original series is present
    const lastOriginal = points[points.length - 1];
    const lastSimplified = simplified[simplified.length - 1];
    const endTooClose = Math.abs(lastOriginal.latitude - lastSimplified.latitude) < 1e-7 &&
      Math.abs(lastOriginal.longitude - lastSimplified.longitude) < 1e-7;
    if (!endTooClose) {
      simplified.push(lastOriginal);
    }
    return simplified;
  };

  const fitMapToPath = (points) => {
    if (!mapRef.current || !points || points.length === 0) return;
    try {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    } catch { }
  };

  const handleTrack = async () => {
    try {
      if (!startDate || !endDate) {
        Alert.alert(
          t('timeline.alerts.errorTitle', 'Error'),
          t('timeline.alerts.missingDates', 'Please select start and end dates')
        );
        return;
      }
      // Include userId if available so backend can filter
      let userId = undefined;
      try {
        const currentUserData = await AsyncStorage.getItem('currentUser');
        if (currentUserData) {
          const user = JSON.parse(currentUserData);
          if (user && user.id) userId = user.id;
        }
      } catch { }

      const items = await apiService.getLocationsInRange({ startDate, endDate, userId });
      const path = (items || [])
        .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude) && !isNaN(p.longitude))
        .map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));
      if (path.length > 0) {
        const clean = simplifyPath(path);
        setCoords(clean);
        if (clean.length === 1) {
          const p = clean[0];
          if (isFinite(p.latitude) && isFinite(p.longitude)) {
            setRegionSafely({ latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 });
          }
        } else {
          fitMapToPath(clean);
        }
      } else {
        // Fallback to locally persisted location history (from background service)
        let localPath = [];
        try {
          const raw = await AsyncStorage.getItem('local_location_history');
          const arr = raw ? JSON.parse(raw) : [];
          const inRange = arr.filter(p => {
            const t = new Date(p.timestamp).toISOString().slice(0, 10);
            return (!userId || p.userId === userId) && t >= startDate && t <= endDate;
          });
          localPath = inRange.map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));
        } catch { }

        if (localPath.length > 0) {
          const clean = simplifyPath(localPath);
          setCoords(clean);
          if (clean.length === 1) {
            const p = clean[0];
            if (isFinite(p.latitude) && isFinite(p.longitude)) {
              setRegionSafely({ latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 });
            }
          } else {
            fitMapToPath(clean);
          }
        } else {
          // Final fallback: last known user coords
          let fallbackPoint = null;
          try {
            const currentUserData = await AsyncStorage.getItem('currentUser');
            if (currentUserData) {
              const user = JSON.parse(currentUserData);
              if (typeof user?.latitude === 'number' && typeof user?.longitude === 'number' && !isNaN(user.latitude) && !isNaN(user.longitude)) {
                fallbackPoint = { latitude: Number(user.latitude), longitude: Number(user.longitude) };
              }
            }
          } catch { }

          if (fallbackPoint && isFinite(fallbackPoint.latitude) && isFinite(fallbackPoint.longitude)) {
            setCoords([fallbackPoint]);
            setRegionSafely({ latitude: fallbackPoint.latitude, longitude: fallbackPoint.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 });
          } else {
            Alert.alert(
              t('timeline.alerts.infoTitle', 'Info'),
              t('timeline.alerts.noTrack', 'No track points in this range')
            );
            setCoords([]);
          }
        }
      }
    } catch (e) {
      Alert.alert(
        t('timeline.alerts.errorTitle', 'Error'),
        t('timeline.alerts.loadFailed', 'Failed to load track')
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ padding: 16 }}>
        <Text style={styles.label}>{t('timeline.labels.startDate', 'Start Date')}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
          <Text style={[styles.dateText, !startDate && styles.datePlaceholder]}>
            {startDate || t('timeline.placeholders.startDate', 'Select start date')}
          </Text>
        </TouchableOpacity>
        {showStartPicker && (
          <DateTimePicker
            value={startDate ? new Date(startDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            themeVariant="light"
            accentColor={green.primary}
            is24Hour={false}
            onChange={(event, date) => {
              setShowStartPicker(false);
              if (event?.type === 'set' && date) {
                const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 10);
                setStartDate(localISO);
              }
            }}
          />
        )}

        <Text style={styles.label}>{t('timeline.labels.endDate', 'End Date')}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
          <Text style={[styles.dateText, !endDate && styles.datePlaceholder]}>
            {endDate || t('timeline.placeholders.endDate', 'Select end date')}
          </Text>
        </TouchableOpacity>
        {showEndPicker && (
          <DateTimePicker
            value={endDate ? new Date(endDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            themeVariant="light"
            accentColor={green.primary}
            is24Hour={false}
            onChange={(event, date) => {
              setShowEndPicker(false);
              if (event?.type === 'set' && date) {
                const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 10);
                setEndDate(localISO);
              }
            }}
          />
        )}

        <TouchableOpacity style={styles.trackButton} onPress={handleTrack}>
          <Text style={styles.trackText}>{t('timeline.buttons.track', 'Track')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.mapWrapper}>
        <LeafletMap
          region={getValidRegion()}
          markers={(() => {
            if (coords.length === 0) return [];
            const start = coords[0];
            const end = coords[coords.length - 1];
            const same = Math.abs(start.latitude - end.latitude) < 1e-7 && Math.abs(start.longitude - end.longitude) < 1e-7;
            if (same) {
              return [{
                latitude: start.latitude,
                longitude: start.longitude,
                title: t('timeline.markers.startEnd', 'Start / End')
              }];
            }
            return [
              { latitude: start.latitude, longitude: start.longitude, title: t('timeline.markers.start', 'Start') },
              { latitude: end.latitude, longitude: end.longitude, title: t('timeline.markers.end', 'End') }
            ];
          })()}
          polylines={coords.length > 1 ? [{
            coordinates: coords,
            strokeWidth: 5,
            strokeColor: "#2563EB"
          }] : []}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginBottom: 6, color: '#222' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', marginBottom: 12 },
  trackButton: { backgroundColor: '#2E3192', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  trackText: { color: '#fff', fontWeight: 'bold' },
  mapWrapper: { height: 350, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  map: { flex: 1 },
});


