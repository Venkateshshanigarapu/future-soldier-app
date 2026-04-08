import React, { useState, useLayoutEffect, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, SafeAreaView, RefreshControl, TextInput } from 'react-native';
import { Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/Ionicons';
// Removed legacy header menu; global drawer handles header actions
import FilterChip from '../components/FilterChip';
import i18n, { addLanguageChangeListener } from '../utils/i18n';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { green } from '../theme';
import assignmentService from '../services/assignmentService';

export default function ReportsScreen({ navigation }) {
  // ReportsScreen function.
  // Top of component, right after
  const [isCommander, setIsCommander] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
  // Place all useState:
  const [reports, setReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);
  // Remove any duplicates of these states later in file.
  // All other state, refs, useEffects, callbacks, memoizations, and render functions as normally structured.
  // No use of 'refreshing' before it is declared.

  // Use refs to prevent unnecessary re-renders
  const isCommanderRef = useRef(false);
  const currentUnitRef = useRef(null);
  const selectedCategoryRef = useRef('soldier');

  // Commander categories
  const [selectedCategory, setSelectedCategory] = useState('soldier');
  const [soldierReports, setSoldierReports] = useState([]);
  const [operationReports, setOperationReports] = useState([]);
  const [ammoReports, setAmmoReports] = useState([]);
  const [alertsReports, setAlertsReports] = useState([]);
  const [unitChangeReports, setUnitChangeReports] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Get user info
        const userStr = await AsyncStorage.getItem('currentUser');
        if (!userStr) return;
          const user = JSON.parse(userStr);
        setCurrentUser(user);

        // Fetch commander of this unit
        const users = await apiService.getAllUsers();
        const unit = user.unit || '';
        const commander = (users || []).find(
          u => String(u.role || '').toLowerCase() === 'commander' && u.unit === unit
        );
        setCommanderName(commander?.name || commander?.username || '');

        // Fetch assignments for this soldier (by unit)
        const asg = await assignmentService.getAssignments({ unitId: user.unit });
        setAssignments(asg || []);

        if (user && user.role && String(user.role).toLowerCase() === 'commander') setIsCommander(true);
        else setIsCommander(false);

      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  // Load base reports once on mount
  useEffect(() => {
    console.log('🔄 ReportsScreen: Loading base reports (ONCE)');
    const fetchReports = async () => {
      setError(null);
      try {
        const data = await apiService.getReports();
        setReports(data || []);
      } catch (err) {
        // do not block other categories
      }
    };
    fetchReports();
  }, []);

  // Load category data when selection or unit changes (no continuous reloading)
  useEffect(() => {
    console.log('🔄 ReportsScreen: Category/Unit changed - loading data');
    const loadCategory = async () => {
      if (!isCommanderRef.current) return;
      
      setLoading(true);
      setError(null);
      try {
        if (selectedCategoryRef.current === 'soldier') {
          const allUsers = await apiService.getAllUsers();
          const normalizeBool = (v) => (typeof v === 'boolean' ? v : String(v || '').toLowerCase() === 'true');
          const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
          const computeIsOnline = (u) => {
            if (typeof u.isOnline === 'boolean') return u.isOnline;
            const status = String(u.status || '').toLowerCase();
            if (status === 'active') return true;
            const lastActiveStr = u.last_active || u.lastActive || u.updated_at || u.updatedAt || null;
            const lastActive = lastActiveStr ? new Date(lastActiveStr).getTime() : 0;
            if (lastActive && (Date.now() - lastActive) < ONLINE_WINDOW_MS) return true;
            // if GPS fields exist recently, consider online (backend may update lat/lng)
            return false;
          };
          const data = (allUsers || [])
            .filter(u => String(u.role || '').trim().toLowerCase() === 'soldier')
            .map(u => ({ ...u, isOnline: computeIsOnline(u) }));
          const commanderUnit = currentUser && currentUser.unit ? String(currentUser.unit).trim().toLowerCase() : '';
          const filtered = commanderUnit
            ? data.filter(u => String(u.unit || '').trim().toLowerCase() === commanderUnit)
            : data;
          setSoldierReports(filtered);
        } else if (selectedCategoryRef.current === 'operation') {
          // Use history entries from reports API as operation report
          const data = (reports || []).filter(r => String(r.type || '').toLowerCase() === 'history');
          setOperationReports(data);
        } else if (selectedCategoryRef.current === 'ammo') {
          // Use status entries from reports API as placeholder for equipment report
          const data = (reports || []).filter(r => String(r.type || '').toLowerCase() === 'status');
          setAmmoReports(data);
        } else if (selectedCategoryRef.current === 'alerts') {
          const alerts = await apiService.getAlerts();
          setAlertsReports(alerts || []);
        } else if (selectedCategoryRef.current === 'unitChange') {
          // No endpoint yet; show empty list placeholder
          setUnitChangeReports([]);
        }
      } catch (err) {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    
    // Only load if we have the necessary data
    if (isCommanderRef.current && selectedCategoryRef.current && currentUnitRef.current !== undefined) {
      loadCategory();
    }
  }, [selectedCategory, isCommander, currentUser]); // Removed 'reports' dependency

  // Update refs when state changes
  useEffect(() => {
    isCommanderRef.current = isCommander;
  }, [isCommander]);

  useEffect(() => {
    currentUnitRef.current = currentUser?.unit;
  }, [currentUser?.unit]);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Pull-to-refresh function
  const onRefresh = useCallback(async () => {
    console.log('🔄 ReportsScreen: Manual refresh triggered');
    setRefreshing(true);
    setError(null);
    
    try {
      if (selectedCategoryRef.current === 'soldier') {
        const allUsers = await apiService.getAllUsers();
        const ONLINE_WINDOW_MS = 5 * 60 * 1000;
        const computeIsOnline = (u) => {
          if (typeof u.isOnline === 'boolean') return u.isOnline;
          const status = String(u.status || '').toLowerCase();
          if (status === 'active') return true;
          const lastActiveStr = u.last_active || u.lastActive || u.updated_at || u.updatedAt || null;
          const lastActive = lastActiveStr ? new Date(lastActiveStr).getTime() : 0;
          return lastActive && (Date.now() - lastActive) < ONLINE_WINDOW_MS;
        };
        const data = (allUsers || [])
          .filter(u => String(u.role || '').trim().toLowerCase() === 'soldier')
          .map(u => ({ ...u, isOnline: computeIsOnline(u) }));
        const commanderUnit = currentUser && currentUser.unit ? String(currentUser.unit).trim().toLowerCase() : '';
        const filtered = commanderUnit
          ? data.filter(u => String(u.unit || '').trim().toLowerCase() === commanderUnit)
          : data;
        setSoldierReports(filtered);
      } else if (selectedCategoryRef.current === 'operation') {
        const data = (reports || []).filter(r => String(r.type || '').toLowerCase() === 'history');
        setOperationReports(data);
      } else if (selectedCategoryRef.current === 'ammo') {
        const data = (reports || []).filter(r => String(r.type || '').toLowerCase() === 'status');
        setAmmoReports(data);
      } else if (selectedCategoryRef.current === 'alerts') {
        const alerts = await apiService.getAlerts();
        setAlertsReports(alerts || []);
      }
    } catch (err) {
      setError('Failed to refresh data.');
    } finally {
      setRefreshing(false);
    }
  }, [currentUser]); // Empty dependency array since we use refs

  // Memoize the refresh control to prevent re-renders
  const refreshControl = useMemo(() => (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  ), [refreshing, onRefresh]);

  // Split reports into status and history for non-commander UI (memoized to prevent re-renders)
  const assetStatusData = React.useMemo(() => reports.filter(r => r.type === 'status'), [reports]);
  const historyData = React.useMemo(() => reports.filter(r => r.type === 'history'), [reports]);

  // Use global headerRight from TabNavigator; do not override here

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return green.accent; // Use theme color for active status
      case 'inactive':
        return '#F44336'; // Keep red for inactive - good contrast
      case 'maintenance':
        return green.primary; // Use theme color for maintenance
      default:
        return green.dark; // Use theme color for default
    }
  };

  const getEventIcon = (event) => {
    switch (event.toLowerCase()) {
      case 'location update':
        return 'location';
      case 'battery warning':
        return 'battery-dead';
      case 'geofence exit':
        return 'exit';
      case 'connection lost':
        return 'cloud-offline';
      case 'maintenance started':
        return 'build';
      case 'status change':
        return 'refresh';
      default:
        return 'information-circle';
    }
  };

  const renderAssetStatusItem = ({ item }) => (
    <Card style={styles.statusCard}>
      <Card.Content>
        <View style={styles.statusHeader}>
          <View>
            <Text style={styles.assetId}>{item.assetId || item.id || 'N/A'}</Text>
            <Text style={styles.assetName}>{item.name || 'Unknown Asset'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}> 
            <Text style={styles.statusText}>{i18n.t(item.status?.toLowerCase()) || item.status || 'Unknown'}</Text>
          </View>
        </View>
        <View style={styles.statusDetails}>
          <View style={styles.statusDetail}>
            <Icon name="battery-half" size={20} color={green.dark} />
            <Text style={styles.detailText}>{item.battery ? `${item.battery}%` : '-'}</Text>
          </View>
          <View style={styles.statusDetail}>
            <Icon name="time" size={20} color={green.dark} />
            <Text style={styles.detailText}>{item.lastUpdate || '-'}</Text>
          </View>
          <View style={styles.statusDetail}>
            <Icon name="location" size={20} color={green.dark} />
            <Text style={styles.detailText}>{item.location || '-'}</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyIconContainer}>
        <Icon name={getEventIcon(item.event)} size={24} color={green.primary} />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyEvent}>{item.event || 'Event'}</Text>
        <Text style={styles.historyAssetId}>{i18n.t('asset')}: {item.assetId || item.id || 'N/A'}</Text>
        <Text style={styles.historyDetails}>{item.details || 'No details available'}</Text>
        <Text style={styles.historyTimestamp}>{item.timestamp || 'Timestamp unavailable'}</Text>
      </View>
    </View>
  );

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [commanderName, setCommanderName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setDataLoaded(false);
    try {
      // Get user info
      const userStr = await AsyncStorage.getItem('currentUser');
      if (!userStr) throw new Error('No user logged in');
      const user = JSON.parse(userStr);
      setCurrentUser(user);

      // Fetch commander
      const users = await apiService.getAllUsers();
      const unit = user && user.unit ? user.unit : '';
      // Robust commander lookup
      const commander = (users && unit) ? users.find(
        u => String(u.role || '').toLowerCase() === 'commander' && u.unit === unit
      ) : null;
      setCommanderName((commander && (commander.name || commander.username)) || 'N/A');

      // Fetch assignments (by unit)
      const asg = user && user.unit ? await assignmentService.getAssignments({ unitId: user.unit }) : [];
      setAssignments(Array.isArray(asg) ? asg : []);
      setDataLoaded(true);
    } catch (err) {
      setError(i18n.t('reportLoadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:green.background}}>
        <Text style={{fontSize:18,color:green.primary}}>{i18n.t('loading')}</Text>
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:green.background}}>
        <Text style={{fontSize:16,color:'#f44336',marginBottom:16}}>{error}</Text>
        <TouchableOpacity style={{paddingHorizontal:20,paddingVertical:10,backgroundColor:green.primary,borderRadius:7}} onPress={fetchData}>
          <Text style={{color:'#fff',fontWeight:'bold'}}>{i18n.t('retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  if (!currentUser) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:green.background}}>
        <Text style={{fontSize:18,color:green.primary}}>{i18n.t('loading')}</Text>
      </SafeAreaView>
    );
  }
  const completedAssignments = assignments.filter(a => String(a.status).toLowerCase() === 'completed');
  const pendingAssignments = assignments.filter(a => String(a.status).toLowerCase() === 'pending');
  const filteredCompleted = completedAssignments.filter(a => (a.title||'').toLowerCase().includes(search.toLowerCase()) || (a.description||'').toLowerCase().includes(search.toLowerCase()));
  return (
    <SafeAreaView style={{flex:1, backgroundColor: green.background}}>
      <ScrollView style={{flex:1}} contentContainerStyle={{padding: 16}}>
        {/* Soldier Info */}
        <View style={{backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:20, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:5, elevation:2}}>
          <Text style={{fontSize:20,fontWeight:'bold',color:green.dark}}>{currentUser.name || i18n.t('notAvailable')}</Text>
          <Text style={{fontSize:14,color:green.primary,marginTop:2}}>{`${i18n.t('unit')}: ${currentUser.unit || i18n.t('notAvailable')}`}</Text>
          <Text style={{fontSize:14,color:'#607D8B',marginTop:2}}>{`${i18n.t('commander')}: ${commanderName || i18n.t('notAvailable')}`}</Text>
            </View>
        {/* Stats Row */}
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:16}}>
          <View style={{flex:1,marginRight:8,backgroundColor:'#e8f5e9',borderRadius:8,padding:16,alignItems:'center'}}>
            <Text style={{fontSize:16,fontWeight:'bold',color:green.primary}}>{i18n.t('completed')}</Text>
            <Text style={{fontSize:24,fontWeight:'bold',color:green.primary}}>{completedAssignments.length}</Text>
          </View>
          <View style={{flex:1,marginLeft:8,backgroundColor:'#fffde7',borderRadius:8,padding:16,alignItems:'center'}}>
            <Text style={{fontSize:16,fontWeight:'bold',color:'#fbc02d'}}>{i18n.t('pending')}</Text>
            <Text style={{fontSize:24,fontWeight:'bold',color:'#fbc02d'}}>{pendingAssignments.length}</Text>
          </View>
            </View>
        {/* Search Bar */}
        <View style={{marginBottom:10}}>
          <TextInput
            placeholder={i18n.t('searchCompletedAssignments')}
            style={{backgroundColor:'#f5f5f5',borderRadius:8,paddingVertical:8,paddingHorizontal:14,fontSize:16}}
            value={search}
            onChangeText={setSearch}
          />
          </View>
        {/* Completed Assignment List */}
        {filteredCompleted.length === 0 ? (
          <View style={{alignItems:'center',marginTop:32}}><Text style={{color:green.dark}}>{i18n.t('noCompletedAssignments')}</Text></View>
        ) : filteredCompleted.map(asg => (
          <TouchableOpacity
            key={asg.id}
            onPress={() => navigation.navigate('AssignmentDetail', { assignment: asg })}
            activeOpacity={0.82}
            style={{backgroundColor:'#fff',borderRadius:10,padding:16,marginBottom:12,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:5,elevation:1}}
          >
            <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
              <Icon name="clipboard-outline" size={20} color={green.primary} style={{marginRight:10}} />
              <Text style={{fontSize:18,fontWeight:'bold',color:green.primary,flex:1}} numberOfLines={1}>{asg.title}</Text>
            </View>
            <Text numberOfLines={2} style={{color:'#666',fontSize:14,marginBottom:6}}>{asg.description}</Text>
            <Text style={{color:green.accent,fontSize:13}}>{asg.due_date ? `${i18n.t('duePrefix')} ${new Date(asg.due_date).toLocaleDateString()}` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: green.background,
  },
  container: {
    flex: 1,
    backgroundColor: green.background,
  },
  filterBar: {
    backgroundColor: '#fff',
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
  },
  filterBarContent: {
    paddingHorizontal: 10,
    minHeight: 56,
    alignItems: 'center',
    paddingVertical: 0,
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 2,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: green.primary,
  },
  tabText: {
    fontSize: 16,
    marginLeft: 5,
    color: green.dark,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  activeTabText: {
    color: green.primary,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  listContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 0,
  },
  statusCard: {
    marginBottom: 10,
    elevation: 3,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  assetId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: green.dark,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  assetName: {
    fontSize: 14,
    fontWeight: '500',
    color: green.dark,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
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
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  statusDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 5,
    color: green.dark,
    fontSize: 12,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  historyItem: {
    backgroundColor: '#fff',
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyIconContainer: {
    marginRight: 15,
  },
  historyContent: {
    flex: 1,
  },
  historyEvent: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: green.dark,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  historyAssetId: {
    fontSize: 14,
    fontWeight: '500',
    color: green.primary,
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  historyDetails: {
    fontSize: 14,
    fontWeight: '500',
    color: green.dark,
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  // New styles for commander view
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: green.dark,
    textAlign: 'center',
    padding: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336', // Keep red for errors - good contrast
    textAlign: 'center',
    padding: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: green.dark,
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  soldierName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: green.dark,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  soldierId: {
    fontSize: 14,
    fontWeight: '500',
    color: green.primary,
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  soldierUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: green.dark,
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  // soldierRank style removed
  soldierStatusContainer: {
    alignItems: 'flex-end',
  },
  soldierStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  soldierStatusText: {
    color: '#fff', // Keep white for contrast on colored backgrounds
    fontWeight: 'bold',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  alertCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: green.dark,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  alertMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: green.dark,
    marginBottom: 4,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  alertTimestamp: {
    fontSize: 12,
    color: '#666', // Good contrast for secondary text
    marginBottom: 8,
  },
  alertSeverityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertSeverityText: {
    color: '#fff', // Keep white for contrast on colored backgrounds
    fontWeight: 'bold',
    fontSize: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    marginRight: 10,
  },
  alertContent: {
    flex: 1,
  },
  soldierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  soldierInfo: {
    flex: 1,
    paddingRight: 12,
  },
  // Coming Soon styles
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  comingSoonIcon: {
    marginBottom: 24,
    opacity: 0.8,
  },
  comingSoonTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: green.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 16,
    color: green.dark,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.8,
  },
  comingSoonFeatures: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(46, 49, 146, 0.05)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 49, 146, 0.1)',
  },
  comingSoonFeaturesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: green.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonFeature: {
    fontSize: 14,
    color: green.dark,
    marginBottom: 8,
    lineHeight: 20,
    opacity: 0.8,
  },
}); 

// Helper function for alert severity colors
function getSeverityColor(severity) {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return '#F44336';
    case 'high':
      return '#FF9800';
    case 'medium':
      return '#FFC107';
    case 'low':
      return '#4CAF50';
    default:
      return '#757575';
  }
}