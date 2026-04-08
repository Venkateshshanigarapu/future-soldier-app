import React, { useState, useLayoutEffect, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, SafeAreaView, ActivityIndicator, Image, TextInput, FlatList, Alert } from 'react-native';
import { Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useNotifications } from '../NotificationContext';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function DashboardScreen({ navigation, route }) {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [soldierVitals, setSoldierVitals] = useState(null);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [soldierGpsStatus, setSoldierGpsStatus] = useState({});
  const [soldierZoneStatus, setSoldierZoneStatus] = useState({});
  const [soldiers, setSoldiers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalSoldiers: 0,
    activeSoldiers: 0,
    offlineSoldiers: 0,
  });
  const [operationalZones, setOperationalZones] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSoldiers, setActiveSoldiers] = useState([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineError, setOfflineError] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  // Mission Analytics UI state
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(false);
  const [analyticsMode, setAnalyticsMode] = useState('active'); // 'active' | 'completed'
  const [analyticsFilter, setAnalyticsFilter] = useState('week'); // 'today' | 'week' | 'month' | 'custom'
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [customRangeVisible, setCustomRangeVisible] = useState(false);
  const [customFromDate, setCustomFromDate] = useState(null); // Date
  const [customToDate, setCustomToDate] = useState(null); // Date
  const [calendarMonth, setCalendarMonth] = useState(() => new Date()); // current displayed month

  const [lastUpdated, setLastUpdated] = useState(null);
  const [soldierStatusFilter, setSoldierStatusFilter] = useState('all'); // all | active | offline | critical
  const [soldierSearch, setSoldierSearch] = useState('');

  const filteredSoldiers = useMemo(() => {
    const query = soldierSearch.trim().toLowerCase();
    return (soldiers || [])
      .filter(s => {
        if (soldierStatusFilter === 'all') return true;
        const st = String(s.status || '').toLowerCase();
        if (soldierStatusFilter === 'active') return st === 'active';
        if (soldierStatusFilter === 'offline') return st === 'offline';
        if (soldierStatusFilter === 'critical') return st === 'critical';
        return true;
      })
      .filter(s => {
        if (!query) return true;
        const name = String(s.name || '').toLowerCase();
        const idStr = String(s.username || s.id || '').toLowerCase();
        return name.includes(query) || idStr.includes(query);
      });
  }, [soldiers, soldierStatusFilter, soldierSearch]);

  const onRefreshDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const [notifications, alerts] = await Promise.all([
        apiService.getNotifications(),
        apiService.getAlerts(),
      ]);
      if (currentUser && currentUser.role === 'commander' && currentUser.id) {
        let unitSoldiers = [];

        // Use commander_id method first (handles mapping tables)
        try {
          unitSoldiers = await apiService.getSoldiersByCommanderId(currentUser.id);

          // Transform soldier-overview response to match expected format
          if (unitSoldiers && unitSoldiers.length > 0) {
            unitSoldiers = unitSoldiers.map(s => ({
              ...s,
              latitude: s.location?.latitude || s.latitude,
              longitude: s.location?.longitude || s.longitude,
              status: s.status || (s.health?.status) || 'offline',
              photo: s.photo,
            }));
          }

          if (!unitSoldiers || unitSoldiers.length === 0) {
            // Fallback methods
            if (currentUser.unit_id) {
              unitSoldiers = await apiService.getSoldiersByUnitId(currentUser.unit_id, 'name');
            } else if (currentUser.unit) {
              unitSoldiers = await apiService.getSoldiersByUnit(currentUser.unit);
            }
          }
        } catch (err) {
          console.error('[DashboardScreen] Error in refresh, using fallback:', err);
          if (currentUser.unit) {
            unitSoldiers = await apiService.getSoldiersByUnit(currentUser.unit);
          }
        }

        setSoldiers(Array.isArray(unitSoldiers) ? unitSoldiers : []);
        const total = unitSoldiers.length;
        const active = unitSoldiers.filter(s => String(s.status || '').toLowerCase() === 'active').length;
        const offline = unitSoldiers.filter(s => String(s.status || '').toLowerCase() === 'offline').length;
        setDashboardStats({ totalSoldiers: total, activeSoldiers: active, offlineSoldiers: offline });
        const recent = (notifications || [])
          .slice()
          .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
          .slice(0, 10);
        setRecentAlerts(recent);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error('[DashboardScreen] Error refreshing dashboard:', e);
      setError('Failed to refresh.');
    } finally {
      setLoading(false);
    }
  };

  // Notifications context
  const { addNotification, notifications } = useNotifications();

  // Use global header from TabNavigator; do not override here (keeps bell + menu drawer)

  // Handle soldier selection for viewing details
  const handleSoldierSelect = async (soldier) => {
    setSelectedSoldier(soldier);
    setModalVisible(true);

    // Fetch soldier vitals
    if (soldier.id || soldier.username) {
      setVitalsLoading(true);
      try {
        const soldierId = soldier.id || soldier.username;
        console.log('[DashboardScreen] Fetching vitals for soldier:', soldierId);
        const vitals = await apiService.getHealthVitals(soldierId);
        console.log('[DashboardScreen] Full vitals response:', JSON.stringify(vitals, null, 2));
        console.log('[DashboardScreen] Heart rate from API:', vitals?.heart_rate);
        console.log('[DashboardScreen] Temperature from API:', vitals?.temperature);
        setSoldierVitals(vitals);
      } catch (error) {
        console.error('[DashboardScreen] Error fetching vitals:', error);
        setSoldierVitals(null);
      } finally {
        setVitalsLoading(false);
      }
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4CAF50'; // Green
      case 'warning':
        return '#FF9800'; // Orange
      case 'critical':
        return '#F44336'; // Red
      default:
        return '#757575'; // Gray
    }
  };

  // Get online status icon
  const getOnlineStatusIcon = (isOnline) => {
    return isOnline ?
      <Icon name="checkmark-circle" size={16} color="#4CAF50" /> :
      <Icon name="close-circle" size={16} color="#F44336" />;
  };

  // Fetch current user from AsyncStorage
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          // If commander doesn't have unit_id, try to fetch full user data from API
          if (user.role === 'commander' && !user.unit_id && user.id) {
            try {
              console.log('[DashboardScreen] Fetching full user data to get unit_id');
              const fullUser = await apiService.getUserByUsername(user.username);
              if (fullUser && fullUser.unit_id) {
                // Update stored user with unit_id, preventing large image payloads
                const updatedUser = { ...user, unit_id: fullUser.unit_id };
                const userToSave = { ...updatedUser };
                delete userToSave.photo;
                delete userToSave.profileImage;
                await AsyncStorage.setItem('currentUser', JSON.stringify(userToSave));
                setCurrentUser(updatedUser);
                console.log('[DashboardScreen] Updated user with unit_id:', fullUser.unit_id);
                return;
              }
            } catch (err) {
              console.error('[DashboardScreen] Error fetching full user data:', err);
            }
          }
          setCurrentUser(user);
        }
      } catch (e) {
        console.error('[DashboardScreen] Error loading user:', e);
      }
    };
    loadUser();
  }, []);

  // Real-time data fetching for Commander Dashboard
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const notifications = await apiService.getNotifications();
        if (currentUser && currentUser.role === 'commander' && currentUser.id) {
          console.log('[DashboardScreen] Current user:', {
            id: currentUser.id,
            role: currentUser.role,
            unit: currentUser.unit,
            unit_id: currentUser.unit_id
          });

          let unitSoldiers = [];

          // Use commander_id to fetch soldiers (handles mapping tables properly)
          try {
            console.log('[DashboardScreen] Fetching soldiers by commander_id:', currentUser.id);
            unitSoldiers = await apiService.getSoldiersByCommanderId(currentUser.id);
            console.log('[DashboardScreen] Fetched soldiers by commander_id:', unitSoldiers?.length || 0, 'soldiers');

            // Transform response if needed (backend now returns flat structure)
            if (unitSoldiers && unitSoldiers.length > 0) {
              unitSoldiers = unitSoldiers.map(s => ({
                ...s,
                latitude: s.latitude || s.location?.latitude || null,
                longitude: s.longitude || s.location?.longitude || null,
                status: s.status || 'offline',
              }));
            }

            // If no soldiers found via commander_id, try fallback methods
            if (!unitSoldiers || unitSoldiers.length === 0) {
              console.log('[DashboardScreen] No soldiers via commander_id, trying fallback methods...');

              if (currentUser.unit_id) {
                console.log('[DashboardScreen] Fallback: Fetching soldiers by unit_id:', currentUser.unit_id);
                try {
                  unitSoldiers = await apiService.getSoldiersByUnitId(currentUser.unit_id, 'name');
                  console.log('[DashboardScreen] Fetched soldiers by unit_id:', unitSoldiers?.length || 0);
                } catch (e) {
                  console.error('[DashboardScreen] Error fetching by unit_id:', e);
                }
              }

              if ((!unitSoldiers || unitSoldiers.length === 0) && currentUser.unit) {
                console.log('[DashboardScreen] Fallback: Fetching soldiers by unit name:', currentUser.unit);
                try {
                  unitSoldiers = await apiService.getSoldiersByUnit(currentUser.unit);
                  console.log('[DashboardScreen] Fetched soldiers by unit name:', unitSoldiers?.length || 0);
                } catch (e) {
                  console.error('[DashboardScreen] Error fetching by unit name:', e);
                }
              }
            }
          } catch (err) {
            console.error('[DashboardScreen] Error fetching soldiers by commander_id:', err);
            console.error('[DashboardScreen] Error details:', err.message, err.stack);
            // Fallback to unit name if commander_id method fails
            if (currentUser.unit) {
              console.log('[DashboardScreen] Fallback: Fetching soldiers by unit name:', currentUser.unit);
              try {
                unitSoldiers = await apiService.getSoldiersByUnit(currentUser.unit);
                console.log('[DashboardScreen] Fallback fetched:', unitSoldiers?.length || 0, 'soldiers');
              } catch (fallbackErr) {
                console.error('[DashboardScreen] Fallback also failed:', fallbackErr);
                unitSoldiers = [];
              }
            } else {
              unitSoldiers = [];
            }
          }

          console.log('[DashboardScreen] Final soldiers count:', unitSoldiers?.length || 0);
          setSoldiers(Array.isArray(unitSoldiers) ? unitSoldiers : []);

          // Dashboard stats
          const total = unitSoldiers.length;
          const active = unitSoldiers.filter(s => s.status && s.status.toLowerCase() === 'active').length;
          const offline = unitSoldiers.filter(s => s.status && s.status.toLowerCase() === 'offline').length;
          setDashboardStats({
            totalSoldiers: total,
            activeSoldiers: active,
            offlineSoldiers: offline,
          });

          // Recent alerts: show last two from notifications (no soldierId filter, which may be absent)
          const recent = (notifications || [])
            .slice()
            .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
            .slice(0, 2);
          if (recent.length > 0) setRecentAlerts(recent);
        }
      } catch (e) {
        console.error('[DashboardScreen] Error fetching dashboard data:', e);
      }
    };
    if (currentUser && currentUser.role === 'commander' && currentUser.id) {
      fetchDashboardData();
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchSoldiers = async () => {
      if (!currentUser || currentUser.role !== 'commander') {
        console.log('[DashboardScreen] Not a commander or no currentUser');
        return;
      }
      if (!currentUser.id) {
        console.warn('[DashboardScreen] Commander has no id');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        let soldiers = [];
        // Use commander_id method first (handles mapping tables)
        try {
          console.log('[DashboardScreen] Fetching soldiers by commander_id:', currentUser.id);
          soldiers = await apiService.getSoldiersByCommanderId(currentUser.id);
          console.log('[DashboardScreen] Fetched', soldiers?.length || 0, 'soldiers by commander_id');

          // Transform soldier-overview response to match expected format
          if (soldiers && soldiers.length > 0) {
            soldiers = soldiers.map(s => ({
              ...s,
              latitude: s.location?.latitude || s.latitude,
              longitude: s.location?.longitude || s.longitude,
              status: s.status || (s.health?.status) || 'offline',
              photo: s.photo,
            }));
          }

          // Fallback if no results
          if (!soldiers || soldiers.length === 0) {
            if (currentUser.unit_id) {
              console.log('[DashboardScreen] Fallback: Fetching by unit_id:', currentUser.unit_id);
              soldiers = await apiService.getSoldiersByUnitId(currentUser.unit_id, 'name');
            } else if (currentUser.unit) {
              console.log('[DashboardScreen] Fallback: Fetching by unit name:', currentUser.unit);
              soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
            }
          }
        } catch (err) {
          console.error('[DashboardScreen] Error fetching by commander_id, using fallback:', err);
          if (currentUser.unit) {
            soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
          }
        }
        setSoldiers(Array.isArray(soldiers) ? soldiers : []);
      } catch (err) {
        console.error('[DashboardScreen] Error fetching soldiers:', err);
        setError('Failed to fetch soldiers.');
      } finally {
        setLoading(false);
      }
    };
    fetchSoldiers();
  }, [currentUser]);

  useEffect(() => {
    const fetchActiveSoldiers = async () => {
      if (!currentUser || currentUser.role !== 'commander' || !currentUser.id) return;

      setActiveLoading(true);
      setActiveError(null);
      try {
        let soldiers = [];
        // Use commander_id method first
        try {
          soldiers = await apiService.getSoldiersByCommanderId(currentUser.id);
          if (!soldiers || soldiers.length === 0) {
            if (currentUser.unit_id) {
              soldiers = await apiService.getSoldiersByUnitId(currentUser.unit_id, 'name');
            } else if (currentUser.unit) {
              soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
            }
          }
        } catch (err) {
          if (currentUser.unit) {
            soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
          }
        }
        // Filter for active soldiers
        const active = (soldiers || []).filter(s =>
          (String(s.status || '').toLowerCase() === 'active') ||
          (typeof s.isOnline === 'boolean' && s.isOnline === true)
        );
        setActiveSoldiers(active);
      } catch (err) {
        console.error('[DashboardScreen] Error fetching active soldiers:', err);
        setActiveError('Failed to fetch active soldiers.');
      } finally {
        setActiveLoading(false);
      }
    };
    fetchActiveSoldiers();
  }, [currentUser]);

  useEffect(() => {
    const fetchOfflineSoldiers = async () => {
      if (!currentUser || currentUser.role !== 'commander' || !currentUser.id) return;

      setOfflineLoading(true);
      setOfflineError(null);
      try {
        let soldiers = [];
        // Use commander_id method first
        try {
          soldiers = await apiService.getSoldiersByCommanderId(currentUser.id);
          if (!soldiers || soldiers.length === 0) {
            if (currentUser.unit_id) {
              soldiers = await apiService.getSoldiersByUnitId(currentUser.unit_id, 'name');
            } else if (currentUser.unit) {
              soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
            }
          }
        } catch (err) {
          if (currentUser.unit) {
            soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
          }
        }
        // Filter for offline soldiers (status === 'offline' or isOnline === false)
        const offline = (soldiers || []).filter(s =>
          (s.status && s.status.toLowerCase() === 'offline') ||
          (typeof s.isOnline === 'boolean' && s.isOnline === false)
        );
        setOfflineCount(offline.length);
      } catch (err) {
        console.error('[DashboardScreen] Error fetching offline soldiers:', err);
        setOfflineError('Failed to fetch offline soldiers.');
      } finally {
        setOfflineLoading(false);
      }
    };
    fetchOfflineSoldiers();
  }, [currentUser]);


  // Derived data for Mission Analytics (simple synthetic trend using counts for stable visuals)
  const analyticsData = useMemo(() => {
    // Generate deterministic pseudo-trend based on counts so it looks stable across renders
    const base = Math.max(1, soldiers.length);
    let len = analyticsFilter === 'today' ? 8 : analyticsFilter === 'week' ? 7 : 12; // hours/ days/ months
    if (analyticsFilter === 'custom' && customFromDate && customToDate) {
      // More reliable date calculation
      const start = new Date(customFromDate);
      const end = new Date(customToDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const timeDiff = end.getTime() - start.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
      const days = Math.min(90, Math.max(1, daysDiff)); // cap to 90 for performance, min 1

      // If same-day custom range, use hourly like Today for better visibility
      len = days <= 1 ? 8 : days;

      console.log('Custom range calculation:', {
        customFromDate,
        customToDate,
        start: start.toDateString(),
        end: end.toDateString(),
        timeDiff,
        daysDiff,
        days,
        len,
        manualCalc: Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
      });
    }

    // Generate data points for the selected range
    const arr = Array.from({ length: len }).map((_, idx) => {
      const factor = (idx + 1) / len;
      // More realistic data distribution based on actual soldier count
      const activeVal = Math.round(base * (0.3 + 0.4 * Math.sin((idx + 1) * 1.3)) * factor);
      const completedVal = Math.round(base * (0.2 + 0.3 * Math.cos((idx + 1) * 1.1)) * factor);
      return {
        x: idx,
        active: Math.max(0, activeVal),
        completed: Math.max(0, completedVal),
        // Add timestamp for custom ranges
        timestamp: analyticsFilter === 'custom' && customFromDate ?
          new Date(customFromDate.getTime() + (idx * (1000 * 60 * 60 * 24))) : null
      };
    });

    if (analyticsFilter === 'custom') {
      console.log('Generated analytics data:', {
        filter: analyticsFilter,
        fromDate: customFromDate,
        toDate: customToDate,
        dataLength: arr.length,
        firstDataPoint: arr[0],
        lastDataPoint: arr[arr.length - 1],
        allDataPoints: arr.map((d, i) => ({ i, active: d.active, completed: d.completed }))
      });
    }

    return arr;
  }, [soldiers.length, analyticsFilter, customFromDate, customToDate]);

  // Simple color helpers
  const getSeverityColor = (severity) => {
    switch ((severity || '').toLowerCase()) {
      case 'critical': return '#F44336';
      case 'high':
      case 'warning': return '#FF9800';
      case 'medium':
      case 'info':
      default: return '#2196F3';
    }
  };

  const computeChartWidth = (pointCount) => Math.max(400, pointCount * 40);
  const computeLabelsWidth = (labelCount) => Math.max(400, labelCount * 60);

  // Tiny LineChart with pure Views (no external libs) + tooltip on tap
  const LineChart = ({ data, labels = [], color = '#2E3192', height = 140, padding = 12 }) => {
    const [selectedIndex, setSelectedIndex] = useState(null);
    const values = data.map(d => (analyticsMode === 'active' ? d.active : d.completed));
    const maxY = Math.max(1, ...values);
    const width = computeChartWidth(data.length); // unified width calc with x-axis labels
    const points = data.map((d, i) => {
      const yVal = values[i];
      const x = padding + (i * (width - padding * 2)) / Math.max(1, data.length - 1);
      const y = padding + (height - padding * 2) * (1 - yVal / maxY);
      return { x, y };
    });

    console.log('LineChart rendering:', {
      dataLength: data.length,
      width,
      pointsLength: points.length,
      firstPoint: points[0],
      lastPoint: points[points.length - 1],
      allPoints: points.map((p, i) => ({ i, x: p.x, y: p.y })),
      chartWidth: width,
      expectedWidth: data.length * 40
    });
    const tooltip = (() => {
      if (selectedIndex == null) return null;
      const p = points[selectedIndex];
      if (!p) return null;
      const val = values[selectedIndex];
      const label = labels[selectedIndex] || `#${selectedIndex + 1}`;
      const tipWidth = 120;
      const left = Math.min(Math.max(p.x + 8, 0), Math.max(0, width - tipWidth));
      const top = Math.max(p.y - 48, 4);
      return (
        <View style={{ position: 'absolute', left, top, width: tipWidth, backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6 }}>
          <Text style={{ fontWeight: '700', color: '#2E3192' }}>{label}</Text>
          <Text style={{ color: '#333' }}>{`missions: ${val}`}</Text>
        </View>
      );
    })();
    return (
      <View style={{ height, width, position: 'relative' }}>
        {[0.25, 0.5, 0.75].map((g, idx) => (
          <View key={idx} style={{ position: 'absolute', left: 0, right: 0, top: padding + (height - padding * 2) * g, height: 1, backgroundColor: '#eee' }} />
        ))}
        {selectedIndex != null && points[selectedIndex] && (
          <View style={{ position: 'absolute', left: points[selectedIndex].x, top: padding, width: 1, height: height - padding * 2, backgroundColor: '#e0e0e0' }} />
        )}
        {points.map((p, i) => {
          if (i === 0) return null; // Skip first point for line segments
          const prev = points[i - 1];
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (p.x + prev.x) / 2 - len / 2;
          const midY = (p.y + prev.y) / 2 - 1;
          return (
            <View
              key={`seg-${i}`}
              style={{ position: 'absolute', left: midX, top: midY, width: len, height: 3, backgroundColor: color, transform: [{ rotate: `${angle}deg` }], borderRadius: 3, opacity: 0.9 }}
            />
          );
        })}
        {points.map((p, i) => (
          <TouchableOpacity key={`pt-${i}`} activeOpacity={0.7} onPress={() => setSelectedIndex(i)} style={{ position: 'absolute', left: p.x - 6, top: p.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: color }} />
        ))}
        {tooltip}
      </View>
    );
  };

  // Calendar Range Picker (simple, APK-safe)
  const CalendarRangePicker = () => {
    // Build days grid for calendarMonth
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 7) % 7; // 0=Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

    const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const isInRange = (d) => {
      if (!d || !customFromDate || !customToDate) return false;
      const t = d.setHours(0, 0, 0, 0);
      const s = new Date(customFromDate).setHours(0, 0, 0, 0);
      const e = new Date(customToDate).setHours(0, 0, 0, 0);
      return t >= s && t <= e;
    };

    const onSelectDay = (d) => {
      if (!d) return;
      if (!customFromDate || (customFromDate && customToDate)) {
        // Start new selection
        setCustomFromDate(d);
        setCustomToDate(null);
      } else {
        // Complete the range selection
        if (d < customFromDate) {
          setCustomToDate(customFromDate);
          setCustomFromDate(d);
        } else {
          setCustomToDate(d);
        }
      }
    };

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeaderRow}>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))} style={styles.calendarNavBtn}>
            <Icon name="chevron-back" size={18} color="#2E3192" />
          </TouchableOpacity>
          <Text style={styles.calendarHeaderText}>
            {new Date(year, month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))} style={styles.calendarNavBtn}>
            <Icon name="chevron-forward" size={18} color="#2E3192" />
          </TouchableOpacity>
        </View>
        <View style={styles.calendarWeekRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
            <Text key={w} style={styles.calendarWeekLabel}>{w}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {days.map((d, idx) => {
            const selectedStart = isSameDay(d, customFromDate);
            const selectedEnd = isSameDay(d, customToDate);
            const inRange = isInRange(d);
            return (
              <TouchableOpacity key={idx} style={[styles.calendarCell, (selectedStart || selectedEnd) && styles.calendarCellSelected, inRange && styles.calendarCellInRange]} onPress={() => onSelectDay(d)} disabled={!d}>
                <Text style={[styles.calendarCellText, (selectedStart || selectedEnd) && styles.calendarCellTextSelected]}>{d ? d.getDate() : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.calendarFooter}>
          <Text style={styles.calendarRangeText}>
            {customFromDate ? customFromDate.toDateString() : i18n.t('startLabel')}
            {'  —  '}
            {customToDate ? customToDate.toDateString() : i18n.t('endLabel')}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.filterCancel, { marginRight: 10 }]} onPress={() => { setCustomRangeVisible(false); }}>
              <Text style={styles.filterCancelText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#2E3192' }]} onPress={() => {
              if (!customFromDate || !customToDate) {
                Alert.alert(i18n.t('selectionRequired'), i18n.t('selectStartEndDates'));
                return;
              }
              setAnalyticsFilter('custom');
              setCustomRangeVisible(false);
              // Force data refresh by updating a dependency
              setLastUpdated(new Date());
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>{i18n.t('apply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };


  // Fetch last two alerts immediately on mount (API), then keep in sync with notifications context
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const alerts = await apiService.getAlerts();
        const sorted = (alerts || [])
          .slice()
          .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
          .slice(0, 2);
        if (isMounted) setRecentAlerts(sorted);
      } catch {
        if (isMounted) setRecentAlerts([]);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // When NotificationContext updates, reflect the latest two items as well
  useEffect(() => {
    try {
      const sorted = (notifications || [])
        .slice()
        .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
        .slice(0, 2);
      if (sorted.length > 0) setRecentAlerts(sorted);
    } catch { }
  }, [notifications]);

  // Analytics helpers
  const getAnalyticsFilterLabel = (key) => {
    switch (key) {
      case 'today':
        return i18n.t('todayLabel');
      case 'week':
        return i18n.t('thisWeekLabel');
      case 'month':
        return i18n.t('thisMonthLabel');
      case 'custom':
        return i18n.t('customRangeLabel');
      default:
        return '';
    }
  };

  const analyticsBasisText = useMemo(() => {
    const modeText = analyticsMode === 'active' ? i18n.t('activeMissions') : i18n.t('completedMissions');
    switch (analyticsFilter) {
      case 'today':
        return `${modeText} ${i18n.t('analyticsSuffixToday')}`;
      case 'week':
        return `${modeText} ${i18n.t('analyticsSuffixWeek')}`;
      case 'month':
        return `${modeText} ${i18n.t('analyticsSuffixMonth')}`;
      case 'custom':
        return `${modeText} ${i18n.t('analyticsSuffixCustom')}`;
      default:
        return modeText;
    }
  }, [analyticsMode, analyticsFilter, currentLanguage]);

  const axisDimension = useMemo(() => {
    switch (analyticsFilter) {
      case 'today':
        return i18n.t('dimensionHours');
      case 'week':
        return i18n.t('dimensionDays');
      case 'month':
        return i18n.t('dimensionMonths');
      default:
        return i18n.t('dimensionDays');
    }
  }, [analyticsFilter, currentLanguage]);

  const getSoldierStatusLabel = useCallback((status) => {
    const normalized = String(status || '').toLowerCase();
    switch (normalized) {
      case 'active':
        return i18n.t('statusValue.active');
      case 'offline':
        return i18n.t('statusValue.offline');
      case 'critical':
        return i18n.t('statusValue.critical');
      case 'inactive':
        return i18n.t('inactive');
      case 'maintenance':
        return i18n.t('maintenance');
      default:
        return status ? status.toString() : i18n.t('unknown');
    }
  }, [currentLanguage]);

  const xAxisLabels = useMemo(() => {
    const len = analyticsData.length;
    if (analyticsFilter === 'week') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, len);
    }
    if (analyticsFilter === 'month') {
      const base = new Date();
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(base.getFullYear(), base.getMonth() - (len - 1 - i), 1);
        return d.toLocaleString(undefined, { month: 'short' });
      });
    }
    const now = new Date();
    if (analyticsFilter === 'today') {
      // Last len hours ending now, label as HH:00
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(now);
        d.setHours(now.getHours() - (len - 1 - i), 0, 0, 0);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      });
    }
    // custom
    if (customFromDate && customToDate) {
      const start = new Date(customFromDate);
      const end = new Date(customToDate);
      const sameDay = start.toDateString() === end.toDateString();
      if (sameDay) {
        // Use hourly labels for same-day custom
        return Array.from({ length: len }).map((_, i) => {
          const d = new Date(start);
          d.setHours(start.getHours() + i, 0, 0, 0);
          return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        });
      }
      // Multi-day: label by date (strictly match analyticsData length)
      const labels = Array.from({ length: analyticsData.length }).map((_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      });
      try {
        console.log('xAxisLabels(custom)', { len, labelsLen: labels.length, first: labels[0], last: labels[labels.length - 1] });
      } catch { }
      return labels;
    }
    return Array.from({ length: len }).map((_, i) => `D${i + 1}`);
  }, [analyticsData.length, analyticsFilter, customFromDate, customToDate]);

  // Detailed labels for tooltip
  const tooltipLabels = useMemo(() => {
    const len = analyticsData.length;
    const now = new Date();
    if (analyticsFilter === 'today') {
      // Last len hours ending now
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(now);
        d.setHours(now.getHours() - (len - 1 - i), 0, 0, 0);
        return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
      });
    }
    if (analyticsFilter === 'week') {
      // Start from Monday of current week
      const d0 = new Date(now);
      const day = (d0.getDay() + 6) % 7; // 0=Mon
      d0.setDate(d0.getDate() - day);
      d0.setHours(0, 0, 0, 0);
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(d0);
        d.setDate(d0.getDate() + i);
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      });
    }
    if (analyticsFilter === 'month') {
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (len - 1 - i), 1);
        return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      });
    }
    // custom: handle same-day as hourly, otherwise per-day
    if (customFromDate && customToDate) {
      const start = new Date(customFromDate);
      const end = new Date(customToDate);
      const sameDay = start.toDateString() === end.toDateString();
      if (sameDay) {
        return Array.from({ length: len }).map((_, i) => {
          const d = new Date(start);
          d.setHours(start.getHours() + i, 0, 0, 0);
          return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
        });
      }
      const s0 = new Date(start);
      s0.setHours(0, 0, 0, 0);
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(s0);
        d.setDate(s0.getDate() + i);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      });
    }
    return Array.from({ length: len }).map((_, i) => `D${i + 1}`);
  }, [analyticsData.length, analyticsFilter, customFromDate, customToDate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={[{ key: 'header' }]}
        keyExtractor={(item) => item.key}
        renderItem={() => null}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <>
            <Text style={[styles.header, { textAlign: 'center' }]}>{i18n.t('commanderDashboard')}</Text>
            {/* Section 1: Overview Cards - Horizontal scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
              <Card style={styles.statCard}>
                <Card.Content>
                  <View style={styles.cardContent}>
                    <Icon name="people" size={36} color="#4CAF50" />
                    <View>
                      <Text style={styles.cardTitle}>{i18n.t('totalSoldiers')}</Text>
                      {loading ? <ActivityIndicator size="small" color="#2E3192" /> : error ? <Text style={{ color: 'red' }}>{error}</Text> : <Text style={styles.cardValue}>{soldiers.length}</Text>}
                    </View>
                  </View>
                </Card.Content>
              </Card>
              <Card style={styles.statCard}>
                <Card.Content>
                  <View style={styles.cardContent}>
                    <Icon name="checkmark-circle" size={36} color="#2196F3" />
                    <View>
                      <Text style={styles.cardTitle}>{i18n.t('activeLabel')}</Text>
                      {activeLoading ? <ActivityIndicator size="small" color="#2E3192" /> : activeError ? <Text style={{ color: 'red' }}>{activeError}</Text> : <Text style={styles.cardValue}>{activeSoldiers.length}</Text>}
                    </View>
                  </View>
                </Card.Content>
              </Card>
              <Card style={styles.statCard}>
                <Card.Content>
                  <View style={styles.cardContent}>
                    <Icon name="remove-circle" size={36} color="#F44336" />
                    <View>
                      <Text style={styles.cardTitle}>{i18n.t('offlineLabel')}</Text>
                      {offlineLoading ? <ActivityIndicator size="small" color="#2E3192" /> : offlineError ? <Text style={{ color: 'red' }}>{offlineError}</Text> : <Text style={styles.cardValue}>{offlineCount}</Text>}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            </ScrollView>

            {/* Section 2: Mission Analytics */}
            <Card style={styles.analyticsCard}>
              <TouchableOpacity style={styles.analyticsHeader} onPress={() => setAnalyticsCollapsed(v => !v)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="analytics" size={18} color="#2E3192" style={{ marginRight: 8 }} />
                  <Text style={styles.analyticsTitle}>{i18n.t('missionAnalytics')}</Text>
                </View>
                <Icon name={analyticsCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#666" />
              </TouchableOpacity>
              {!analyticsCollapsed && (
                <Card.Content>
                  {/* Mode toggle */}
                  <View style={styles.toggleRow}>
                    <TouchableOpacity onPress={() => setAnalyticsMode('active')} style={[styles.toggleBtn, analyticsMode === 'active' && styles.toggleBtnActive]}>
                      <Text style={[styles.toggleText, analyticsMode === 'active' && styles.toggleTextActive]}>{i18n.t('activeLabel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAnalyticsMode('completed')} style={[styles.toggleBtn, analyticsMode === 'completed' && styles.toggleBtnActive]}>
                      <Text style={[styles.toggleText, analyticsMode === 'completed' && styles.toggleTextActive]}>{i18n.t('completed')}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterBtn}>
                      <Icon name="calendar" size={16} color="#2E3192" />
                      <Text style={styles.filterBtnText}>
                        {analyticsFilter === 'custom' && customFromDate && customToDate
                          ? `${customFromDate.toLocaleDateString()} - ${customToDate.toLocaleDateString()}`
                          : getAnalyticsFilterLabel(analyticsFilter)}
                      </Text>
                      <Icon name="chevron-down" size={14} color="#2E3192" />
                    </TouchableOpacity>
                  </View>
                  {/* Basis and legend */}
                  <View style={styles.legendRow}>
                    <View style={{ flex: 1, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f6f8ff', borderRadius: 8, borderWidth: 1, borderColor: '#e6e9ff' }}>
                      <Text style={[styles.analyticsSubtitle, { color: '#2E3192', fontWeight: '700', fontSize: 13 }]}>{analyticsBasisText}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                      <View style={[styles.legendDot, { backgroundColor: '#2E3192' }]} />
                      <Text style={styles.legendLabel}>{i18n.t('activeLabel')}</Text>
                      <View style={[styles.legendDot, { backgroundColor: '#4CAF50', marginLeft: 12 }]} />
                      <Text style={styles.legendLabel}>{i18n.t('completed')}</Text>
                    </View>
                  </View>
                  {/* Chart scroller */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={{ paddingVertical: 8 }}
                    style={{ maxHeight: 180 }}
                    scrollEnabled={true}
                  >
                    <LineChart data={analyticsData} labels={tooltipLabels} color={analyticsMode === 'active' ? '#2E3192' : '#4CAF50'} />
                  </ScrollView>
                  {/* X-axis labels (aligned 1:1 with data points) */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    {(() => {
                      const total = Math.max(1, analyticsData.length);
                      const width = computeChartWidth(total);
                      const cellWidth = width / total; // keep label cells aligned to chart points
                      return (
                        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6, width }}>
                          {xAxisLabels.map((lbl, i) => (
                            <View key={`xl-${i}`} style={{ width: cellWidth, alignItems: 'center' }}>
                              <View style={{ paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#fff', borderRadius: 6, borderWidth: 0.5, borderColor: '#e0e0e0', minWidth: 34, alignItems: 'center' }}>
                                {analyticsFilter === 'custom' && customFromDate && customToDate ? (
                                  <View style={{ alignItems: 'center' }}>
                                    {(() => {
                                      const d = new Date(customFromDate);
                                      d.setDate(d.getDate() + i);
                                      const day = d.getDate();
                                      const mon = d.toLocaleString(undefined, { month: 'short' });
                                      return (
                                        <>
                                          <Text style={{ fontSize: 11, color: '#222', fontWeight: '700', lineHeight: 14 }}>{day}</Text>
                                          <Text style={{ fontSize: 10, color: '#444', lineHeight: 12 }}>{mon}</Text>
                                        </>
                                      );
                                    })()}
                                  </View>
                                ) : (
                                  <Text style={[styles.axisLabel, { color: '#222', fontWeight: '600' }]}>
                                    {lbl}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </ScrollView>
                  <Text style={[styles.axisLabel, { paddingLeft: 12, opacity: 0.95, color: '#333', fontWeight: '600' }]}>{i18n.t('analyticsAxisLabel', { dimension: axisDimension })}</Text>
                </Card.Content>
              )}
            </Card>

            {/* Date Filter Modal */}
            <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.filterModalCard}>
                  <Text style={styles.filterTitle}>{i18n.t('selectDateRange')}</Text>
                  {['today', 'week', 'month', 'custom'].map(key => (
                    <TouchableOpacity key={key} style={styles.filterOption} onPress={() => {
                      if (key === 'custom') {
                        setFilterModalVisible(false);
                        setTimeout(() => setCustomRangeVisible(true), 100);
                      } else {
                        setAnalyticsFilter(key);
                        setFilterModalVisible(false);
                      }
                    }}>
                      <Text style={[styles.filterOptionText, analyticsFilter === key && styles.filterSelected]}>{getAnalyticsFilterLabel(key)}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.filterCancel} onPress={() => setFilterModalVisible(false)}>
                    <Text style={styles.filterCancelText}>{i18n.t('cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Custom Date Range Calendar Modal */}
            <Modal visible={customRangeVisible} transparent animationType="fade" onRequestClose={() => setCustomRangeVisible(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.calendarCard}>
                  <Text style={styles.filterTitle}>{i18n.t('selectCustomRange')}</Text>
                  <CalendarRangePicker />
                </View>
              </View>
            </Modal>

            {/* Section 3: Soldier List - Same Unit Only */}
            <Card style={styles.listCard}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.performanceTitle}>{i18n.t('unitSoldiers')}</Text>
                <Text style={{ color: '#000000', fontSize: 12 }}>{i18n.t('inUnitCount', { count: soldiers.length || 0 })}</Text>
              </View>
              <Card.Content>
                {soldiers.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: '#000000', marginVertical: 10 }}>{i18n.t('noSoldiersFound')}</Text>
                ) : (
                  <View>
                    {soldiers.map((item, idx) => {
                      const status = String(item.status || '').toLowerCase();
                      const dotColor = status === 'active' ? '#4CAF50' : status === 'offline' ? '#F44336' : '#FFC107';
                      const photoUri = item.photo?.startsWith('data:') ? item.photo : (item.photo ? `data:image/jpeg;base64,${item.photo}` : null);
                      const coordText = (typeof item.latitude === 'number' && typeof item.longitude === 'number') ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}` : i18n.t('unknownLocation');
                      return (
                        <View key={item.id?.toString() || item.username || String(idx)}>
                          <TouchableOpacity onPress={() => handleSoldierSelect(item)} style={styles.soldierRow}>
                            <View style={styles.avatarWrapper}>
                              {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.avatar} />
                              ) : (
                                <View style={[styles.avatar, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                                  <Icon name="person" size={18} color="#757575" />
                                </View>
                              )}
                              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.soldierNameRow}>{item.name || '-'}</Text>
                              <Text style={styles.soldierSubText}>{`${i18n.t('id')}: ${item.username || item.id || '-'}`}</Text>
                              <Text style={styles.soldierSubText}>{`${i18n.t('unit')}: ${item.unit || '-'}`}</Text>
                              <Text style={styles.soldierSubText}>{`${i18n.t('statusLabel')}: ${getSoldierStatusLabel(status)}`}</Text>
                            </View>
                            <Icon name="chevron-forward" size={18} color="#999" />
                          </TouchableOpacity>
                          {idx < soldiers.length - 1 && <View style={{ height: 1, backgroundColor: '#eee' }} />}
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card.Content>
            </Card>
            {/* Section 4: Recent Alerts */}
            <Card style={styles.activityCard}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                <Text style={styles.performanceTitle}>{i18n.t('recentAlerts')}</Text>
              </View>
              <Card.Content>
                {recentAlerts.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: '#757575', marginVertical: 10 }}>{i18n.t('noRecentAlerts')}</Text>
                ) : (
                  recentAlerts.map((alert, index) => (
                    <View key={index} style={styles.activityItem}>
                      <Icon name={alert.severity === 'critical' ? 'alert-circle' : alert.severity === 'warning' ? 'alert' : 'information-circle'} size={20} color={getSeverityColor(alert.severity)} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.activityText}>{alert.title || alert.type || 'Alert'}</Text>
                        <Text style={styles.activityMessage}>{alert.message}</Text>
                        <Text style={styles.activityTime}>{alert.timestamp || alert.created_at}</Text>
                      </View>
                    </View>
                  ))
                )}
                <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Notifications')}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <Icon name="chevron-forward" size={16} color="#2E3192" />
                </TouchableOpacity>
              </Card.Content>
            </Card>
          </>
        }
      />
      {/* Soldier Detail Modal remains unchanged */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedSoldier?.name}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {selectedSoldier && (
              <>
                {/* Profile Section */}
                <View style={styles.vitalSection}>
                  <Text style={styles.sectionTitle}>Soldier Profile</Text>
                  <View style={styles.profileGrid}>
                    <View style={styles.profileItem}>
                      <Text style={styles.profileLabel}>Name</Text>
                      <Text style={styles.profileValue}>{selectedSoldier.name || 'N/A'}</Text>
                    </View>
                    <View style={styles.profileItem}>
                      <Text style={styles.profileLabel}>Service ID</Text>
                      <Text style={styles.profileValue}>{selectedSoldier.username || selectedSoldier.id || 'N/A'}</Text>
                    </View>
                    <View style={styles.profileItem}>
                      <Text style={styles.profileLabel}>Rank</Text>
                      <Text style={styles.profileValue}>{selectedSoldier.rank || 'N/A'}</Text>
                    </View>
                    <View style={styles.profileItem}>
                      <Text style={styles.profileLabel}>Unit</Text>
                      <Text style={styles.profileValue}>{selectedSoldier.unit || 'N/A'}</Text>
                    </View>
                    <View style={styles.profileItem}>
                      <Text style={styles.profileLabel}>Status</Text>
                      <Text style={[styles.profileValue, { color: selectedSoldier.status === 'active' ? '#4CAF50' : '#F44336' }]}>
                        {selectedSoldier.status?.toUpperCase() || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.profileItem}>
                      <Text style={styles.profileLabel}>Role</Text>
                      <Text style={styles.profileValue}>{selectedSoldier.role?.toUpperCase() || 'N/A'}</Text>
                    </View>
                  </View>
                </View>

                {/* Vital Signs Section */}
                <View style={styles.vitalSection}>
                  <Text style={styles.sectionTitle}>Health Status</Text>
                  {vitalsLoading ? (
                    <ActivityIndicator size="small" color="#2E3192" />
                  ) : (
                    <View style={styles.vitalGrid}>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>Heart Rate</Text>
                        <Text style={styles.vitalValue}>{soldierVitals?.heart_rate || selectedSoldier.heart_rate || 'N/A'}</Text>
                      </View>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>Temperature</Text>
                        <Text style={styles.vitalValue}>{soldierVitals?.temperature || selectedSoldier.temperature || 'N/A'}</Text>
                      </View>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>Blood Pressure</Text>
                        <Text style={styles.vitalValue}>{soldierVitals?.blood_pressure || selectedSoldier.blood_pressure || 'N/A'}</Text>
                      </View>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>SpO2</Text>
                        <Text style={styles.vitalValue}>{soldierVitals?.spo2 || selectedSoldier.spo2 || 'N/A'}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Location Section */}
                <View style={styles.vitalSection}>
                  <Text style={styles.sectionTitle}>Location Details</Text>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationText}>
                      <Text style={styles.locationLabel}>Coordinates:</Text> {selectedSoldier.latitude?.toFixed(6) || 'N/A'}, {selectedSoldier.longitude?.toFixed(6) || 'N/A'}
                    </Text>
                    <Text style={styles.locationText}>
                      <Text style={styles.locationLabel}>Zone:</Text> {selectedSoldier.zone || selectedSoldier.zoneName || 'N/A'}
                    </Text>
                    <Text style={styles.locationText}>
                      <Text style={styles.locationLabel}>Last Update:</Text> {selectedSoldier.lastUpdate || selectedSoldier.last_active || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Action buttons removed as requested */}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  contentContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 15,
    textAlign: 'center',
    color: '#000000', // Black color for visibility
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f3ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshText: {
    color: '#2E3192',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  updatedText: {
    color: '#757575',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'right',
  },
  // Section 1: Horizontal stat cards
  horizontalCards: {
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  statCard: {
    width: 220,
    marginRight: 10,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    color: '#000000', // Black color for visibility
    marginLeft: 10,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#000000', // Black color for visibility
  },
  listCard: {
    marginBottom: 15,
    elevation: 3,
  },
  // Section 2: Mission Analytics
  analyticsCard: {
    marginBottom: 15,
    elevation: 3,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#fafafa',
  },
  toggleBtnActive: {
    backgroundColor: '#2E3192',
    borderColor: '#2E3192',
  },
  toggleText: {
    fontSize: 12,
    color: '#2E3192',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f3ff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterBtnText: {
    color: '#2E3192',
    fontWeight: '700',
    fontSize: 12,
    marginHorizontal: 6,
  },
  filterModalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '80%',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
    marginBottom: 10,
  },
  filterOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333',
  },
  filterSelected: {
    color: '#2E3192',
    fontWeight: 'bold',
  },
  filterCancel: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterCancelText: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 2,
    color: '#333',
  },
  soldierItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  // Section 4: Soldier List rows
  soldierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  statusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
  },
  soldierNameRow: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
  },
  soldierSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  soldierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  soldierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  soldierName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  survivalRate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  soldierDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  soldierDetail: {
    fontSize: 14,
    marginRight: 15,
    color: '#757575',
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#555',
  },
  activityCard: {
    marginBottom: 15,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  viewAllBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  viewAllText: {
    color: '#2E3192',
    fontWeight: 'bold',
    marginRight: 4,
  },
  activityText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  activityMessage: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 2,
  },
  activityTime: {
    color: '#757575',
    fontSize: 12,
  },
  // Analytics legend and labels
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  analyticsSubtitle: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  axisLabel: {
    fontSize: 11,
    color: '#9e9e9e',
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '92%',
    maxWidth: 420,
  },
  calendarContainer: {
    backgroundColor: '#fff',
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  calendarNavBtn: {
    padding: 6,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarWeekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#eee',
  },
  calendarCellSelected: {
    backgroundColor: '#2E3192',
  },
  calendarCellInRange: {
    backgroundColor: '#e8ecff',
  },
  calendarCellText: {
    color: '#333',
    fontWeight: '600',
  },
  calendarCellTextSelected: {
    color: '#fff',
  },
  calendarFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarRangeText: {
    color: '#333',
    fontSize: 12,
    flex: 1,
    marginRight: 10,
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  vitalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#555',
  },
  vitalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vitalItem: {
    width: '48%',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#757575',
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  locationInfo: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
  },
  locationText: {
    fontSize: 14,
    marginBottom: 5,
  },
  locationLabel: {
    fontWeight: 'bold',
    color: '#555',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#2E3192',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  profileItem: {
    width: '48%',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
  },
  profileLabel: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '600',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
    color: '#000000',
  },
  cardNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  }
}); 