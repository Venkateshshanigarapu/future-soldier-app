import { apiService } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  ZONE_BREACH: 'zone-breach',
  EMERGENCY: 'emergency',
  ASSIGNMENT: 'assignment',
  SYSTEM: 'system'
};

// Notification priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

// Notification categories
export const NOTIFICATION_CATEGORIES = {
  SYSTEM: 'system',
  ZONE: 'zone',
  ASSIGNMENT: 'assignment',
  EMERGENCY: 'emergency'
};

/**
 * Notification Service for Future Soldiers APK
 * Handles all notification operations including Firebase, local, and API calls
 */
class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
  }

  /**
   * Initialize the notification service
   */
  async initialize() {
    try {
      // Get current user
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        this.currentUser = JSON.parse(userData);
      }

      this.isInitialized = true;
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  /**
   * Get current User Login ID
   */
  getCurrentUserId() {
    return this.currentUser?.id;
  }

  /**
   * Get user's notification preferences
   */
  async getUserPreferences() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.get(`/users/${userId}/notification-preferences`);
      return response;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      // Return default preferences
      return {
        zone_alerts: true,
        assignment_alerts: true,
        emergency_alerts: true,
        system_notifications: true,
        push_enabled: true,
        email_enabled: false
      };
    }
  }

  /**
   * Update user's notification preferences
   */
  async updateUserPreferences(preferences) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.put(`/users/${userId}/notification-preferences`, preferences);
      return response;
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * Get all notifications for current user
   */
  async getNotifications(options = {}) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const queryParams = new URLSearchParams({
        userId,
        ...options
      });

      const response = await apiService.get(`/notifications?${queryParams}`);
      return response;
    } catch (error) {
      console.error('Failed to get notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return 0;

      const response = await apiService.get(`/notifications/unread-count/${userId}`);
      return response.unreadCount || 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      const response = await apiService.put(`/notifications/${notificationId}/read`);
      return response;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.put(`/notifications/${userId}/read-all`);
      return response;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Clear read notifications
   */
  async clearReadNotifications() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.delete(`/notifications/${userId}/clear-read`);
      return response;
    } catch (error) {
      console.error('Failed to clear read notifications:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const notification = {
        userId,
        title: 'Test Notification',
        message: 'This is a test notification from the Future Soldiers APK',
        type: NOTIFICATION_TYPES.INFO,
        category: NOTIFICATION_CATEGORIES.SYSTEM,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        source: 'test',
        data: { test: true }
      };

      const response = await apiService.post('/notifications', notification);
      return response;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  /**
   * Send zone breach alert
   */
  async sendZoneBreachAlert(zoneData) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const alertData = {
        zoneId: zoneData.zoneId,
        userId: zoneData.userId || userId,
        breachType: zoneData.breachType, // 'entry', 'exit', 'unauthorized'
        latitude: zoneData.latitude,
        longitude: zoneData.longitude
      };

      const response = await apiService.post('/alerts/zone-breach', alertData);
      return response;
    } catch (error) {
      console.error('Failed to send zone breach alert:', error);
      throw error;
    }
  }

  /**
   * Send emergency alert
   */
  async sendEmergencyAlert(emergencyData) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const alertData = {
        title: emergencyData.title,
        message: emergencyData.message,
        severity: emergencyData.severity, // 'low', 'medium', 'high', 'critical'
        affectedUnits: emergencyData.affectedUnits || [],
        affectedUsers: emergencyData.affectedUsers || [],
        latitude: emergencyData.latitude,
        longitude: emergencyData.longitude,
        createdBy: userId
      };

      const response = await apiService.post('/alerts', alertData);
      return response;
    } catch (error) {
      console.error('Failed to send emergency alert:', error);
      throw error;
    }
  }

  /**
   * Send assignment notification
   */
  async sendAssignmentNotification(assignmentData) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const notification = {
        userId: assignmentData.assignedTo,
        title: `New Assignment: ${assignmentData.title}`,
        message: assignmentData.description || 'You have been assigned a new task',
        type: NOTIFICATION_TYPES.ASSIGNMENT,
        category: NOTIFICATION_CATEGORIES.ASSIGNMENT,
        priority: assignmentData.priority === 'urgent' ? NOTIFICATION_PRIORITIES.HIGH : NOTIFICATION_PRIORITIES.NORMAL,
        source: 'system',
        data: {
          assignmentId: assignmentData.id,
          title: assignmentData.title,
          description: assignmentData.description,
          priority: assignmentData.priority,
          dueDate: assignmentData.dueDate
        }
      };

      const response = await apiService.post('/notifications', notification);
      return response;
    } catch (error) {
      console.error('Failed to send assignment notification:', error);
      throw error;
    }
  }

  /**
   * Get all alerts
   */
  async getAlerts(options = {}) {
    try {
      const queryParams = new URLSearchParams(options);
      const response = await apiService.get(`/alerts?${queryParams}`);
      return response;
    } catch (error) {
      console.error('Failed to get alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats() {
    try {
      const response = await apiService.get('/alerts/stats/summary');
      return response;
    } catch (error) {
      console.error('Failed to get alert stats:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.put(`/alerts/${alertId}/acknowledge`, {
        acknowledgedBy: userId
      });
      return response;
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, resolutionNotes = '') {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.put(`/alerts/${alertId}/resolve`, {
        resolvedBy: userId,
        resolutionNotes
      });
      return response;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Show local notification
   */
  async showLocalNotification(title, body, data = {}) {
    try {
      // Determine channel based on notification type
      let channelId = 'default';
      if (data.type === 'zone-breach') {
        channelId = 'zone-breach';
      } else if (data.type === 'emergency') {
        channelId = 'emergency';
      } else if (data.type === 'assignment') {
        channelId = 'assignment';
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: data.type === 'emergency' ? 'high' : 'default',
        },
        trigger: null, // Show immediately
      });

      console.log('Local notification scheduled:', { title, body, channelId });
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  async checkNotificationPermissions() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to check notification permissions:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestNotificationPermissions() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings() {
    try {
      const permissions = await this.checkNotificationPermissions();
      const preferences = await this.getUserPreferences();
      
      return {
        permissions,
        preferences,
        canSendNotifications: permissions && preferences.push_enabled
      };
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      return {
        permissions: false,
        preferences: {},
        canSendNotifications: false
      };
    }
  }

  /**
   * Update FCM token on server
   */
  async updateFCMToken(fcmToken, expoToken) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not logged in');

      const response = await apiService.post('/users/update-token', {
        userId,
        fcmToken,
        expoToken,
        deviceType: 'mobile'
      });

      return response;
    } catch (error) {
      console.error('Failed to update FCM token:', error);
      throw error;
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
