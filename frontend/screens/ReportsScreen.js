import React, { useState, useLayoutEffect, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, SafeAreaView, RefreshControl } from 'react-native';
import { Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/Ionicons';
import MenuIcon from './MenuIcon';
import FilterChip from '../components/FilterChip';
import i18n from '../utils/i18n';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { green } from '../theme';

export default function ReportsScreen({ navigation }) {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCommander, setIsCommander] = useState(false);
  const [currentUnit, setCurrentUnit] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
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
    // Determine role and unit
    (async () => {
      try {
        const userStr = await AsyncStorage.getItem('currentUser');
        if (userStr) {
          const user = JSON.parse(userStr);
          const role = String(user?.role || '').trim().toLowerCase();
          const isComm = role === 'commander';
          setIsCommander(isComm);
          setCurrentUnit(user?.unit || null);
          
          // Update refs
          isCommanderRef.current = isComm;
          currentUnitRef.current = user?.unit || null;
        }
      } catch {}
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
          const data = (allUsers || []).filter(u =>
            String(u.role || '').trim().toLowerCase() === 'soldier'
          );
          setSoldierReports(data);
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
  }, [selectedCategory, currentUnit, isCommander]); // Removed 'reports' dependency

  // Update refs when state changes
  useEffect(() => {
    isCommanderRef.current = isCommander;
  }, [isCommander]);

  useEffect(() => {
    currentUnitRef.current = currentUnit;
  }, [currentUnit]);

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
        const data = (allUsers || []).filter(u =>
          String(u.role || '').trim().toLowerCase() === 'soldier'
        );
        setSoldierReports(data);
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
  }, []); // Empty dependency array since we use refs

  // Memoize the refresh control to prevent re-renders
  const refreshControl = useMemo(() => (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  ), [refreshing, onRefresh]);

  // Split reports into status and history for non-commander UI (memoized to prevent re-renders)
  const assetStatusData = React.useMemo(() => reports.filter(r => r.type === 'status'), [reports]);
  const historyData = React.useMemo(() => reports.filter(r => r.type === 'history'), [reports]);

  const toggleDropdown = () => {
    setDropdownVisible(prev => !prev);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: undefined
    });
  }, [navigation]);

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

  if (isCommander) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Commander top-level filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
            <FilterChip 
              label="Soldier Report" 
              isActive={selectedCategory === 'soldier'} 
              onPress={() => setSelectedCategory('soldier')} 
              icon="people" 
            />
            <FilterChip 
              label="Operation Report" 
              isActive={selectedCategory === 'operation'} 
              onPress={() => setSelectedCategory('operation')} 
              icon="construct" 
            />
            <FilterChip 
              label="Ammo & Equipment" 
              isActive={selectedCategory === 'ammo'} 
              onPress={() => setSelectedCategory('ammo')} 
              icon="cube" 
            />
            <FilterChip 
              label="Alerts & Incidents" 
              isActive={selectedCategory === 'alerts'} 
              onPress={() => setSelectedCategory('alerts')} 
              icon="alert-circle" 
            />
            <FilterChip 
              label="Unit Change Requests" 
              isActive={selectedCategory === 'unitChange'} 
              onPress={() => setSelectedCategory('unitChange')} 
              icon="swap-horizontal" 
            />
          </ScrollView>

          {loading ? (
            <View style={styles.listContainer}>
              <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
            </View>
          ) : error ? (
            <View style={styles.listContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : selectedCategory === 'soldier' ? (
            <FlatList
              data={soldierReports}
              keyExtractor={item => item.id?.toString() || item.username || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <Card style={styles.statusCard}>
                  <Card.Content>
                    <View style={styles.soldierRow}>
                      <View style={styles.soldierInfo}>
                        <Text style={styles.soldierName}>{item.name || item.username || 'Unknown Soldier'}</Text>
                        <Text style={styles.soldierId}>ID: {item.username || item.id || 'N/A'}</Text>
                        <Text style={styles.soldierUnit}>Unit: {item.unit || 'N/A'}</Text>
                        <Text style={styles.soldierRank}>Rank: {item.rank || 'N/A'}</Text>
                      </View>
                      <View style={styles.soldierStatusContainer}>
                        <View style={[styles.soldierStatusBadge, { backgroundColor: item.isOnline ? green.accent : '#F44336' }]}>
                          <Text style={styles.soldierStatusText}>
                            {item.isOnline ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="people-outline" size={48} color={green.dark} />
                  <Text style={styles.emptyText}>No soldiers found.</Text>
                </View>
              }
              refreshControl={refreshControl}
            />
          ) : selectedCategory === 'operation' ? (
            <FlatList
              data={operationReports}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyIconContainer}>
                    <Icon name="time" size={24} color={green.primary} />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyEvent}>{item.event || 'Operation Event'}</Text>
                    <Text style={styles.historyDetails}>{item.details || item.description || 'No details available'}</Text>
                    <Text style={styles.historyTimestamp}>{item.timestamp || item.lastUpdate || 'Timestamp unavailable'}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="construct-outline" size={48} color={green.dark} />
                  <Text style={styles.emptyText}>No operation reports.</Text>
                </View>
              }
              refreshControl={refreshControl}
            />
          ) : selectedCategory === 'ammo' ? (
            <FlatList
              data={ammoReports}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={renderAssetStatusItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="cube-outline" size={48} color={green.dark} />
                  <Text style={styles.emptyText}>No ammo/equipment reports.</Text>
                </View>
              }
              refreshControl={refreshControl}
            />
          ) : selectedCategory === 'alerts' ? (
            <FlatList
              data={alertsReports}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <Card style={styles.statusCard}>
                  <Card.Content>
                    <View style={styles.alertRow}>
                      <Icon name="alert-circle" size={24} color="#F44336" style={styles.alertIcon} />
                      <View style={styles.alertContent}>
                        <Text style={styles.alertCategory}>{item.category || 'Alert'}</Text>
                        <Text style={styles.alertMessage}>{item.message || 'No message available'}</Text>
                        <Text style={styles.alertTimestamp}>{item.created_at || 'Timestamp unavailable'}</Text>
                        <View style={[styles.alertSeverityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
                          <Text style={styles.alertSeverityText}>
                            {item.severity || 'Unknown'} Severity
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="alert-circle-outline" size={48} color={green.dark} />
                  <Text style={styles.emptyText}>No alerts.</Text>
                </View>
              }
              refreshControl={refreshControl}
            />
          ) : (
            <View style={styles.listContainer}>
              <View style={styles.emptyContainer}>
                <Icon name="swap-horizontal-outline" size={48} color={green.dark} />
                <Text style={styles.emptyText}>No unit change requests.</Text>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Default (non-commander) view
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, styles.activeTab]}
          >
            <Icon 
              name="pulse" 
              size={20} 
              color={green.primary} 
            />
            <Text style={[styles.tabText, styles.activeTabText]}>
                {i18n.t('status')}
            </Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.listContainer}>
            <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
          </View>
        ) : error ? (
          <View style={styles.listContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={assetStatusData}
            renderItem={renderAssetStatusItem}
            keyExtractor={item => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="document-outline" size={48} color={green.dark} />
                <Text style={styles.emptyText}>{i18n.t('noReports')}</Text>
              </View>
            }
            refreshControl={refreshControl}
          />
        )}
      </View>
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
  },
  filterBarContent: {
    paddingHorizontal: 10,
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
    padding: 10,
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
    padding: 40,
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
  soldierRank: {
    fontSize: 14,
    fontWeight: '500',
    color: green.dark,
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
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
    alignItems: 'center',
  },
  soldierInfo: {
    flex: 1,
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