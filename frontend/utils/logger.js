// Logger utility to control debug output and reduce console spam
import { LOGGING_CONFIG, isLoggingEnabled, getThrottleInterval } from '../config/logging';

class Logger {
  constructor() {
    this.isDebugMode = __DEV__; // Only debug in development
    this.logLevel = LOGGING_CONFIG.LOG_LEVEL;
    this.suppressedLogs = new Set();
  }

  // Set log level: 'debug', 'info', 'warn', 'error'
  setLogLevel(level) {
    this.logLevel = level;
  }

  // Suppress specific log messages to prevent spam
  suppressLog(key, duration = 60000) { // Default: 1 minute
    this.suppressedLogs.add(key);
    setTimeout(() => {
      this.suppressedLogs.delete(key);
    }, duration);
  }

  // Check if log should be suppressed
  isSuppressed(key) {
    return this.suppressedLogs.has(key);
  }

  // Debug logging (only in development)
  debug(message, data = null) {
    if (this.logLevel === 'debug' && this.isDebugMode && !this.isSuppressed(message)) {
      console.log(`🔍 [DEBUG] ${message}`, data || '');
    }
  }

  // Info logging
  info(message, data = null) {
    if (['debug', 'info'].includes(this.logLevel) && !this.isSuppressed(message)) {
      console.log(`ℹ️ [INFO] ${message}`, data || '');
    }
  }

  // Warning logging
  warn(message, data = null) {
    if (['debug', 'info', 'warn'].includes(this.logLevel)) {
      console.warn(`⚠️ [WARN] ${message}`, data || '');
    }
  }

  // Error logging (always shown)
  error(message, data = null) {
    console.error(`❌ [ERROR] ${message}`, data || '');
  }

  // Success logging
  success(message, data = null) {
    if (['debug', 'info'].includes(this.logLevel)) {
      console.log(`✅ [SUCCESS] ${message}`, data || '');
    }
  }

  // Location update logging (throttled)
  locationUpdate(updateData) {
    if (!isLoggingEnabled('BACKGROUND_LOCATION', 'info')) return;
    
    const key = 'location_update';
    if (!this.isSuppressed(key)) {
      this.info('Location update', updateData);
      this.suppressLog(key, getThrottleInterval('LOCATION_UPDATES'));
    }
  }

  // API call logging (throttled)
  apiCall(endpoint, method) {
    const key = `api_${method}_${endpoint}`;
    if (!this.isSuppressed(key)) {
      this.debug(`${method.toUpperCase()} ${endpoint}`);
      this.suppressLog(key, 10000); // Suppress for 10 seconds
    }
  }

  // Notification logging (throttled)
  notification(type, title) {
    const key = `notification_${type}`;
    if (!this.isSuppressed(key)) {
      this.info(`Notification: ${type} - ${title}`);
      this.suppressLog(key, 15000); // Suppress for 15 seconds
    }
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
