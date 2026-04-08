import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNotifications } from '../NotificationContext';

const NotificationBadge = ({ size = 'medium', style }) => {
  const { unreadCount } = useNotifications();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (unreadCount > 0) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [unreadCount, scaleAnim, opacityAnim]);

  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return { width: 16, height: 16, fontSize: 10 };
      case 'large':
        return { width: 24, height: 24, fontSize: 14 };
      default: // medium
        return { width: 20, height: 20, fontSize: 12 };
    }
  };

  const badgeSize = getBadgeSize();

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          width: badgeSize.width,
          height: badgeSize.height,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            fontSize: badgeSize.fontSize,
          },
        ]}
        numberOfLines={1}
      >
        {unreadCount > 99 ? '99+' : unreadCount.toString()}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
      badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#F44336',
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 16,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
});

export default NotificationBadge; 