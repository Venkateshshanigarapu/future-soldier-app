import { apiService } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ZoneBreachService {
  constructor() {
    this.lastCheckedLocation = null;
    this.breachCheckInterval = null;
    this.isMonitoring = false;
  }

  /**
   * Start monitoring for zone breaches
   * This should be called when the app starts or when location tracking begins
   */
  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('[ZoneBreachService] Starting zone breach monitoring');
    
    // Check for breaches every 30 seconds when location updates
    this.breachCheckInterval = setInterval(() => {
      this.checkCurrentLocationForBreaches();
    }, 30000);
  }

  /**
   * Stop monitoring for zone breaches
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    console.log('[ZoneBreachService] Stopping zone breach monitoring');
    
    if (this.breachCheckInterval) {
      clearInterval(this.breachCheckInterval);
      this.breachCheckInterval = null;
    }
  }

  /**
   * Check if current location has any zone breaches
   * This should be called whenever location updates
   */
  async checkLocationForBreaches(latitude, longitude, heading = null) {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (!userData) {
        console.log('[ZoneBreachService] No user data found, skipping breach check');
        return;
      }

      const user = JSON.parse(userData);
      if (!user.id) {
        console.log('[ZoneBreachService] No user ID found, skipping breach check');
        return;
      }

      // Only check if location has changed significantly (more than 10 meters)
      if (this.lastCheckedLocation) {
        const distance = this.calculateDistance(
          this.lastCheckedLocation.latitude,
          this.lastCheckedLocation.longitude,
          latitude,
          longitude
        );
        
        if (distance < 10) {
          console.log('[ZoneBreachService] Location change too small, skipping breach check');
          return;
        }
      }

      this.lastCheckedLocation = { latitude, longitude };

      console.log('[ZoneBreachService] Checking for zone breaches at:', latitude, longitude);

      const response = await apiService.checkZoneBreach({
        user_id: user.id,
        latitude,
        longitude,
        heading
      });
      
      console.log('[ZoneBreachService] API response:', response);

      if (response.transitions > 0) {
        console.log(`[ZoneBreachService] Found ${response.transitions} zone transitions:`, response.details);
        
        // Store transition information for UI display
        await this.storeBreachInfo(response);
        
        return response;
      } else {
        console.log('[ZoneBreachService] No zone transitions detected');
        return null;
      }

    } catch (error) {
      console.error('[ZoneBreachService] Error checking zone breaches:', error);
      return null;
    }
  }

  /**
   * Check current location for breaches (used by interval)
   */
  async checkCurrentLocationForBreaches() {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (!userData) return;

      const user = JSON.parse(userData);
      if (!user.id) return;

      // Get last known location from storage
      const lastLocation = await AsyncStorage.getItem('lastKnownLocation');
      if (!lastLocation) return;

      const location = JSON.parse(lastLocation);
      await this.checkLocationForBreaches(location.latitude, location.longitude, location.heading);
    } catch (error) {
      console.error('[ZoneBreachService] Error in interval breach check:', error);
    }
  }

  /**
   * Store transition information for UI display
   */
  async storeBreachInfo(transitionResponse) {
    try {
      const transitionInfo = {
        timestamp: new Date().toISOString(),
        transitions: transitionResponse.transitions,
        details: transitionResponse.details,
        user: transitionResponse.user
      };

      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem('lastTransitionInfo', JSON.stringify(transitionInfo));
      
      console.log('[ZoneBreachService] Transition info stored:', transitionInfo);
    } catch (error) {
      console.error('[ZoneBreachService] Error storing transition info:', error);
    }
  }

  /**
   * Get stored transition information
   */
  async getStoredBreachInfo() {
    try {
      const transitionInfo = await AsyncStorage.getItem('lastTransitionInfo');
      return transitionInfo ? JSON.parse(transitionInfo) : null;
    } catch (error) {
      console.error('[ZoneBreachService] Error getting stored transition info:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get breach statistics for dashboard
   */
  async getBreachStatistics() {
    try {
      const response = await apiService.getBreachStatistics();
      return response;
    } catch (error) {
      console.error('[ZoneBreachService] Error getting breach statistics:', error);
      return null;
    }
  }

  /**
   * Acknowledge a breach (mark as resolved)
   */
  async acknowledgeBreach(breachId) {
    try {
      const response = await apiService.acknowledgeBreach(breachId);
      return response;
    } catch (error) {
      console.error('[ZoneBreachService] Error acknowledging breach:', error);
      return null;
    }
  }
}

// Create singleton instance
const zoneBreachService = new ZoneBreachService();
export default zoneBreachService;
