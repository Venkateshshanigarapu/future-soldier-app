import React, { useState, useLayoutEffect, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, SafeAreaView, ActivityIndicator, Image, TextInput } from 'react-native';
import { Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/Ionicons';
import MenuIcon from './MenuIcon';
import * as Location from 'expo-location';
import { useNotifications } from '../NotificationContext';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../utils/i18n';

export default function DashboardScreen({ navigation, route }) {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [soldierGpsStatus, setSoldierGpsStatus] = useState({});
  const [soldierZoneStatus, setSoldierZoneStatus] = useState({});
  const [soldiers, setSoldiers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalSoldiers: 0,
    activeSoldiers: 0,
    offlineSoldiers: 0,
    criticalAlerts: 0,
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
  const [criticalAlertsCount, setCriticalAlertsCount] = useState(0);
  const [criticalAlertsLoading, setCriticalAlertsLoading] = useState(false);
  const [criticalAlertsError, setCriticalAlertsError] = useState(null);

  // Mission Analytics UI state
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(false);
  const [analyticsMode, setAnalyticsMode] = useState('active'); // 'active' | 'completed'
  const [analyticsFilter, setAnalyticsFilter] = useState('week'); // 'today' | 'week' | 'month' | 'custom'
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [customRangeVisible, setCustomRangeVisible] = useState(false);
  const [customFromDate, setCustomFromDate] = useState(null); // Date
  const [customToDate, setCustomToDate] = useState(null); // Date
  const [calendarMonth, setCalendarMonth] = useState(() => new Date()); // current displayed month

  // Squad Performance: no filter UI
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
      const [users, notifications, alerts] = await Promise.all([
        apiService.getAllUsers(),
        apiService.getNotifications(),
        apiService.getAlerts(),
      ]);
      if (currentUser && currentUser.unit) {
        const unitSoldiers = (users || []).filter(u => u.unit && u.role && u.unit.toLowerCase() === currentUser.unit.toLowerCase() && u.role.toLowerCase() === 'soldier');
        setSoldiers(unitSoldiers);
        const total = unitSoldiers.length;
        const active = unitSoldiers.filter(s => String(s.status || '').toLowerCase() === 'active').length;
        const offline = unitSoldiers.filter(s => String(s.status || '').toLowerCase() === 'offline').length;
        const critical = (alerts || []).filter(a => String(a.severity || '').toLowerCase() === 'critical').length;
        setDashboardStats({ totalSoldiers: total, activeSoldiers: active, offlineSoldiers: offline, criticalAlerts: critical });
        const recent = (notifications || [])
          .slice()
          .sort((a,b)=> new Date(b.timestamp||b.created_at) - new Date(a.timestamp||a.created_at))
          .slice(0,10);
        setRecentAlerts(recent);
      }
      setLastUpdated(new Date());
    } catch (e) {
      setError('Failed to refresh.');
    } finally {
      setLoading(false);
    }
  };
  
  // Notifications context
  const { addNotification, notifications } = useNotifications();
  
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
  
  // Handle soldier selection for viewing details
  const handleSoldierSelect = (soldier) => {
    setSelectedSoldier(soldier);
    setModalVisible(true);
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
        if (userData) setCurrentUser(JSON.parse(userData));
      } catch (e) {}
    };
    loadUser();
  }, []);

  // Real-time data fetching for Commander Dashboard
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const users = await apiService.getAllUsers();
        const notifications = await apiService.getNotifications();
        if (currentUser && currentUser.role && currentUser.unit) {
          // Filter soldiers in the same unit (case-insensitive, handle nulls)
          const unitSoldiers = users.filter(u =>
            u.unit &&
            u.role &&
            u.unit.toLowerCase() === currentUser.unit.toLowerCase() &&
            u.role.toLowerCase() === 'soldier'
          );
          setSoldiers(unitSoldiers);
          // Dashboard stats
          const total = unitSoldiers.length;
          const active = unitSoldiers.filter(s => s.status && s.status.toLowerCase() === 'active').length;
          const offline = unitSoldiers.filter(s => s.status && s.status.toLowerCase() === 'offline').length;
          // Critical alerts: notifications of type 'emergency' or 'critical' for this unit
          const critical = notifications.filter(n =>
            (n.type === 'emergency' || n.type === 'critical') &&
            unitSoldiers.some(s => s.id === n.soldierId)
          ).length;
          setDashboardStats({
            totalSoldiers: total,
            activeSoldiers: active,
            offlineSoldiers: offline,
            criticalAlerts: critical,
          });
          // Recent alerts: show last two from notifications (no soldierId filter, which may be absent)
          const recent = (notifications || [])
            .slice()
            .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
            .slice(0, 2);
          if (recent.length > 0) setRecentAlerts(recent);
        }
      } catch (e) {}
    };
    if (currentUser && currentUser.role && currentUser.unit) {
      fetchDashboardData();
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchSoldiers = async () => {
      if (!currentUser || !currentUser.unit) return;
      setLoading(true);
      setError(null);
      try {
        const soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
        setSoldiers(soldiers);
      } catch (err) {
        setError('Failed to fetch soldiers.');
      } finally {
        setLoading(false);
      }
    };
    fetchSoldiers();
  }, [currentUser]);

  useEffect(() => {
    const fetchActiveSoldiers = async () => {
      if (!currentUser || !currentUser.unit) return;
      setActiveLoading(true);
      setActiveError(null);
      try {
        const active = await apiService.getActiveSoldiersByUnit(currentUser.unit);
        setActiveSoldiers(active);
      } catch (err) {
        setActiveError('Failed to fetch active soldiers.');
      } finally {
        setActiveLoading(false);
      }
    };
    fetchActiveSoldiers();
  }, [currentUser]);

  useEffect(() => {
    const fetchOfflineSoldiers = async () => {
      if (!currentUser || !currentUser.unit) return;
      setOfflineLoading(true);
      setOfflineError(null);
      try {
        const soldiers = await apiService.getSoldiersByUnit(currentUser.unit);
        // Filter for offline soldiers (status === 'offline' or isOnline === false)
        const offline = soldiers.filter(s =>
          (s.status && s.status.toLowerCase() === 'offline') ||
          (typeof s.isOnline === 'boolean' && s.isOnline === false)
        );
        setOfflineCount(offline.length);
      } catch (err) {
        setOfflineError('Failed to fetch offline soldiers.');
      } finally {
        setOfflineLoading(false);
      }
    };
    fetchOfflineSoldiers();
  }, [currentUser]);

  // Fetch critical alerts for the commander's unit
  useEffect(() => {
    const fetchCriticalAlerts = async () => {
      setCriticalAlertsLoading(true);
      setCriticalAlertsError(null);
      try {
        const alerts = await apiService.getAlerts();
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        setCriticalAlertsCount(criticalAlerts.length);
      } catch (err) {
        setCriticalAlertsError('Failed to fetch critical alerts.');
      } finally {
        setCriticalAlertsLoading(false);
      }
    };
    fetchCriticalAlerts();
  }, []);

  // Derived data for Mission Analytics (simple synthetic trend using counts for stable visuals)
  const analyticsData = useMemo(() => {
    // Generate deterministic pseudo-trend based on counts so it looks stable across renders
    const base = Math.max(1, soldiers.length);
    let len = analyticsFilter === 'today' ? 8 : analyticsFilter === 'week' ? 7 : 12; // hours/ days/ months
    if (analyticsFilter === 'custom' && customFromDate && customToDate) {
      const startDay = new Date(customFromDate).setHours(0,0,0,0);
      const endDay = new Date(customToDate).setHours(0,0,0,0);
      const ms = Math.max(0, endDay - startDay);
      const days = Math.min(90, Math.floor(ms / (1000*60*60*24)) + 1); // cap to 90 for performance
      // If same-day custom range, use hourly like Today for better visibility
      len = days <= 1 ? 8 : Math.max(2, days);
    }
    const arr = Array.from({ length: len }).map((_, idx) => {
      const factor = (idx + 1) / len;
      const activeVal = Math.round(base * (0.6 + 0.3 * Math.sin((idx + 1) * 1.3)) * factor);
      const completedVal = Math.round(base * (0.4 + 0.2 * Math.cos((idx + 1) * 1.1)) * factor);
      return { x: idx, active: Math.max(0, activeVal), completed: Math.max(0, completedVal) };
    });
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

  // Tiny LineChart with pure Views (no external libs) + tooltip on tap
  const LineChart = ({ data, labels = [], color = '#2E3192', height = 140, padding = 12 }) => {
    const [selectedIndex, setSelectedIndex] = useState(null);
    const values = data.map(d => (analyticsMode === 'active' ? d.active : d.completed));
    const maxY = Math.max(1, ...values);
    const width = Math.max(240, data.length * 28);
    const points = data.map((d, i) => {
      const yVal = values[i];
      const x = padding + (i * (width - padding * 2)) / Math.max(1, data.length - 1);
      const y = padding + (height - padding * 2) * (1 - yVal / maxY);
      return { x, y };
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
          if (i === 0) return null;
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
      const t = d.setHours(0,0,0,0);
      const s = new Date(customFromDate).setHours(0,0,0,0);
      const e = new Date(customToDate).setHours(0,0,0,0);
      return t >= s && t <= e;
    };

    const onSelectDay = (d) => {
      if (!d) return;
      if (!customFromDate || (customFromDate && customToDate)) {
        setCustomFromDate(d);
        setCustomToDate(null);
      } else {
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
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
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
            {customFromDate ? customFromDate.toDateString() : 'Start'}
            {'  —  '}
            {customToDate ? customToDate.toDateString() : 'End'}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.filterCancel, { marginRight: 10 }]} onPress={() => { setCustomRangeVisible(false); }}>
              <Text style={styles.filterCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#2E3192' }]} onPress={() => {
              if (!customFromDate || !customToDate) return;
              setAnalyticsFilter('custom');
              setCustomRangeVisible(false);
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // RadarChart with N metrics using pure Views + tooltip on tap
  const RadarChart = ({ size = 220, values = [], labels = [] }) => {
    const [selectedIdx, setSelectedIdx] = useState(null);
    const N = Math.max(3, Math.min(labels.length || values.length || 0, 12));
    const vals = Array.from({ length: N }).map((_, i) => Math.min(1, Math.max(0, values[i] ?? 0)));
    const labs = Array.from({ length: N }).map((_, i) => labels[i] ?? `M${i + 1}`);
    const center = size / 2;
    const radius = size * 0.4;
    const toPoint = (idx, rMul = 1) => {
      const angle = (-90 + (360 / N) * idx) * (Math.PI / 180);
      const r = radius * rMul;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y };
    };
    const poly = vals.map((v, i) => toPoint(i, v));
    const edges = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
    const rings = [0.4, 0.7, 1];
    const tip = (() => {
      if (selectedIdx == null) return null;
      const pt = poly[selectedIdx] || toPoint(selectedIdx, 1);
      const label = labs[selectedIdx];
      const valuePct = Math.round((vals[selectedIdx] ?? 0) * 100);
      const left = Math.min(Math.max(pt.x + 8, 0), Math.max(0, size - 140));
      const top = Math.max(pt.y - 44, 4);
      return (
        <View style={{ position: 'absolute', left, top, width: 140, backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6 }}>
          <Text style={{ fontWeight: '700', color: '#2E3192' }}>{label}</Text>
          <Text style={{ color: '#333' }}>{`percentage: ${valuePct}%`}</Text>
        </View>
      );
    })();
    return (
      <View style={{ width: size, height: size }}>
        {rings.map((rm, idx) => (
          <View key={`ring-${idx}`} style={{ position: 'absolute', left: center - radius * rm, top: center - radius * rm, width: radius * rm * 2, height: radius * rm * 2, borderRadius: radius * rm, borderWidth: 1, borderColor: '#e0e0e0' }} />
        ))}
        {Array.from({ length: N }).map((_, idx) => {
          const a = toPoint(idx, 1);
          const dx = a.x - center; const dy = a.y - center; const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View key={`sp-${idx}`} style={{ position: 'absolute', left: center - len / 2, top: center - 0.5, width: len, height: 1, backgroundColor: '#e0e0e0', transform: [{ rotate: `${angle}deg` }], borderRadius: 1 }} />
          );
        })}
        {edges.map(([a, b], idx) => {
          const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View key={`edge-${idx}`} style={{ position: 'absolute', left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 1, width: len, height: 3, backgroundColor: '#2E3192', opacity: 0.35, transform: [{ rotate: `${angle}deg` }], borderRadius: 3 }} />
          );
        })}
        {poly.map((p, idx) => (
          <TouchableOpacity key={`v-${idx}`} activeOpacity={0.7} onPress={() => setSelectedIdx(idx)} style={{ position: 'absolute', left: p.x - 7, top: p.y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 3, borderColor: '#2E3192' }} />
        ))}
        {Array.from({ length: N }).map((_, idx) => {
          const pt = toPoint(idx, 1.15);
          return (
            <Text key={`lbl-${idx}`} style={{ position: 'absolute', left: pt.x - 34, top: pt.y - 8, width: 68, textAlign: 'center', fontSize: 11, color: '#555' }}>{labs[idx]}</Text>
          );
        })}
        {tip}
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
    } catch {}
  }, [notifications]);

  // Analytics helpers
  const analyticsBasisText = useMemo(() => {
    const modeText = analyticsMode === 'active' ? 'Active missions' : 'Completed missions';
    switch (analyticsFilter) {
      case 'today':
        return `${modeText} per hour (last 8 hrs)`;
      case 'week':
        return `${modeText} per day (Mon–Sun)`;
      case 'month':
        return `${modeText} per month (last 12 mos)`;
      case 'custom':
        return `${modeText} per day (custom range)`;
      default:
        return modeText;
    }
  }, [analyticsMode, analyticsFilter]);

  const xAxisLabels = useMemo(() => {
    const len = analyticsData.length;
    if (analyticsFilter === 'week') {
      return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].slice(0, len);
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
      // Multi-day: label by date
      const total = len;
      return Array.from({ length: total }).map((_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      });
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
      d0.setHours(0,0,0,0);
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
      s0.setHours(0,0,0,0);
      return Array.from({ length: len }).map((_, i) => {
        const d = new Date(s0);
        d.setDate(s0.getDate() + i);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      });
    }
    return Array.from({ length: len }).map((_, i) => `D${i + 1}`);
  }, [analyticsData.length, analyticsFilter, customFromDate, customToDate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.header, { textAlign: 'center' }]}>Commander Dashboard</Text>
        {/* Section 1: Overview Cards - Horizontal scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
          <Card style={styles.statCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Icon name="people" size={36} color="#4CAF50" />
                <View>
                  <Text style={styles.cardTitle}>Total Soldiers</Text>
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
                  <Text style={styles.cardTitle}>Active</Text>
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
                  <Text style={styles.cardTitle}>Offline</Text>
                  {offlineLoading ? <ActivityIndicator size="small" color="#2E3192" /> : offlineError ? <Text style={{ color: 'red' }}>{offlineError}</Text> : <Text style={styles.cardValue}>{offlineCount}</Text>}
                </View>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Icon name="alert-circle" size={36} color="#FF9800" />
                <View>
                  <Text style={styles.cardTitle}>Critical Alerts</Text>
                  {criticalAlertsLoading ? <ActivityIndicator size="small" color="#2E3192" /> : criticalAlertsError ? <Text style={{ color: 'red' }}>{criticalAlertsError}</Text> : <Text style={styles.cardValue}>{criticalAlertsCount}</Text>}
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
              <Text style={styles.analyticsTitle}>Mission Analytics</Text>
        </View>
            <Icon name={analyticsCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#666" />
          </TouchableOpacity>
          {!analyticsCollapsed && (
            <Card.Content>
              {/* Mode toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity onPress={() => setAnalyticsMode('active')} style={[styles.toggleBtn, analyticsMode === 'active' && styles.toggleBtnActive]}>
                  <Text style={[styles.toggleText, analyticsMode === 'active' && styles.toggleTextActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAnalyticsMode('completed')} style={[styles.toggleBtn, analyticsMode === 'completed' && styles.toggleBtnActive]}>
                  <Text style={[styles.toggleText, analyticsMode === 'completed' && styles.toggleTextActive]}>Completed</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterBtn}>
                  <Icon name="calendar" size={16} color="#2E3192" />
                  <Text style={styles.filterBtnText}>
                    {analyticsFilter === 'today' ? 'Today' : analyticsFilter === 'week' ? 'This Week' : analyticsFilter === 'month' ? 'This Month' : customFromDate && customToDate ? `${customFromDate.toLocaleDateString()} - ${customToDate.toLocaleDateString()}` : 'Custom'}
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
                  <Text style={styles.legendLabel}>Active</Text>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF50', marginLeft: 12 }]} />
                  <Text style={styles.legendLabel}>Completed</Text>
                </View>
              </View>
              {/* Chart scroller */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                <LineChart data={analyticsData} labels={tooltipLabels} color={analyticsMode === 'active' ? '#2E3192' : '#4CAF50'} />
              </ScrollView>
              {/* X-axis labels */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6, width: Math.max(180, analyticsData.length * 24), justifyContent: 'space-between' }}>
                  {xAxisLabels.map((lbl, i) => (
                    <View key={`xl-${i}`} style={{ paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#fff', borderRadius: 6, borderWidth: 0.5, borderColor: '#e0e0e0' }}>
                      <Text style={[styles.axisLabel, { color: '#222', fontWeight: '600' }]}>{lbl}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={[styles.axisLabel, { paddingLeft: 12, opacity: 0.95, color: '#333', fontWeight: '600' }]}>Y: Missions • X: {analyticsFilter === 'today' ? 'Hours' : analyticsFilter === 'week' ? 'Days' : analyticsFilter === 'month' ? 'Months' : 'Days'}</Text>
            </Card.Content>
          )}
        </Card>

        {/* Date Filter Modal */}
        <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterTitle}>Select Date Range</Text>
              {[
                { k: 'today', l: 'Today' },
                { k: 'week', l: 'This Week' },
                { k: 'month', l: 'This Month' },
                { k: 'custom', l: 'Custom (Select Range...)' },
              ].map(opt => (
                <TouchableOpacity key={opt.k} style={styles.filterOption} onPress={() => {
                  if (opt.k === 'custom') {
                    setFilterModalVisible(false);
                    setTimeout(() => setCustomRangeVisible(true), 100);
                  } else {
                    setAnalyticsFilter(opt.k);
                    setFilterModalVisible(false);
                  }
                }}>
                  <Text style={[styles.filterOptionText, analyticsFilter === opt.k && styles.filterSelected]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.filterCancel} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Custom Date Range Calendar Modal */}
        <Modal visible={customRangeVisible} transparent animationType="fade" onRequestClose={() => setCustomRangeVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.calendarCard}>
              <Text style={styles.filterTitle}>Select Custom Range</Text>
              <CalendarRangePicker />
            </View>
          </View>
        </Modal>

        {/* Section 3: Squad Performance */}
        <Card style={styles.performanceCard}>
          <Card.Content>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.performanceTitle}>Squad Avg. Performance</Text>
            </View>
            {/* 6-metric radar: Combat, Stamina, Marksmanship, Strategy, Teamwork, Discipline */}
            {(() => {
              const n = Math.max(1, soldiers.length);
              const vals = [
                0.5 + (n % 5) * 0.08, // Combat
                0.55 + (n % 3) * 0.1, // Stamina
                0.52 + (n % 4) * 0.07, // Marksmanship
                0.6, // Strategy
                0.5 + ((n % 4) * 0.08), // Teamwork
                0.58 // Discipline
              ];
              const labels = ['Combat','Stamina','Marksmanship','Strategy','Teamwork','Discipline'];
              return <RadarChart values={vals.map(v => Math.min(1, Math.max(0.3, v)))} labels={labels} />;
            })()}
            {/* Legend */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginTop: 10 }}>
              {['Combat','Stamina','Marksmanship','Strategy','Teamwork','Discipline'].map((lbl, idx) => (
                <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E3192', marginRight: 6, opacity: 0.7 }} />
                  <Text style={{ fontSize: 11, color: '#555' }}>{lbl}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
        {/* Section 4: Soldier List */}
        <Card style={styles.listCard}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.performanceTitle}>Soldiers</Text>
            <Text style={{ color: '#757575', fontSize: 12 }}>{`${soldiers.length || 0} in unit`}</Text>
          </View>
          <Card.Content>
        {soldiers.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#757575', marginVertical: 10 }}>{i18n.t('noSoldiersFound')}</Text>
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
                          <Text style={styles.soldierSubText}>ID: {item.username || item.id || '-'}</Text>
                          <Text style={styles.soldierSubText}>Loc: {coordText}</Text>
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
        {/* Section 5: Recent Alerts */}
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
      </ScrollView>
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
                {/* Vital Signs Section */}
                <View style={styles.vitalSection}>
                  <Text style={styles.sectionTitle}>Vital Signs</Text>
                  <View style={styles.vitalGrid}>
                    <View style={styles.vitalItem}>
                      <Text style={styles.vitalLabel}>Heart Rate</Text>
                      <Text style={styles.vitalValue}>{selectedSoldier.heartRate || i18n.t('notAvailable')}</Text>
                    </View>
                    <View style={styles.vitalItem}>
                      <Text style={styles.vitalLabel}>Temperature</Text>
                      <Text style={styles.vitalValue}>{selectedSoldier.temperature || i18n.t('notAvailable')}</Text>
                    </View>
                    <View style={styles.vitalItem}>
                      <Text style={styles.vitalLabel}>Battery</Text>
                      <Text style={styles.vitalValue}>{selectedSoldier.battery || i18n.t('notAvailable')}</Text>
                    </View>
                    <View style={styles.vitalItem}>
                      <Text style={styles.vitalLabel}>Status</Text>
                      <Text style={styles.vitalValue}>{selectedSoldier.status || i18n.t('notAvailable')}</Text>
                    </View>
                  </View>
                </View>
                {/* Location Section */}
                <View style={styles.vitalSection}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationText}>
                      <Text style={styles.locationLabel}>Coordinates:</Text> {selectedSoldier.latitude?.toFixed(6)}, {selectedSoldier.longitude?.toFixed(6)}
                    </Text>
                    <Text style={styles.locationText}>
                      <Text style={styles.locationLabel}>Unit:</Text> {selectedSoldier.unit}
                    </Text>
                    <Text style={styles.locationText}>
                      <Text style={styles.locationLabel}>{i18n.t('lastUpdateLabel')}:</Text> {selectedSoldier.lastUpdate || i18n.t('unknownLocation')}
                    </Text>
                  </View>
                </View>
                
                {/* Action Buttons */}
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => {
                    setModalVisible(false);
                    navigation.navigate('Geospatial', { selectedSoldier });
                  }}
                >
                  <Text style={styles.actionButtonText}>View on Map</Text>
                </TouchableOpacity>
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
    color: '#757575',
    marginLeft: 10,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
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
  // Section 3: Squad Performance
  performanceCard: {
    marginBottom: 15,
    elevation: 3,
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
    width: `${100/7}%`,
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
    width: `${100/7}%`,
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
  actionButton: {
    backgroundColor: '#2E3192',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  }
}); 