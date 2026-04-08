import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import i18n from '../utils/i18n';
import { enUS, hi, ta as taLocale } from 'date-fns/locale';

const getDateFnsLocale = () => {
  const language = (i18n.locale || 'en').split('-')[0];
  switch (language) {
    case 'hi':
      return hi;
    case 'ta':
      return taLocale;
    default:
      return enUS;
  }
};

const AssignmentItem = ({ 
  assignment, 
  onPress, 
  onStatusChange,
  index = 0,
  style 
}) => {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const dateLocale = getDateFnsLocale();

  const getPriorityLabel = (priority) => {
    const normalized = (priority || '').toLowerCase();
    switch (normalized) {
      case 'urgent':
        return i18n.t('assignmentPriority.urgent');
      case 'high':
        return i18n.t('assignmentPriority.high');
      case 'medium':
        return i18n.t('assignmentPriority.medium');
      case 'low':
        return i18n.t('assignmentPriority.low');
      default:
        return priority || '-';
    }
  };

  const getStatusLabel = (status) => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'pending':
        return i18n.t('pending');
      case 'in_progress':
      case 'in-progress':
      case 'in progress':
        return i18n.t('inProgress');
      case 'completed':
        return i18n.t('completed');
      case 'cancelled':
        return i18n.t('cancelled');
      default:
        return status || '-';
    }
  };

  useEffect(() => {
    // Staggered animation for list items
    const delay = index * 100;
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, slideAnim, opacityAnim, scaleAnim]);

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
    switch ((priority || '').toLowerCase()) {
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

  const getPriorityIcon = (priority) => {
    switch ((priority || '').toLowerCase()) {
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

  const getStatusIcon = (status) => {
    switch ((status || '').toLowerCase()) {
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

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null;
    try {
      const date = new Date(dueDate);
      return formatDistanceToNow(date, { addSuffix: true, locale: dateLocale });
    } catch (e) {
      return i18n.t('invalidDate');
    }
  };

  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && assignment.status !== 'completed';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
        isOverdue && styles.overdueContainer,
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => onPress(assignment)}
        activeOpacity={0.7}
      >
        {/* Priority Indicator */}
        <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(assignment.priority) }]} />
        
        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {assignment.title}
              </Text>
              <View style={styles.badgesContainer}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(assignment.priority) + '20' }]}>
                  <Icon name={getPriorityIcon(assignment.priority)} size={12} color={getPriorityColor(assignment.priority)} />
                  <Text style={[styles.badgeText, { color: getPriorityColor(assignment.priority) }]}>
                    {getPriorityLabel(assignment.priority)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(assignment.status) + '20' }]}>
                  <Icon name={getStatusIcon(assignment.status)} size={12} color={getStatusColor(assignment.status)} />
                  <Text style={[styles.badgeText, { color: getStatusColor(assignment.status) }]}>
                    {getStatusLabel(assignment.status)}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Status Change Button */}
            {assignment.status !== 'completed' && assignment.status !== 'cancelled' && (
              <TouchableOpacity
                style={[styles.statusButton, { backgroundColor: getStatusColor(assignment.status) + '20' }]}
                onPress={() => onStatusChange(assignment)}
                activeOpacity={0.7}
              >
                <Icon name="ellipsis-horizontal" size={16} color={getStatusColor(assignment.status)} />
              </TouchableOpacity>
            )}
          </View>

          {/* Description */}
          {assignment.description && (
            <Text style={styles.description} numberOfLines={2}>
              {assignment.description}
            </Text>
          )}

          {/* Meta Information */}
          <View style={styles.metaRow}>
            {/* Due Date */}
            {assignment.due_date && (
              <View style={styles.metaItem}>
                <Icon name="calendar" size={14} color="#6B7280" />
                <Text style={[styles.metaText, isOverdue && styles.overdueText]}>
                  {isOverdue ? i18n.t('overdue') : formatDueDate(assignment.due_date)}
                </Text>
                {isOverdue && (
                  <View style={styles.overdueDot} />
                )}
              </View>
            )}

            {/* Assigned To */}
            {assignment.assigned_to_username && (
              <View style={styles.metaItem}>
                <Icon name="person" size={14} color="#6B7280" />
                <Text style={styles.metaText}>
                  {assignment.assigned_to_username}
                </Text>
              </View>
            )}

            {/* Created Date */}
            <View style={styles.metaItem}>
              <Icon name="time" size={14} color="#6B7280" />
              <Text style={styles.metaText}>
                {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true, locale: dateLocale })}
              </Text>
            </View>
          </View>

          {/* Progress Bar for In Progress */}
          {assignment.status === 'in_progress' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '60%' }]} />
              </View>
              <Text style={styles.progressText}>{i18n.t('inProgress')}</Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <Icon 
          name="chevron-forward" 
          size={16} 
          color="#9CA3AF" 
          style={styles.chevron}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  overdueContainer: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  priorityIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  mainContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 20,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  overdueText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  overdueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  chevron: {
    marginRight: 16,
  },
});

export default AssignmentItem;
