import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import assignmentService from '../services/assignmentService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function AssignmentDetailScreen({ route, navigation }) {
  const { assignment } = route.params;
  const [currentAssignment, setCurrentAssignment] = useState(assignment);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  // Load current user role
  useEffect(() => {
    const loadRole = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          setUserRole((user.role || '').toLowerCase());
        }
      } catch (e) {}
    };
    loadRole();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'in_progress':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#EF4444';
      case 'high':
        return '#F59E0B';
      case 'medium':
        return '#3B82F6';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'in_progress':
        return 'play';
      case 'completed':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'flash';
      case 'high':
        return 'trending-up';
      case 'medium':
        return 'remove';
      case 'low':
        return 'trending-down';
      default:
        return 'help-circle';
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setLoading(true);
      const updatedAssignment = await assignmentService.updateAssignmentStatus(
        currentAssignment.id, 
        newStatus
      );
      setCurrentAssignment(updatedAssignment);
      Alert.alert('Success', 'Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const showStatusOptions = () => {
    const statusOptions = [
      { value: 'pending', label: 'Pending', icon: 'time' },
      { value: 'in_progress', label: 'In Progress', icon: 'play' },
      { value: 'completed', label: 'Completed', icon: 'checkmark-circle' },
      { value: 'cancelled', label: 'Cancelled', icon: 'close-circle' },
    ];

    Alert.alert(
      'Update Status',
      'Select new status:',
      statusOptions.map(option => ({
        text: option.label,
        onPress: () => handleStatusChange(option.value),
      })).concat([
        { text: 'Cancel', style: 'cancel' }
      ])
    );
  };

  const isOverdue = currentAssignment.due_date && 
    new Date(currentAssignment.due_date) < new Date() && 
    currentAssignment.status !== 'completed';

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  const formatRelativeDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Invalid date';
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Assignment Details',
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={showStatusOptions}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Icon name="ellipsis-horizontal" size={24} color="#10B981" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, loading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <Animated.ScrollView
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{currentAssignment.title}</Text>
            <View style={styles.badgesContainer}>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(currentAssignment.priority) + '20' }]}>
                <Icon name={getPriorityIcon(currentAssignment.priority)} size={16} color={getPriorityColor(currentAssignment.priority)} />
                <Text style={[styles.badgeText, { color: getPriorityColor(currentAssignment.priority) }]}>
                  {currentAssignment.priority}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentAssignment.status) + '20' }]}>
                <Icon name={getStatusIcon(currentAssignment.status)} size={16} color={getStatusColor(currentAssignment.status)} />
                <Text style={[styles.badgeText, { color: getStatusColor(currentAssignment.status) }]}>
                  {currentAssignment.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
          
          {isOverdue && (
            <View style={styles.overdueWarning}>
              <Icon name="warning" size={20} color="#EF4444" />
              <Text style={styles.overdueText}>This assignment is overdue</Text>
            </View>
          )}
        </View>

        {/* Description Card */}
        {currentAssignment.description && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="document-text" size={20} color="#6B7280" />
              <Text style={styles.cardTitle}>Description</Text>
            </View>
            <Text style={styles.description}>{currentAssignment.description}</Text>
          </View>
        )}

        {/* Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="information-circle" size={20} color="#6B7280" />
            <Text style={styles.cardTitle}>Details</Text>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Icon name="person" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Assigned To:</Text>
              <Text style={styles.detailValue}>
                {currentAssignment.assigned_to_username || 'Unknown'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Icon name="person-circle" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Assigned By:</Text>
              <Text style={styles.detailValue}>
                {currentAssignment.assigned_by_username || 'Unknown'}
              </Text>
            </View>
          </View>

          {currentAssignment.due_date && (
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Icon name="calendar" size={16} color="#6B7280" />
                <Text style={styles.detailLabel}>Due Date:</Text>
                <Text style={[styles.detailValue, isOverdue && styles.overdueValue]}>
                  {formatDate(currentAssignment.due_date)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Icon name="time" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Created:</Text>
              <Text style={styles.detailValue}>
                {formatRelativeDate(currentAssignment.created_at)}
              </Text>
            </View>
          </View>

          {currentAssignment.updated_at && currentAssignment.updated_at !== currentAssignment.created_at && (
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Icon name="refresh" size={16} color="#6B7280" />
                <Text style={styles.detailLabel}>Last Updated:</Text>
                <Text style={styles.detailValue}>
                  {formatRelativeDate(currentAssignment.updated_at)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Location Card */}
        {currentAssignment.location_lat && currentAssignment.location_lng && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="location" size={20} color="#6B7280" />
              <Text style={styles.cardTitle}>Location</Text>
            </View>
            <Text style={styles.locationText}>
              {currentAssignment.location_lat}, {currentAssignment.location_lng}
            </Text>
            <TouchableOpacity style={styles.mapButton}>
              <Icon name="map" size={16} color="#10B981" />
              <Text style={styles.mapButtonText}>View on Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="settings" size={20} color="#6B7280" />
            <Text style={styles.cardTitle}>Actions</Text>
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryButton]}
              onPress={showStatusOptions}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Icon name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Update Status</Text>
            </TouchableOpacity>
            
            {userRole === 'commander' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => navigation.navigate('EditAssignment', { assignment: currentAssignment })}
                activeOpacity={0.7}
              >
                <Icon name="create" size={16} color="#6B7280" />
                <Text style={styles.secondaryButtonText}>Edit Assignment</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  titleContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 32,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  overdueText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  overdueValue: {
    color: '#EF4444',
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  mapButtonText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#10B981',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
});
