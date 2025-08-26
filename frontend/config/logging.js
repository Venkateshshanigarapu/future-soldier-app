// Logging configuration for the app
export const LOGGING_CONFIG = {
  // Global log level: 'debug', 'info', 'warn', 'error', 'silent'
  LOG_LEVEL: __DEV__ ? 'info' : 'warn',
  
  // Specific module logging controls
  MODULES: {
    // Background location service
    BACKGROUND_LOCATION: {
      enabled: true,
      level: 'warn', // Only show warnings and errors
      throttleLocationUpdates: true, // Throttle location update logs
      throttleInterval: 30000, // 30 seconds
    },
    
    // Firebase notifications
    FIREBASE: {
      enabled: true,
      level: 'info',
      throttleTokenUpdates: true,
      throttleInterval: 60000, // 1 minute
    },
    
    // API calls
    API: {
      enabled: true,
      level: 'warn', // Only show warnings and errors
      logRequests: false, // Don't log every API request
      logResponses: false, // Don't log every API response
    },
    
    // Socket connections
    SOCKET: {
      enabled: true,
      level: 'warn',
      logReconnections: false, // Don't log every reconnection attempt
    },
    
    // General app logs
    APP: {
      enabled: true,
      level: 'info',
    }
  },
  
  // Throttling settings
  THROTTLING: {
    LOCATION_UPDATES: 30000, // 30 seconds
    API_CALLS: 10000, // 10 seconds
    NOTIFICATIONS: 15000, // 15 seconds
    TOKEN_UPDATES: 60000, // 1 minute
  },
  
  // Development overrides
  DEVELOPMENT: {
    SHOW_DEBUG_LOGS: __DEV__,
    SHOW_PERFORMANCE_LOGS: false,
    SHOW_NETWORK_LOGS: false,
  }
};

// Helper function to check if logging is enabled for a module
export const isLoggingEnabled = (moduleName, level = 'info') => {
  const module = LOGGING_CONFIG.MODULES[moduleName];
  if (!module || !module.enabled) return false;
  
  const levels = ['debug', 'info', 'warn', 'error'];
  const moduleLevel = levels.indexOf(module.level);
  const requestedLevel = levels.indexOf(level);
  
  return requestedLevel >= moduleLevel;
};

// Helper function to get throttle interval for a module
export const getThrottleInterval = (moduleName) => {
  const module = LOGGING_CONFIG.MODULES[moduleName];
  return module?.throttleInterval || LOGGING_CONFIG.THROTTLING[moduleName] || 30000;
};
