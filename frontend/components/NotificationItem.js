import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';

const NotificationItem = ({ 
  notification, 
  onPress, 
  index = 0,
  style 
}) => {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

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

  const getIconName = (type) => {
    switch (type) {
      case 'emergency':
        return 'warning';
      case 'warning':
        return 'alert-circle';
      case 'info':
        return 'information-circle';
      case 'offline':
        return 'cloud-offline';
      case 'online':
        return 'wifi';
      case 'zone_warning':
        return 'map';
      case 'zone_breach':
        return 'exit';
      default:
        return 'notifications';
    }
  };

  const getStatusColor = (type) => {
    switch (type) {
      case 'emergency':
        return '#EF4444';
      case 'warning':
      case 'zone_warning':
        return '#F59E0B';
      case 'info':
        return '#3B82F6';
      case 'offline':
      case 'zone_breach':
        return '#EF4444';
      case 'online':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getBackgroundColor = (type) => {
    switch (type) {
      case 'emergency':
        return '#FEF2F2';
      case 'warning':
      case 'zone_warning':
        return '#FFFBEB';
      case 'info':
        return '#EFF6FF';
      case 'critical':
        return '#FEF2F2';
      case 'high':
        return '#FFF7ED';
      case 'medium':
        return '#FFFBEB';
      case 'low':
        return '#ECFDF5';
      case 'offline':
      case 'zone_breach':
        return '#FEF2F2';
      case 'online':
        return '#ECFDF5';
      default:
        return '#F9FAFB';
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Unknown time';
    }
  };

  const getPriorityIndicator = (priority) => {
    if (!priority || priority === 'normal') return null;
    
    const priorityColors = {
      low: '#10B981',
      high: '#F59E0B',
      urgent: '#EF4444',
    };

    return (
      <View style={[styles.priorityIndicator, { backgroundColor: priorityColors[priority] }]} />
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(notification.type),
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
        !notification.read && styles.unreadContainer,
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => onPress(notification)}
        activeOpacity={0.7}
      >
        {/* Priority Indicator */}
        {getPriorityIndicator(notification.priority)}
        
        {/* Icon Container */}
        <View 
          style={[
            styles.iconContainer, 
            { backgroundColor: getStatusColor(notification.type) + '20' }
          ]}
        >
          <Icon 
            name={getIconName(notification.type)} 
            size={20} 
            color={getStatusColor(notification.type)} 
          />
        </View>
        
        {/* Text Content */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text 
              style={[
                styles.title,
                !notification.read && styles.unreadTitle
              ]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            {!notification.read && <View style={styles.unreadDot} />}
          </View>
          
          <Text 
            style={styles.message} 
            numberOfLines={2}
          >
            {notification.message}
          </Text>
          
          <View style={styles.metaRow}>
            <Text style={styles.timestamp}>
              {formatTimestamp(notification.timestamp)}
            </Text>
            {notification.source === 'alert' && notification.severity ? (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>
                  {String(notification.severity).toUpperCase()}
                </Text>
              </View>
            ) : notification.category ? (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{notification.category}</Text>
              </View>
            ) : null}
          </View>
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
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  unreadContainer: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  priorityIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  categoryTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  chevron: {
    marginLeft: 8,
  },
});

export default NotificationItem;
