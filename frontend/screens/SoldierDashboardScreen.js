import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  FlatList
} from 'react-native';
import { Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { green } from '../theme';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function SoldierDashboardScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [healthData, setHealthData] = useState({
    vitals: null,
    profile: null,
    currentMission: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);

  // Listen for language changes to force re-render
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      setCurrentLanguage(i18n.locale);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        await loadHealthData(user.id);
      }
    } catch (err) {
      console.error('Error loading user:', err);
      setError('Failed to load user data');
    }
  };

  const loadHealthData = async (userId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getHealthDashboard(userId);
      setHealthData(data);
    } catch (err) {
      console.error('Error loading health data:', err);
      setError('Failed to load health data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentUser) {
      await loadHealthData(currentUser.id);
    }
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical':
        return '#F44336'; // Red
      case 'warning':
        return '#FF9800'; // Orange
      case 'normal':
        return '#4CAF50'; // Green
      case 'no_data':
        return '#757575'; // Gray
      default:
        return '#2196F3'; // Blue
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'critical':
        return 'warning';
      case 'warning':
        return 'alert-circle';
      case 'normal':
        return 'checkmark-circle';
      case 'no_data':
        return 'help-circle';
      default:
        return 'information-circle';
    }
  };

  const formatValue = (value, unit) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}${unit || ''}`;
  };

  const renderVitalCard = (label, value, unit, status) => (
    <View style={styles.vitalCard}>
      <View style={styles.vitalHeader}>
        <Text style={styles.vitalLabel}>{label}</Text>
        <Icon
          name={getStatusIcon(status)}
          size={16}
          color={getStatusColor(status)}
        />
      </View>
      <Text style={[styles.vitalValue, { color: getStatusColor(status) }]}>
        {formatValue(value, unit)}
      </Text>
      <Text style={[styles.vitalStatus, { color: getStatusColor(status) }]}>
        {status === 'no_data' ? 'No Data' : status.toUpperCase()}
      </Text>
    </View>
  );

  const renderHealthMetricCard = (label, value, unit, status) => (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Icon
          name={getStatusIcon(status)}
          size={14}
          color={getStatusColor(status)}
        />
      </View>
      <Text style={[styles.metricValue, { color: getStatusColor(status) }]}>
        {formatValue(value, unit)}
      </Text>
      <Text style={[styles.metricStatus, { color: getStatusColor(status) }]}>
        {status === 'no_data' ? 'No Data' : status.toUpperCase()}
      </Text>
    </View>
  );

  const renderMissionCard = (mission) => {
    const getPriorityColor = (priority) => {
      switch (priority?.toLowerCase()) {
        case 'urgent':
          return '#F44336';
        case 'high':
          return '#FF9800';
        case 'medium':
          return '#2196F3';
        case 'low':
          return '#4CAF50';
        default:
          return '#757575';
      }
    };

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'in_progress':
          return '#2196F3';
        case 'pending':
          return '#FF9800';
        case 'completed':
          return '#4CAF50';
        default:
          return '#757575';
      }
    };

    return (
      <Card style={styles.missionCard}>
        <Card.Content>
          <View style={styles.missionHeader}>
            <Icon name="clipboard" size={24} color={green.primary} />
            <Text style={styles.missionTitle}>Current Active Mission</Text>
          </View>

          <Text style={styles.missionName}>{mission.title}</Text>

          {mission.description && (
            <Text style={styles.missionDescription}>{mission.description}</Text>
          )}

          <View style={styles.missionDetails}>
            <View style={styles.missionDetailRow}>
              <Text style={styles.missionDetailLabel}>Status:</Text>
              <View style={styles.statusBadge}>
                <Text style={[styles.statusText, { color: getStatusColor(mission.status) }]}>
                  {mission.status?.toUpperCase() || 'UNKNOWN'}
                </Text>
              </View>
            </View>

            <View style={styles.missionDetailRow}>
              <Text style={styles.missionDetailLabel}>Priority:</Text>
              <View style={styles.priorityBadge}>
                <Text style={[styles.priorityText, { color: getPriorityColor(mission.priority) }]}>
                  {mission.priority?.toUpperCase() || 'MEDIUM'}
                </Text>
              </View>
            </View>

            {mission.due_date && (
              <View style={styles.missionDetailRow}>
                <Text style={styles.missionDetailLabel}>Due Date:</Text>
                <Text style={styles.missionDetailValue}>
                  {new Date(mission.due_date).toLocaleDateString()}
                </Text>
              </View>
            )}

            {mission.assigned_by_name && (
              <View style={styles.missionDetailRow}>
                <Text style={styles.missionDetailLabel}>Assigned by:</Text>
                <Text style={styles.missionDetailValue}>{mission.assigned_by_name}</Text>
              </View>
            )}

            {mission.destination && (
              <View style={styles.missionDetailRow}>
                <Text style={styles.missionDetailLabel}>Destination:</Text>
                <Text style={styles.missionDetailValue}>{mission.destination}</Text>
              </View>
            )}

            {mission.objectives && (
              <View style={styles.missionDetailRow}>
                <Text style={styles.missionDetailLabel}>Objectives:</Text>
                <Text style={styles.missionDetailValue}>
                  {(() => {
                    // Handle objectives - could be string, array, or JSON string
                    if (!mission.objectives) return '';

                    try {
                      // If it's already a string, check if it's JSON
                      if (typeof mission.objectives === 'string') {
                        // Try to parse as JSON first
                        try {
                          const parsed = JSON.parse(mission.objectives);
                          if (Array.isArray(parsed)) {
                            return parsed.join(', ');
                          }
                          return parsed;
                        } catch {
                          // Not JSON, return as is
                          return mission.objectives;
                        }
                      }

                      // If it's an array, join it
                      if (Array.isArray(mission.objectives)) {
                        return mission.objectives.join(', ');
                      }

                      // Otherwise, convert to string
                      return String(mission.objectives);
                    } catch (err) {
                      return String(mission.objectives);
                    }
                  })()}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.viewMissionButton}
            onPress={() => navigation.navigate('AssignmentDetail', { assignment: mission })}
          >
            <Text style={styles.viewMissionButtonText}>View Details</Text>
            <Icon name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </Card.Content>
      </Card>
    );
  };

  const renderMissionsSection = () => {
    const missions = Array.isArray(healthData.currentMissions) ? healthData.currentMissions : [];
    const single = healthData.currentMission;

    if (missions.length === 0 && !single) {
      return (
        <Card style={styles.missionCard}>
          <Card.Content>
            <View style={styles.missionHeader}>
              <Icon name="clipboard-outline" size={24} color={green.primary} />
              <Text style={styles.missionTitle}>Current Active Mission</Text>
            </View>
            <Text style={styles.noMissionText}>No active mission assigned</Text>
          </Card.Content>
        </Card>
      );
    }

    if (missions.length > 0) {
      // Prefer showing one Pending and one Ongoing/In Progress if available
      const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '_');
      const pending = missions.find(m => norm(m.status) === 'pending');
      const ongoing = missions.find(m => ['in_progress', 'active', 'ongoing'].includes(norm(m.status)) && (!pending || m.id !== pending.id));

      const selected = [];
      if (pending) selected.push(pending);
      if (ongoing) selected.push(ongoing);
      if (selected.length < 2) {
        for (const m of missions) {
          if (selected.length >= 2) break;
          if (!selected.find(x => x.id === m.id)) selected.push(m);
        }
      }

      return (
        <View>
          {selected.map((m) => (
            <View key={String(m.id)}>
              {renderMissionCard(m)}
            </View>
          ))}
        </View>
      );
    }

    // Fallback to single mission field
    return renderMissionCard(single);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={green.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserAndData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Welcome back, {currentUser?.name || 'Soldier'}{currentUser?.unit ? ` (${currentUser.unit})` : ''}
          </Text>
        </View>

        {/* Live Health Vitals Section */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="heart" size={20} color="#F44336" />
              <Text style={styles.sectionTitle}>Live Health Vitals</Text>
            </View>
            <View style={styles.vitalsGrid}>
              {renderVitalCard(
                'Blood Pressure',
                healthData.vitals?.blood_pressure_systolic && healthData.vitals?.blood_pressure_diastolic
                  ? `${healthData.vitals.blood_pressure_systolic}/${healthData.vitals.blood_pressure_diastolic}`
                  : healthData.vitals?.blood_pressure,
                ' mmHg',
                healthData.vitals?.status?.blood_pressure
              )}
              {renderVitalCard(
                'SpO2',
                healthData.vitals?.spo2,
                '%',
                healthData.vitals?.status?.spo2
              )}
              {renderVitalCard(
                'Heart Rate',
                healthData.vitals?.heart_rate,
                ' bpm',
                healthData.vitals?.status?.heart_rate
              )}
              {renderVitalCard(
                'Temperature',
                healthData.vitals?.temperature,
                ' °C',
                healthData.vitals?.status?.temperature
              )}
            </View>
            <Text style={styles.lastUpdated}>
              Last updated: {healthData.vitals?.recorded_at
                ? new Date(healthData.vitals.recorded_at).toLocaleString()
                : 'Never'
              }
            </Text>
          </Card.Content>
        </Card>

        {/* Health Profile Metrics Section */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="fitness" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Health Profile Metrics</Text>
            </View>
            <View style={styles.metricsGrid}>
              {renderHealthMetricCard(
                'Heart Rate',
                healthData.profile?.heart_rate,
                ' bpm',
                healthData.profile?.status?.heart_rate
              )}
              {renderHealthMetricCard(
                'Temperature',
                healthData.profile?.temperature,
                ' °C',
                healthData.profile?.status?.temperature
              )}
            </View>
            <Text style={styles.lastUpdated}>
              Last updated: {healthData.profile?.last_updated
                ? new Date(healthData.profile.last_updated).toLocaleString()
                : 'Never'
              }
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: green.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  sectionCard: {
    margin: 16,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vitalCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  vitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  vitalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vitalStatus: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  metricStatus: {
    fontSize: 9,
    fontWeight: '600',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  missionCard: {
    margin: 16,
    elevation: 3,
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  missionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  noMissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  missionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  missionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  missionDetails: {
    marginBottom: 16,
  },
  missionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  missionDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  missionDetailValue: {
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  priorityBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewMissionButton: {
    backgroundColor: green.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewMissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 8,
  },
});
