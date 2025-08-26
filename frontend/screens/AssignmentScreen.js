import React, { useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  RefreshControl,
  Platform,
  TextInput
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import assignmentService from '../services/assignmentService';
import { socket } from '../services/api';
import AssignmentItem from '../components/AssignmentItem';
import EmptyState from '../components/EmptyState';
import FilterChip from '../components/FilterChip';

const { width, height } = Dimensions.get('window');

export default function AssignmentScreen({ navigation }) {
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // Animation values
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Collapsing header interpolations
  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [12, 4],
    extrapolate: 'clamp',
  });
  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [8, 2],
    extrapolate: 'clamp',
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });
  const iconScale = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });
  const countOpacity = scrollY.interpolate({
    inputRange: [0, 40, 80],
    outputRange: [1, 0.85, 0.75], // keep readable; avoid fully transparent text
    extrapolate: 'clamp',
  });

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          setUserRole(user.role);
          setUserId(user.id || user.serviceId);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
  }, []);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const options = {};
      
      // Fetch ALL assignments (no user filter)
      const [assignmentsData, statsData] = await Promise.all([
        assignmentService.getAssignments(options),
        assignmentService.getAssignmentStats(null)
      ]);
      
      setAssignments(assignmentsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading assignments:', error);
      Alert.alert('Error', 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load assignments on mount
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Realtime updates: listen for create/update/delete and refresh
  useEffect(() => {
    const onCreated = () => loadAssignments();
    const onUpdated = () => loadAssignments();
    const onDeleted = () => loadAssignments();
    try {
      socket.on('assignmentCreated', onCreated);
      socket.on('assignmentUpdated', onUpdated);
      socket.on('assignmentDeleted', onDeleted);
    } catch (e) {}
    return () => {
      try {
        socket.off('assignmentCreated', onCreated);
        socket.off('assignmentUpdated', onUpdated);
        socket.off('assignmentDeleted', onDeleted);
      } catch (e) {}
    };
  }, [loadAssignments]);

  // Filter assignments based on current filter and search
  useEffect(() => {
    let filtered = assignments;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(assignment => assignment.status === filter);
    }

    // Apply search filter (search multiple fields, case-insensitive)
    const rawQuery = searchQuery || '';
    const trimmed = rawQuery.trim().toLowerCase();
    if (trimmed.length > 0) {
      filtered = filtered.filter(assignment => {
        const haystack = [
          assignment.title,
          assignment.description,
          assignment.assigned_commander,
          assignment.type,
          assignment.priority,
          assignment.sector,
          assignment.destination,
          assignment.pickup_point,
          assignment.objectives,
          assignment.status,
        ]
          .filter(Boolean)
          .map(v => String(v).toLowerCase())
          .join(' ');
        return haystack.includes(trimmed);
      });
    }

    setFilteredAssignments(filtered);
  }, [assignments, filter, searchQuery]);

  // Animate search bar visibility
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: showSearch ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showSearch, searchAnim]);

  // Animate components on mount
  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(statsAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(filterAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAssignments();
    setRefreshing(false);
  };

  const handleAssignmentPress = (assignment) => {
    // Navigate to assignment detail screen
    navigation.navigate('AssignmentDetail', { assignment });
  };

  const handleStatusChange = (assignment) => {
    const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled'];
    const currentIndex = statusOptions.indexOf(assignment.status);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
    
    Alert.alert(
      'Update Status',
      `Change status to "${nextStatus.replace('_', ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              await assignmentService.updateAssignmentStatus(assignment.id, nextStatus);
              await loadAssignments(); // Reload to get updated data
            } catch (error) {
              console.error('Error updating status:', error);
              Alert.alert('Error', 'Failed to update status');
            }
          }
        }
      ]
    );
  };

  const renderAssignmentItem = ({ item, index }) => (
    <AssignmentItem
      assignment={item}
      onPress={handleAssignmentPress}
      onStatusChange={handleStatusChange}
      index={index}
    />
  );

  const renderFilterChip = (filterType, label, icon) => (
    <FilterChip
      label={label}
      icon={icon}
      isActive={filter === filterType}
      onPress={() => setFilter(filterType)}
      compact
    />
  );

  const renderStatsCard = (title, value, color, icon) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsCardHeader}>
        <Icon name={icon} size={20} color={color} />
        <Text style={styles.statsCardTitle}>{title}</Text>
      </View>
      <Text style={[styles.statsCardValue, { color }]}>{value}</Text>
    </View>
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowSearch(!showSearch)}
            activeOpacity={0.7}
          >
            <Icon name={showSearch ? "close" : "search"} size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, showSearch]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Premium Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            transform: [{ translateY: headerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, 0]
            })}],
            opacity: headerAnim,
            // Padding animation is not supported by native driver; apply via animated wrapper
          }
        ]}
      >
        <Animated.View style={[
          styles.headerTop,
          { paddingTop: headerPaddingTop, paddingBottom: headerPaddingBottom }
        ]}>
          <View style={styles.headerLeft}>
            <Animated.View style={[styles.headerIconContainer, { transform: [{ scale: iconScale }] }]}>
              <Icon name="list" size={24} color="#10B981" />
            </Animated.View>
            <View style={styles.headerTextContainer}>
              <Animated.Text style={[styles.headerSubtitle, { transform: [{ translateY: titleTranslateY }] }]}>
                Assignments
              </Animated.Text>
              <Animated.Text style={[styles.headerCount, { opacity: countOpacity }]}>
                {filteredAssignments.length} {filteredAssignments.length === 1 ? 'assignment' : 'assignments'}
              </Animated.Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Search Bar */}
      {showSearch && (
        <Animated.View 
          style={[
            styles.searchContainer,
            {
              transform: [{ translateY: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-30, 0]
              })}],
              opacity: searchAnim
            }
          ]}
        >
          <View style={styles.searchInputContainer}>
            <Icon name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search assignments"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
      
      {/* Statistics Cards */}
      <Animated.View 
        style={[
          styles.statsContainer,
          {
            transform: [{ translateY: statsAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-30, 0]
            })}],
            opacity: statsAnim
          }
        ]}
      >
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { title: 'Total', value: stats.total || 0, color: '#3B82F6', icon: 'list' },
            { title: 'Pending', value: stats.pending || 0, color: '#F59E0B', icon: 'time' },
            { title: 'In Progress', value: stats.in_progress || 0, color: '#3B82F6', icon: 'play' },
            { title: 'Completed', value: stats.completed || 0, color: '#10B981', icon: 'checkmark-circle' },
            { title: 'Overdue', value: stats.overdue || 0, color: '#EF4444', icon: 'warning' },
          ]}
          renderItem={({ item }) => renderStatsCard(item.title, item.value, item.color, item.icon)}
          keyExtractor={item => item.title}
          contentContainerStyle={styles.statsList}
        />
      </Animated.View>
      
      {/* Filter Section */}
      <Animated.View 
        style={[
          styles.filterContainer,
          {
            transform: [{ translateY: filterAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0]
            })}],
            opacity: filterAnim
          }
        ]}
      >
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filter by Status</Text>
          <View style={styles.filterCount}>
            <Text style={styles.filterCountText}>{filteredAssignments.length}</Text>
          </View>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { type: 'all', label: 'All', icon: 'apps' },
            { type: 'pending', label: 'Pending', icon: 'time' },
            { type: 'in_progress', label: 'In Progress', icon: 'play' },
            { type: 'completed', label: 'Completed', icon: 'checkmark-circle' },
            { type: 'cancelled', label: 'Cancelled', icon: 'close-circle' }
          ]}
          renderItem={({ item }) => renderFilterChip(item.type, item.label, item.icon)}
          keyExtractor={item => item.type}
          contentContainerStyle={styles.filterList}
        />
      </Animated.View>

      {/* Assignments List */}
      <Animated.FlatList
        data={filteredAssignments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderAssignmentItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#10B981']}
            tintColor="#10B981"
            progressBackgroundColor="#FFFFFF"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="list"
            title="No Assignments Found"
            subtitle={searchQuery ? "Try adjusting your search or filters" : "You're all caught up! New assignments will appear here."}
            iconColor="#D1D5DB"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
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
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statsList: {
    paddingHorizontal: 24,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    marginRight: 8,
    minWidth: 84,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statsCardTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  statsCardValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  filterCount: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterList: {
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
});
