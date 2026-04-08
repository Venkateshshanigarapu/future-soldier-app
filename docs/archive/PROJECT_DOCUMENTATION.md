# 📚 Project Documentation - Future Soldiers APK

## Table of Contents
- [Zone Breach System Guide](#zone-breach-system-guide)
- [Soldier Health Dashboard](#soldier-health-dashboard)
- [Soldier Card UI Update & View More Functionality](#soldier-card-ui-update--view-more-functionality)
- [Registration Flow Fix Summary](#registration-flow-fix-summary)
- [Quick Setup Commands](#quick-setup-commands)
- [Push Notifications Guide](#push-notifications-guide)
- [Project Fixes Summary](#project-fixes-summary)
- [Login Security Update](#login-security-update)
- [HTTP Production Configuration Guide](#http-production-configuration-guide)
- [Hosting Setup Guide](#hosting-setup-guide)
- [Hosted Environment Fixes](#hosted-environment-fixes)
- [Firebase Setup Guide](#firebase-setup-guide)
- [Firebase Service Account Setup Guide](#firebase-service-account-setup-guide)

---

## Zone Breach System Guide
# Zone Breach Notification System - User Guide

## 🎯 What is Zone Breach Detection?

Zone breach detection is a safety feature that automatically monitors soldier locations and sends alerts when they leave their assigned operational zones or enter restricted areas.

## 🚨 How It Works

### For Soldiers:
- **Automatic Monitoring**: Your location is continuously tracked in the background
- **Zone Alerts**: You receive immediate notifications if you leave your assigned zone
- **Safety First**: Critical alerts help maintain operational security

### For Commanders:
- **Real-time Alerts**: Get instant notifications when any soldier breaches a zone
- **Multiple Notifications**: See all zone breaches in a dedicated section
- **Quick Response**: Take immediate action when needed

## 📱 User Interface

### Zone Breach Notifications Screen

The notifications screen now has **two separate sections**:

#### 1. 🚨 Zone Breach Alerts (Red Section)
- **Purpose**: Shows critical zone breach notifications
- **Color**: Red background to indicate urgency
- **Features**:
  - Collapsible section (tap arrow to expand/collapse)
  - Breach count badge
  - Detailed breach information
  - Action required indicators

#### 2. 📢 Other Notifications (Green Section)
- **Purpose**: Shows regular system notifications
- **Color**: Green background for normal operations
- **Features**:
  - Standard notification list
  - Filter options
  - Read/unread status

## 🔍 Understanding Zone Breach Notifications

### Notification Types:

#### 1. **Exit Breach** (Soldier left assigned zone)
- **Icon**: 🚶‍♂️ (walking person)
- **Severity**: High or Critical
- **Message**: "You have left zone [Zone Name]"

#### 2. **Unauthorized Entry** (Soldier entered restricted zone)
- **Icon**: ⚠️ (warning)
- **Severity**: Critical
- **Message**: "You have entered unauthorized zone [Zone Name]"

### Visual Indicators:

#### Severity Levels:
- 🔴 **CRITICAL**: Red badge - Immediate action required
- 🟠 **HIGH PRIORITY**: Orange badge - Important attention needed
- 🟡 **MEDIUM**: Yellow badge - Monitor situation
- 🟢 **LOW**: Green badge - Informational

#### Status Indicators:
- ⚪ **New Alert**: White dot - Unread notification
- 🟢 **Acknowledged**: Green dot - Notification has been read
- 🔴 **Action Required**: Red indicator - Needs your attention

## 🎛️ Filter Options

### Filter Categories:
1. **All**: Shows all notifications
2. **Unread Messages**: Shows only unread notifications
3. **Zone Breaches**: Shows only zone breach alerts
4. **Emergency**: Shows emergency notifications
5. **Warning**: Shows warning notifications
6. **Info**: Shows informational notifications

## 🧪 Testing the System

### Test Button Features:
- **Location**: Found in the test section of notifications
- **Purpose**: Simulate a zone breach for testing
- **Usage**: Tap "Test Zone Breach" button
- **Result**: Creates a test breach notification

### How to Test:
1. Open the Notifications screen
2. Scroll to the test section
3. Tap "Test Zone Breach" button
4. Check if zone breach notification appears
5. Verify both soldier and commander receive alerts

## 🔧 Technical Implementation

### Automatic Detection:
- **Background Monitoring**: Runs continuously when app is active
- **Location Updates**: Checks every 30 seconds for zone breaches
- **Smart Detection**: Only alerts on significant location changes (10+ meters)

### Push Notifications:
- **Soldier Alerts**: Immediate notification when leaving/entering zones
- **Commander Alerts**: Real-time alerts for all unit zone breaches
- **Multiple Channels**: Firebase FCM + Expo Push Service for reliability

### Data Storage:
- **Local Storage**: Breach information stored locally for offline access
- **Server Sync**: All breaches logged in database
- **History**: Complete breach history available for analysis

## 🚀 Getting Started

### For Soldiers:
1. **Enable Location**: Allow location permissions when prompted
2. **Background Access**: Grant "Always" location access for continuous monitoring
3. **Notifications**: Enable push notifications for zone breach alerts
4. **Stay Informed**: Check notifications regularly for zone breach updates

### For Commanders:
1. **Monitor Dashboard**: Check the notifications screen regularly
2. **Zone Breach Section**: Pay special attention to the red zone breach section
3. **Quick Response**: Tap notifications to acknowledge and take action
4. **Filter Usage**: Use filters to focus on specific types of alerts

## 📊 Dashboard Integration

### Zone Breach Statistics:
- **Total Breaches**: Count of all zone breaches
- **Active Breaches**: Unresolved breach alerts
- **Recent Activity**: Latest breach notifications
- **Unit Overview**: Breach status by unit

### Real-time Updates:
- **Live Updates**: Zone breaches appear instantly
- **Socket.io**: Real-time communication with server
- **Auto-refresh**: Notifications update automatically

## 🛡️ Security Features

### Data Protection:
- **Encrypted Communication**: All data transmitted securely
- **User Authentication**: Only authorized users receive alerts
- **Role-based Access**: Different notification levels for different roles

### Privacy Considerations:
- **Location Data**: Only stored for operational purposes
- **Breach History**: Maintained for security analysis
- **Data Retention**: Configurable retention periods

## 🔄 Troubleshooting

### Common Issues:

#### 1. **No Zone Breach Notifications**
- Check location permissions
- Verify background location is enabled
- Ensure you're logged in with valid user account

#### 2. **Notifications Not Appearing**
- Check notification permissions
- Verify internet connection
- Restart the app if needed

#### 3. **False Alerts**
- Check zone boundaries in system settings
- Verify GPS accuracy
- Contact system administrator if persistent

### Support:
- **Technical Issues**: Contact IT support
- **System Questions**: Ask your unit commander
- **Emergency**: Use emergency contact procedures

## 📈 Benefits

### For Soldiers:
- **Safety**: Automatic alerts help maintain operational security
- **Awareness**: Stay informed about zone boundaries
- **Compliance**: Easy to follow operational guidelines

### For Commanders:
- **Oversight**: Real-time monitoring of unit locations
- **Response**: Quick action on security breaches
- **Analysis**: Historical data for operational planning

### For Operations:
- **Security**: Enhanced operational security
- **Efficiency**: Automated monitoring reduces manual oversight
- **Compliance**: Better adherence to operational boundaries

---

## 🎯 Quick Reference

| Feature | Soldier | Commander |
|---------|---------|-----------|
| Zone Breach Alerts | ✅ | ✅ |
| Push Notifications | ✅ | ✅ |
| Real-time Updates | ✅ | ✅ |
| Historical Data | ✅ | ✅ |
| Filter Options | ✅ | ✅ |
| Test Function | ✅ | ✅ |

**Remember**: Zone breach detection is a safety feature designed to protect both individual soldiers and overall operational security. Always respond promptly to zone breach alerts and follow established procedures for resolution.

## Soldier Health Dashboard
# Soldier Health Dashboard

This document describes the new Health Dashboard feature for soldiers in the Future Soldiers APK application.

## Overview

The Soldier Health Dashboard provides soldiers with a comprehensive view of their health status, including:

1. **Live Health Vitals** - Real-time health monitoring
2. **Health Profile Metrics** - Long-term health tracking
3. **Current Active Mission** - Mission status and details

## Features

### 1. Live Health Vitals
- **Heart Rate** (BPM) - Normal: 60-100, Critical: <40 or >120
- **Body Temperature** (°C) - Normal: 36.1-37.2, Critical: <35.0 or >38.5
- **Blood Pressure** (mmHg) - Systolic/Diastolic with normal and critical ranges
- **SpO2** (%) - Blood oxygen saturation, Normal: 95-100%
- **Respiration Rate** (breaths/min) - Normal: 12-20
- **Activity Level** - Low, Moderate, High, Extreme

### 2. Health Profile Metrics
- **Steps Today** - Daily step count tracking
- **Body Fat Percentage** - Body composition monitoring
- **BMI** - Body Mass Index calculation
- **VO2 Max** - Maximum oxygen consumption capacity
- **Blood Sugar** - Glucose level monitoring
- **Cholesterol** - Total, HDL, and LDL cholesterol levels

### 3. Current Active Mission
- Mission title and description
- Status (Pending, In Progress, Completed)
- Priority level (Low, Medium, High, Urgent)
- Due date and assigned by information
- Quick access to mission details

## Status Indicators

Each health metric displays a status indicator:
- 🟢 **Normal** - Values within healthy ranges
- 🟡 **Warning** - Values outside normal but not critical
- 🔴 **Critical** - Values requiring immediate attention
- ⚪ **No Data** - No recent measurements available

## Database Schema

### Tables Created

1. **soldier_health_vitals** - Stores real-time health measurements
2. **soldier_health_profile** - Stores long-term health metrics
3. **health_status_thresholds** - Defines normal/critical ranges for each metric

### Key Features
- Automatic timestamp tracking
- Status determination functions
- Optimized indexes for performance
- Foreign key relationships with users table

## API Endpoints

### Health Vitals
- `GET /api/health/vitals/:userId` - Get latest vitals
- `POST /api/health/vitals/:userId` - Record new vitals

### Health Profile
- `GET /api/health/profile/:userId` - Get health profile
- `PUT /api/health/profile/:userId` - Update health profile

### Dashboard
- `GET /api/health/dashboard/:userId` - Get complete dashboard data

## Setup Instructions

### 1. Database Setup
```bash
cd my-api
node setup-health-tables.js
```

### 2. Backend Setup
The health routes are automatically included in the main API server.

### 3. Frontend Setup
The SoldierDashboardScreen is automatically added to the navigation for soldiers.

## Usage

### For Soldiers
1. Log in to the app with a soldier account
2. Navigate to the "Health" tab in the bottom navigation
3. View your current health status and active mission
4. Pull down to refresh the data

### For Developers
1. Use the API endpoints to record health data
2. Customize health thresholds in the database
3. Extend the dashboard with additional metrics

## Health Thresholds

The system uses configurable thresholds to determine health status:

| Metric | Normal Range | Critical Range | Unit |
|--------|-------------|----------------|------|
| Heart Rate | 60-100 | <40 or >120 | BPM |
| Body Temperature | 36.1-37.2 | <35.0 or >38.5 | °C |
| Blood Pressure (Systolic) | 90-140 | <70 or >180 | mmHg |
| Blood Pressure (Diastolic) | 60-90 | <50 or >110 | mmHg |
| SpO2 | 95-100 | <90 | % |
| Respiration Rate | 12-20 | <8 or >25 | breaths/min |
| Steps Today | 5000-15000 | <0 or >20000 | steps |
| Body Fat | 6-20 | <3 or >30 | % |
| BMI | 18.5-24.9 | <15.0 or >35.0 | kg/m² |
| VO2 Max | 30-60 | <20 or >80 | ml/kg/min |
| Blood Sugar | 70-100 | <50 or >140 | mg/dL |
| Total Cholesterol | 150-200 | <100 or >300 | mg/dL |

## Customization

### Adding New Metrics
1. Add the metric to the appropriate database table
2. Add threshold configuration to `health_status_thresholds`
3. Update the API endpoints to include the new metric
4. Add the metric to the frontend dashboard

### Modifying Thresholds
Update the `health_status_thresholds` table to adjust normal and critical ranges for any metric.

## Security Considerations

- Health data is user-specific and requires authentication
- API endpoints validate user permissions
- Sensitive health information should be encrypted in production
- Consider HIPAA compliance for medical data

## Future Enhancements

- Real-time health monitoring with wearable devices
- Health trend analysis and predictions
- Integration with medical devices
- Health alerts and notifications
- Export health data functionality
- Integration with medical records systems

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check database credentials in `.env` file
   - Run the setup script to create tables

2. **API Endpoint Errors**
   - Verify the health routes are included in `index.js`
   - Check that the database tables exist
   - Ensure proper user authentication

3. **Frontend Display Issues**
   - Check that the SoldierDashboardScreen is imported
   - Verify navigation configuration
   - Ensure API service methods are available

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your environment variables.

## Support

For technical support or feature requests, please refer to the main project documentation or contact the development team.



## Soldier Card UI Update & View More Functionality
# Soldier Card UI Update & View More Functionality

## Overview
This document describes the UI improvements and new functionality implemented for the soldier cards in the commander's profile screen.

## Changes Made

### 1. Soldier Card UI Improvements

#### Enhanced Visibility
- **Improved soldier name display**: Larger font size (18px), bold weight, and better color contrast (#2E3192)
- **Better layout structure**: Organized information in clear sections with proper spacing
- **Enhanced color scheme**: Used consistent colors from the theme for better readability
- **Improved padding and margins**: Better spacing for all elements

#### New Card Layout
- **Header section**: Soldier name and ID prominently displayed with person icon
- **Unit and Rank**: Side-by-side display with appropriate icons
- **Location**: Clear location coordinates with location icon
- **Health Vitals**: Heart rate and temperature with health icons
- **Tasks Preview**: Shows number of assigned tasks
- **View More Button**: Prominent button with chevron icon

### 2. View More Popup Functionality

#### Detailed Soldier Information Modal
When a commander taps "View More" on a soldier's card, a comprehensive popup appears showing:

##### Soldier Information Section
- Soldier Name
- Soldier ID
- Unit
- Rank

##### Current Location Section
- Precise coordinates (6 decimal places)
- Last updated timestamp

##### Health Vitals Section
- Heart Rate (bpm)
- Temperature (°C)
- Blood Pressure (mmHg)
- Oxygen Saturation (%)

##### Assigned Tasks Section
- Task titles and descriptions
- Task status with color-coded badges
- Sample tasks shown for demonstration

##### Recent Alerts Section
- Alert titles and messages
- Severity levels with color coding
- Timestamps
- Sample alerts shown for demonstration

#### Modal Features
- **Responsive design**: Adapts to different screen sizes
- **Scrollable content**: Handles long lists of tasks and alerts
- **Clean typography**: Clear hierarchy with proper font sizes and weights
- **Color-coded status indicators**: Visual status representation
- **Easy dismissal**: Close button and tap outside to close

### 3. Technical Implementation

#### New State Variables
```javascript
const [soldierDetailModalVisible, setSoldierDetailModalVisible] = useState(false);
const [selectedSoldierForDetail, setSelectedSoldierForDetail] = useState(null);
```

#### New Helper Functions
```javascript
const getTaskStatusColor = (status) => {
  // Returns appropriate color based on task status
}
```

#### New Styles Added
- `soldierCardHeader`, `soldierNameContainer`, `soldierCardName`, `soldierCardId`
- `soldierCardInfoRow`, `soldierCardInfoItem`, `soldierCardInfoText`
- `viewMoreButton`, `viewMoreButtonText`
- `soldierDetailModalContainer`, `soldierDetailModalHeader`, `soldierDetailModalTitle`
- `soldierDetailSection`, `soldierDetailHeader`, `soldierDetailSectionTitle`
- `soldierDetailField`, `soldierDetailLabel`, `soldierDetailValue`
- `soldierDetailTask`, `soldierDetailTaskTitle`, `soldierDetailTaskDescription`
- `soldierDetailAlert`, `soldierDetailAlertHeader`, `soldierDetailAlertTitle`

### 4. User Experience Improvements

#### For Commanders
- **Better readability**: All text is clearly visible in both light and dark themes
- **Quick access to details**: Tap "View More" to see comprehensive soldier information
- **Organized information**: Data is logically grouped and easy to scan
- **Visual indicators**: Icons and colors help identify different types of information

#### Accessibility
- **High contrast**: Text has sufficient contrast against backgrounds
- **Appropriate font sizes**: All text is readable on mobile devices
- **Touch targets**: Buttons are appropriately sized for touch interaction
- **Clear navigation**: Easy to understand how to access and dismiss the popup

### 5. Data Structure Compatibility

The implementation handles various data scenarios:
- **Real data**: Uses actual soldier data when available
- **Mock data**: Provides sample data for demonstration when real data is missing
- **Graceful fallbacks**: Shows "N/A" or default values when data is unavailable

### 6. Future Enhancements

Potential improvements that could be added:
- **Real-time updates**: Live updates of soldier location and health data
- **Task management**: Ability to assign/edit tasks from the popup
- **Alert management**: Ability to acknowledge or respond to alerts
- **Communication**: Direct messaging or calling capabilities
- **Map integration**: Show soldier location on a map
- **Historical data**: View trends in health vitals over time

## Testing

To test the new functionality:
1. Login as a commander
2. Navigate to Profile screen
3. Tap on the "Soldiers" tab
4. View the improved soldier cards
5. Tap "View More" on any soldier card
6. Verify the detailed popup appears with all sections
7. Test scrolling and dismissal functionality

## Files Modified

- `frontend/screens/ProfileScreen.js` - Main implementation file
- `SOLDIER_CARD_UI_UPDATE.md` - This documentation file


## Registration Flow Fix Summary
# Registration Flow Fix Summary

## Problem Identified

The new user registrations were going directly to the `users` table instead of the `registration_requests` table, bypassing the approval workflow.

## Root Cause Analysis

1. **Frontend API Service Fallback**: The `frontend/services/api.js` had a fallback mechanism that would try the `/users/registration-requests` endpoint first, but if it failed, it would automatically fall back to `/users/register` which directly inserts into the `users` table.

2. **Missing Fields**: The registration-requests endpoint expected additional fields (`age`, `gender`, `height`, `weight`, `bp`, `blood_group`) that the frontend wasn't sending, causing the first request to fail and triggering the fallback.

3. **Database Schema Mismatch**: The `users` table schema in `database-schema.sql` didn't match what the backend code expected, potentially causing database errors.

## Solution Implemented

### 1. Frontend Changes

**File: `frontend/screens/RegisterScreen.js`**
- Updated the registration data object to include all required fields for the registration-requests endpoint
- Added proper handling for optional fields (age, gender, height, weight, bp, blood_group)
- Updated success message to reflect that it's a registration request, not immediate registration
- Updated console logging to show all fields being sent

**File: `frontend/services/api.js`**
- Removed the fallback mechanism that was causing registrations to go to the wrong endpoint
- Now always uses `/users/registration-requests` endpoint

### 2. Database Schema Updates

**File: `my-api/database-schema.sql`**
- Updated the `users` table schema to include all columns that the backend code expects
- Added missing columns: `name`, `category`, `MobileNumber`, `EmployeeID`, `age`, `gender`, `height`, `weight`, `bp`, `blood_group`
- Changed `password_hash` to `password` to match backend expectations
- Made `email` nullable to match backend code

**File: `my-api/registration-requests-schema.sql` (NEW)**
- Created proper schema file for the `registration_requests` table
- Includes all necessary columns, indexes, and constraints
- Added proper foreign key relationships and unique constraints for pending registrations

**File: `my-api/migrate-users-table.sql` (NEW)**
- Created migration script to update existing `users` table
- Safely adds missing columns without breaking existing data
- Includes proper error handling and conditional column creation

## Registration Flow After Fix

1. **User submits registration form** → Frontend collects all required and optional fields
2. **Frontend sends data** → Always uses `/users/registration-requests` endpoint
3. **Backend processes request** → Inserts into `registration_requests` table with status 'pending'
4. **Admin approval required** → Registration requests must be approved via `/users/registration-requests/:id/accept`
5. **User creation** → Only after approval, user is moved from `registration_requests` to `users` table

## Files Modified

### Frontend
- `frontend/screens/RegisterScreen.js` - Updated registration data and success message
- `frontend/services/api.js` - Removed fallback mechanism

### Backend
- `my-api/database-schema.sql` - Updated users table schema
- `my-api/registration-requests-schema.sql` - New schema file for registration_requests table
- `my-api/migrate-users-table.sql` - New migration script for existing databases

## Next Steps

1. **Run the migration script** on your existing database:
   ```sql
   -- Run this in your PostgreSQL database
   \i my-api/migrate-users-table.sql
   ```

2. **Create the registration_requests table** if it doesn't exist:
   ```sql
   -- Run this in your PostgreSQL database
   \i my-api/registration-requests-schema.sql
   ```

3. **Test the registration flow**:
   - Try registering a new user
   - Verify the data goes to `registration_requests` table
   - Test the approval process using the accept endpoint

4. **Monitor the logs** to ensure no errors occur during registration

## Benefits of This Fix

- ✅ **Proper approval workflow**: All new registrations now require admin approval
- ✅ **Data integrity**: No more direct insertions into users table
- ✅ **Audit trail**: All registration requests are tracked in registration_requests table
- ✅ **Flexible approval process**: Admins can accept or reject registration requests
- ✅ **Complete user data**: All health and personal information is captured during registration

## Testing

To test the fix:

1. **Register a new user** through the frontend
2. **Check the database**:
   ```sql
   SELECT * FROM registration_requests WHERE status = 'pending';
   ```
3. **Verify no direct insertions** into users table for new registrations
4. **Test approval process**:
   ```bash
   POST /api/users/registration-requests/{id}/accept
   ```

The registration flow now properly uses the `registration_requests` table as intended!


## Quick Setup Commands
<!-- Original: QUICK_SETUP_COMMANDS.md -->
<!-- ...existing code from QUICK_SETUP_COMMANDS.md... -->

## Push Notifications Guide
# Industrial-Standard Push Notification System

## Overview

This implementation provides a complete, production-ready push notification system for the Future Soldiers APK. The system automatically sends push notifications whenever a new alert is inserted into the PostgreSQL database, with comprehensive error handling, retry logic, and user targeting.

## Features

### ✅ Always Active Notifications
- **Background Delivery**: Notifications work even when the app is killed or in background
- **Foreground Display**: Notifications show while app is active with proper handling
- **Sound & Vibration**: Each notification type has appropriate sound and vibration patterns
- **Click Interaction**: Users can tap notifications to navigate to relevant screens

### ✅ Database-Triggered Notifications
- **PostgreSQL LISTEN/NOTIFY**: Real-time database monitoring for alert inserts
- **Automatic Push**: Instant push notification delivery on database changes
- **Fallback Mechanisms**: Multiple delivery methods ensure reliability

### ✅ Industrial Standards
- **Retry Logic**: Exponential backoff for failed deliveries
- **Rate Limiting**: Prevents API quota exhaustion
- **Error Handling**: Comprehensive logging and error recovery
- **Scalable Architecture**: Supports multiple users with unique device tokens

## Architecture

### Backend (Node.js/Express + PostgreSQL)

#### 1. Database Trigger
```sql
-- Automatically fires on every alerts table insert
CREATE OR REPLACE FUNCTION notify_alerts_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('alerts_inserted', row_to_json(NEW)::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_insert_trigger
AFTER INSERT ON alerts
FOR EACH ROW
EXECUTE FUNCTION notify_alerts_insert();
```

#### 2. Server Listener
- **Real-time Monitoring**: Listens to PostgreSQL `alerts_inserted` channel
- **Automatic Reconnection**: Handles database disconnections gracefully
- **Smart Targeting**: Routes notifications based on user_id, unit, or role

#### 3. Firebase Integration
- **FCM Primary**: Uses Firebase Cloud Messaging for reliable delivery
- **Expo Fallback**: Expo push service as backup for broader compatibility
- **Multi-platform**: Supports Android, iOS, and Web platforms

### Frontend (React Native + Expo)

#### 1. Token Registration
- **Automatic Registration**: Gets FCM and Expo tokens on app startup
- **Server Sync**: Sends tokens to backend for storage
- **Permission Handling**: Requests and manages notification permissions

#### 2. Notification Channels (Android)
- **Emergency**: Highest priority, bypasses DND, public lockscreen
- **Zone Breach**: High priority, public lockscreen
- **Assignment**: Default priority, private lockscreen
- **System**: Low priority, minimal interruption

#### 3. Background Handling
- **Foreground**: Shows banner with sound and navigation
- **Background**: Displays system notification with tap handling
- **Killed State**: Launches app and navigates to relevant screen

## Setup Instructions

### 1. Backend Setup

#### Database Configuration
```bash
# Run the database schema to create triggers
psql -d your_database -f database-schema.sql
```

#### Environment Variables
```bash
# Firebase Admin SDK credentials
FIREBASE_PROJECT_ID=future-soldiers
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Database connection
DATABASE_URL=postgresql://user:password@117.251.19.107:5432/database
```

#### Install Dependencies
```bash
cd my-api
npm install firebase-admin pg socket.io
```

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install expo-notifications @react-native-async-storage/async-storage
```

#### Configure app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#10B981",
          "sounds": ["./assets/notification-sound.wav"],
          "mode": "production"
        }
      ]
    ]
  }
}
```

#### Firebase Configuration
- Add `google-services.json` to `frontend/` for Android
- Configure Firebase project in Firebase Console
- Enable Cloud Messaging API

### 3. Testing

#### Test Endpoints
```bash
# Test basic push notification
curl -X POST http://117.251.19.107:3001/api/alerts/test-push \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "type": "test", "message": "Test notification"}'

# Test emergency notification
curl -X POST http://117.251.19.107:3001/api/alerts/test-emergency \
  -H "Content-Type: application/json" \
  -d '{"severity": "critical", "message": "Emergency test"}'

# Test unit-wide notification
curl -X POST http://117.251.19.107:3001/api/alerts/test-push \
  -H "Content-Type: application/json" \
  -d '{"unit": "Alpha", "type": "zone_breach", "message": "Zone breach detected"}'
```

#### Manual Database Test
```sql
-- Insert test alert to trigger notification
INSERT INTO alerts (category, message, severity, status, user_id, unit)
VALUES ('test', 'Manual test alert', 'medium', 'active', 1, 'Alpha');
```

## Usage Examples

### 1. Send to Specific User
```javascript
// Backend
const alert = await pool.query(
  `INSERT INTO alerts (category, message, severity, status, user_id)
   VALUES ($1, $2, $3, $4, $5) RETURNING *`,
  ['assignment', 'New task assigned', 'medium', 'active', userId]
);
// Automatically triggers push notification to user
```

### 2. Send to Unit
```javascript
// Backend
const alert = await pool.query(
  `INSERT INTO alerts (category, message, severity, status, unit)
   VALUES ($1, $2, $3, $4, $5) RETURNING *`,
  ['zone_breach', 'Zone breach detected', 'high', 'active', 'Alpha']
);
// Automatically triggers push to all users in Alpha unit
```

### 3. Emergency Broadcast
```javascript
// Backend
const alert = await pool.query(
  `INSERT INTO alerts (category, message, severity, status)
   VALUES ($1, $2, $3, $4) RETURNING *`,
  ['emergency', 'Critical situation', 'critical', 'active']
);
// Automatically triggers push to all commanders and supervisors
```

## Notification Types

### 1. Emergency Alerts
- **Priority**: Highest
- **Sound**: Emergency tone
- **Vibration**: Intense pattern
- **Target**: All commanders and supervisors
- **Bypass DND**: Yes

### 2. Zone Breach Alerts
- **Priority**: High
- **Sound**: Default with urgency
- **Vibration**: Distinctive pattern
- **Target**: Unit commanders and security
- **Navigation**: Geospatial screen

### 3. Assignment Notifications
- **Priority**: Default
- **Sound**: Standard notification
- **Vibration**: Light pattern
- **Target**: Assigned user
- **Navigation**: Assignment screen

### 4. System Notifications
- **Priority**: Low
- **Sound**: Minimal or none
- **Vibration**: Light
- **Target**: All users or specific roles
- **Navigation**: Notifications screen

## Error Handling

### Backend Errors
- **Database Connection**: Automatic reconnection with exponential backoff
- **FCM Failures**: Retry logic with fallback to Expo
- **Token Invalid**: Automatic cleanup of invalid tokens
- **Rate Limiting**: Batch processing with delays

### Frontend Errors
- **Permission Denied**: Graceful degradation with in-app notifications
- **Token Generation**: Retry with user feedback
- **Network Issues**: Offline queue with sync on reconnection
- **Navigation Errors**: Fallback to main screen

## Monitoring & Logging

### Backend Logs
```javascript
// Success logs
console.log('✅ FCM notification sent successfully to user 123 (john_doe)');
console.log('📊 Bulk notification complete: 45 successful, 2 failed out of 47 total');

// Error logs
console.error('❌ FCM notification failed for user 123:', error.message);
console.log('🔄 Retrying FCM notification for user 123 (attempt 2/3)');
```

### Frontend Logs
```javascript
// Success logs
console.log('✅ Push notification registration completed successfully');
console.log('📱 Local notification scheduled: Emergency Alert');

// Error logs
console.error('❌ Error registering for push notifications:', error);
console.log('⚠️ No FCM token available for Android');
```

## Performance Optimization

### Backend
- **Connection Pooling**: Efficient database connections
- **Batch Processing**: Rate-limited bulk notifications
- **Caching**: User preferences and tokens caching
- **Async Processing**: Non-blocking notification delivery

### Frontend
- **Lazy Loading**: Notification handlers loaded on demand
- **Memory Management**: Automatic cleanup of old notifications
- **Battery Optimization**: Minimal background processing
- **Network Efficiency**: Compressed payloads and efficient sync

## Security Considerations

### Token Security
- **Encrypted Storage**: Tokens stored securely in database
- **Token Rotation**: Automatic token refresh
- **Access Control**: User-specific token access
- **Audit Logging**: All notification attempts logged

### Data Privacy
- **User Consent**: Explicit permission requests
- **Data Minimization**: Only necessary data in notifications
- **Secure Transmission**: HTTPS for all API calls
- **Local Storage**: Sensitive data encrypted locally

## Troubleshooting

### Common Issues

#### 1. Notifications Not Received
```bash
# Check backend logs
tail -f my-api/logs/app.log

# Verify database trigger
psql -d database -c "SELECT * FROM pg_trigger WHERE tgname = 'alerts_insert_trigger';"

# Test manual notification
curl -X POST http://117.251.19.107:3001/api/alerts/test-push -H "Content-Type: application/json" -d '{"userId": 1}'
```

#### 2. Permission Issues
```javascript
// Check permission status
const { status } = await Notifications.getPermissionsAsync();
console.log('Permission status:', status);

// Request permissions
const { status: newStatus } = await Notifications.requestPermissionsAsync();
```

#### 3. Token Issues
```javascript
// Verify token generation
const expoToken = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-project-id'
});
console.log('Expo token:', expoToken.data);
```

### Debug Mode
```javascript
// Enable debug logging
const DEBUG_MODE = true;

if (DEBUG_MODE) {
  console.log('🔍 Debug: Notification payload:', payload);
  console.log('🔍 Debug: User tokens:', userTokens);
}
```

## Production Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/prod_db
FIREBASE_PROJECT_ID=prod-future-soldiers
```

### Monitoring
- **Health Checks**: `/api/ping` endpoint for uptime monitoring
- **Metrics**: Notification delivery rates and failure tracking
- **Alerts**: Automated alerts for system failures
- **Logs**: Centralized logging with error tracking

### Scaling
- **Load Balancing**: Multiple server instances
- **Database**: Read replicas for notification queries
- **Caching**: Redis for user preferences and tokens
- **CDN**: Static assets delivery optimization

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend and frontend logs
3. Test with the provided test endpoints
4. Verify Firebase configuration
5. Check database trigger status

## License

This push notification system is part of the Future Soldiers APK project and follows industrial best practices for reliability, security, and performance.


## Project Fixes Summary
# Future Soldiers APK - Project Fixes Summary

## Overview
This document summarizes all the critical fixes implemented for the Future Soldiers APK project to resolve major functionality issues.

## 🚨 Issues Fixed

### 1. Background Location Tracking Error
**Problem**: App was failing to start background location tracking with foreground service error
```
ERROR [BackgroundLocation] Failed to start background location tracking: [Error: Call to function 'ExpoLocation.startLocationUpdatesAsync' has been rejected.
→ Caused by: Couldn't start the foreground service. Foreground service cannot be started when the application is in the background]
```

**Solution**: 
- Added app state detection before starting foreground service
- Implemented queuing mechanism for background location start
- Added automatic retry when app becomes active
- Enhanced error handling and logging

**Files Modified**:
- `frontend/services/backgroundLocationService.js`
- `frontend/App.js`
- `frontend/BACKGROUND_LOCATION_FOREGROUND_SERVICE_FIX.md`

### 2. Photo Upload HTTP 413 Error
**Problem**: Users couldn't upload profile photos due to "Payload Too Large" error
```
ERROR Change photo error: [Error: PUT /users/111/photo → HTTP 413]
```

**Solution**:
- Implemented smart image compression with size validation
- Increased backend size limit from 8MB to 10MB
- Added progressive compression (starts at 80% quality, reduces if needed)
- Created reusable image compression utility
- Enhanced error messages with size information

**Files Modified**:
- `frontend/screens/ProfileScreen.js`
- `frontend/utils/imageCompression.js` (new)
- `my-api/routes/users.js`
- `frontend/PHOTO_UPLOAD_FIX.md`

## 🔧 Technical Improvements

### Background Location Service
- **App State Detection**: Checks if app is in foreground before starting service
- **Queuing System**: Queues location start when app is in background
- **Automatic Retry**: Retries when app becomes active
- **Better Error Handling**: Specific error detection and handling
- **Cleanup Functions**: Proper cleanup of event listeners

### Image Compression System
- **Smart Compression**: Starts high quality, reduces if needed
- **Size Validation**: Real-time size checking
- **Multiple Attempts**: Up to 3 compression attempts
- **User Feedback**: Clear progress and error messages
- **Reusable Utility**: Can be used across the app

### Backend Enhancements
- **Increased Limits**: Raised photo upload limit to 10MB
- **Better Logging**: Detailed size and error logging
- **Enhanced Errors**: Detailed error responses with size info
- **Size Estimation**: Accurate size calculation and reporting

## 📱 User Experience Improvements

### Background Location
- ✅ No more foreground service errors
- ✅ Reliable background tracking
- ✅ Automatic retry when app becomes active
- ✅ Better error messages and logging
- ✅ Improved battery optimization handling

### Photo Upload
- ✅ Automatic image compression
- ✅ Size validation before upload
- ✅ Clear error messages with size information
- ✅ Successful uploads for all image sizes
- ✅ Better user feedback during compression
- ✅ Reusable compression utility for other features

## 🧪 Testing

### Test Scripts Created
- `frontend/testLocationFix.js` - Background location testing
- `frontend/testPhotoUpload.js` - Photo upload testing
- `frontend/testBackgroundLocation.js` - Background location validation

### Manual Testing Steps
1. **Background Location**:
   - Test app start when in foreground ✅
   - Test app start when in background ✅
   - Test app state transitions ✅
   - Test background location persistence ✅

2. **Photo Upload**:
   - Test with small images ✅
   - Test with large images ✅
   - Test compression process ✅
   - Test error handling ✅

## 📁 Files Created/Modified

### New Files
- `frontend/utils/imageCompression.js` - Image compression utility
- `frontend/testLocationFix.js` - Location testing script
- `frontend/testPhotoUpload.js` - Photo upload testing
- `frontend/BACKGROUND_LOCATION_FOREGROUND_SERVICE_FIX.md` - Location fix docs
- `frontend/PHOTO_UPLOAD_FIX.md` - Photo upload fix docs
- `PROJECT_FIXES_SUMMARY.md` - This summary

### Modified Files
- `frontend/services/backgroundLocationService.js` - Location service fixes
- `frontend/App.js` - App state handling
- `frontend/screens/ProfileScreen.js` - Photo upload improvements
- `my-api/routes/users.js` - Backend photo handling

## 🚀 Expected Results

### Before Fixes
- ❌ Background location tracking failed
- ❌ Photo uploads failed with 413 errors
- ❌ Poor error handling and user feedback
- ❌ No size validation for images
- ❌ Generic error messages

### After Fixes
- ✅ Reliable background location tracking
- ✅ Successful photo uploads with compression
- ✅ Smart error handling and user feedback
- ✅ Automatic image size validation
- ✅ Clear, actionable error messages
- ✅ Better overall user experience

## 🔍 Key Features

### Background Location Service
- App state detection and queuing
- Automatic retry mechanism
- Enhanced error handling
- Proper cleanup functions
- Better logging and debugging

### Image Compression System
- Progressive compression algorithm
- Real-time size validation
- Multiple compression attempts
- User-friendly feedback
- Reusable utility functions

### Backend Improvements
- Increased size limits
- Better error responses
- Detailed logging
- Size estimation and reporting

## 📊 Performance Impact

### Positive Impacts
- **Faster Uploads**: Compressed images upload faster
- **Better Reliability**: Fewer failed operations
- **Improved UX**: Clear feedback and error handling
- **Reduced Bandwidth**: Smaller image files
- **Better Debugging**: Enhanced logging and error reporting

### Resource Usage
- **Memory**: Minimal impact with proper cleanup
- **CPU**: Efficient compression algorithm
- **Network**: Reduced data usage with compression
- **Storage**: Smaller images in database

## 🎯 Next Steps

1. **Test the fixes** with real devices and various scenarios
2. **Monitor performance** and user feedback
3. **Consider additional optimizations** based on usage patterns
4. **Document any new issues** that arise
5. **Plan future enhancements** based on user needs

## 📞 Support

If you encounter any issues with the fixes:
1. Check the console logs for detailed error information
2. Use the test scripts to validate functionality
3. Refer to the specific documentation files for each fix
4. Test with different scenarios and device types
5. Monitor backend logs for any server-side issues

## ✅ Status

- [x] Background location tracking fixed
- [x] Photo upload HTTP 413 error fixed
- [x] Image compression system implemented
- [x] Backend size limits increased
- [x] Error handling improved
- [x] Documentation created
- [x] Test scripts provided
- [x] Code quality verified

The project is now ready for testing and deployment with these critical fixes in place.


## Login Security Update
# Login Security Update - Prevent Login for Pending Registrations

## Overview
Updated the login system to prevent users from logging in if they are only in the `registration_requests` table with pending status. Users can only log in after their registration has been approved and they are moved to the `users` table.

## Changes Made

### 1. Backend Login Endpoint (`my-api/routes/users.js`)

**Enhanced login validation:**
- First checks if user exists in `users` table (existing behavior)
- If not found in `users`, checks if user exists in `registration_requests` with pending status
- Returns specific error message for pending registrations

**New error response for pending users:**
```json
{
  "error": "Your registration is pending approval. Please wait for an administrator to approve your account.",
  "status": "pending_approval",
  "registeredAt": "2025-09-09T05:31:11.096Z"
}
```

**HTTP Status Codes:**
- `403 Forbidden`: User exists in registration_requests with pending status
- `401 Unauthorized`: User not found or invalid credentials

### 2. Frontend Login Screen (`frontend/screens/LoginScreen.js`)

**Enhanced error handling:**
- Detects pending approval error messages
- Shows user-friendly alert for pending registrations
- Provides specific error messages for different scenarios

**Error Messages:**
- **Pending Approval**: "Your registration is pending approval. Please wait for an administrator to approve your account."
- **Invalid Credentials**: "Invalid username or password. Please check your credentials and try again."
- **General Error**: "Login failed. Please check your connection and try again."

## Security Benefits

### ✅ **Prevents Unauthorized Access**
- Users cannot log in until their registration is approved
- Maintains proper approval workflow
- Ensures only verified users can access the system

### ✅ **Clear User Communication**
- Users understand why they cannot log in
- Provides feedback about registration status
- Reduces support requests and confusion

### ✅ **Audit Trail**
- All login attempts are logged
- Failed attempts show reason (pending vs invalid credentials)
- Maintains security compliance

## Test Results

The system has been tested and verified to work correctly:

1. **Pending User Login**: ✅ Returns 403 status with pending approval message
2. **Approved User (Wrong Password)**: ✅ Returns 401 status with invalid credentials message  
3. **Non-existent User**: ✅ Returns 401 status with invalid credentials message
4. **Approved User (Correct Password)**: ✅ Allows login and returns user data

## User Flow

### For New Registrations:
1. User registers → Data goes to `registration_requests` table with status 'pending'
2. User tries to login → Gets "pending approval" message
3. Admin approves registration → User moved to `users` table
4. User can now login successfully

### For Existing Users:
1. User tries to login → System checks `users` table
2. If found and password correct → Login successful
3. If found but wrong password → "Invalid credentials" message
4. If not found → "Invalid credentials" message

## Files Modified

### Backend
- `my-api/routes/users.js` - Enhanced login endpoint with pending user check

### Frontend  
- `frontend/screens/LoginScreen.js` - Enhanced error handling for pending approvals

### Test Files
- `my-api/test-login-behavior.js` - Test script to verify login behavior

## Deployment Notes

1. **Backend Server**: Restart required to pick up changes
2. **Database**: No schema changes required
3. **Frontend**: Changes take effect immediately (no restart needed)

## Security Compliance

This update ensures:
- ✅ **Principle of Least Privilege**: Users only get access after approval
- ✅ **Defense in Depth**: Multiple layers of validation
- ✅ **Audit Trail**: All access attempts are logged
- ✅ **User Experience**: Clear communication about access status

The login system now properly enforces the registration approval workflow and prevents unauthorized access to the system.


## HTTP Production Configuration Guide
# HTTP Production Configuration Guide

## Overview
This guide documents the changes made to allow HTTP traffic for production use in the Future Soldiers APK project.

## Changes Made

### 1. Android Configuration

#### A. AndroidManifest.xml Updates
- **File**: `frontend/android/app/src/main/AndroidManifest.xml`
- **Changes**:
  - Added `android:usesCleartextTraffic="true"` to application tag
  - Added HTTP scheme support in queries section
  - Added network security config reference

#### B. Network Security Configuration
- **File**: `frontend/android/app/src/main/res/xml/network_security_config.xml` (NEW)
- **Purpose**: Explicitly allows HTTP traffic for specific domains
- **Domains Allowed**:
  - `117.251.19.107` (development)
  - `10.0.2.2` (Android emulator)
  - `192.168.1.8` (local network)
  - `ocfa.onrender.com` (production)
  - `onrender.com` (production domain)

#### C. Debug Manifest
- **File**: `frontend/android/app/src/debug/AndroidManifest.xml`
- **Already configured**: `android:usesCleartextTraffic="true"`

### 2. iOS Configuration

#### A. App Transport Security
- **File**: `frontend/app.json`
- **Changes**: Added `NSAppTransportSecurity` configuration
- **Settings**:
  - `NSAllowsArbitraryLoads: true` - Allows HTTP traffic
  - Exception domains for 117.251.19.107 and ocfa.onrender.com

### 3. Production Build Configuration

#### A. EAS Build Configuration
- **File**: `frontend/eas.json`
- **Changes**: Updated production and preview builds to use HTTP
- **URL**: `http://ocfa.onrender.com/api`

#### B. API Service Configuration
- **File**: `frontend/services/api.js`
- **Changes**: Set `HOSTED_BACKEND_URL` to HTTP URL
- **URL**: `http://ocfa.onrender.com/api`

### 4. Backend Configuration

#### A. CORS Configuration
- **File**: `my-api/index.js`
- **Changes**: Added HTTP domain to CORS origins
- **Origins**: `http://ocfa.onrender.com`

#### B. Environment Configuration
- **File**: `my-api/env.example`
- **Changes**: Updated CORS_ORIGIN to include HTTP domain

## Security Considerations

### ⚠️ Important Notes
1. **HTTP is less secure** than HTTPS - data is transmitted in plain text
2. **Use HTTP only for development/testing** or when HTTPS is not available
3. **Consider upgrading to HTTPS** for production when possible

### 🔒 Security Measures Implemented
1. **Domain-specific HTTP allowance** - Only specific domains can use HTTP
2. **Network security configuration** - Android-specific security rules
3. **CORS restrictions** - Backend only accepts requests from allowed origins

## Testing HTTP Configuration

### 1. Test Android Build
```bash
cd frontend
eas build --platform android --profile production
```

### 2. Test iOS Build
```bash
cd frontend
eas build --platform ios --profile production
```

### 3. Verify HTTP Traffic
- Check network logs in development tools
- Verify API calls are using HTTP URLs
- Test on both development and production builds

## Troubleshooting

### Common Issues

#### 1. Android: "Cleartext HTTP traffic not permitted"
**Solution**: Ensure `android:usesCleartextTraffic="true"` is set in AndroidManifest.xml

#### 2. iOS: "App Transport Security has blocked a cleartext HTTP"
**Solution**: Verify `NSAppTransportSecurity` configuration in app.json

#### 3. CORS Errors
**Solution**: Check that backend CORS_ORIGIN includes your HTTP domain

#### 4. Network Security Config Not Found
**Solution**: Ensure `network_security_config.xml` exists in `android/app/src/main/res/xml/`

## Files Modified

### Frontend Files
- `frontend/android/app/src/main/AndroidManifest.xml`
- `frontend/android/app/src/main/res/xml/network_security_config.xml` (NEW)
- `frontend/app.json`
- `frontend/eas.json`
- `frontend/services/api.js`

### Backend Files
- `my-api/index.js`
- `my-api/env.example`

## Next Steps

1. **Build and test** the application with HTTP configuration
2. **Monitor network traffic** to ensure HTTP is working
3. **Consider HTTPS migration** for better security in the future
4. **Update documentation** if additional domains are needed

## Reverting to HTTPS

To revert back to HTTPS:
1. Change URLs from `http://` to `https://` in:
   - `frontend/eas.json`
   - `frontend/services/api.js`
   - `my-api/index.js`
   - `my-api/env.example`
2. Remove HTTP-specific configurations if desired
3. Rebuild the application

---

**✅ HTTP production configuration is now complete and ready for use.**


## Hosting Setup Guide
# 🚀 Hosting Setup Guide
## Future Soldiers APK - Backend Deployment

This guide shows how to deploy your backend to hosting platforms that don't support `.env` files.

---

## 🎯 **What's Changed**

✅ **No `.env` file needed** - All configuration is hardcoded  
✅ **Firebase config embedded** - Service account key in code  
✅ **Database config embedded** - Connection details in code  
✅ **CORS config embedded** - Allowed origins in code  

---

## 🌐 **Supported Hosting Platforms**

### **Free Platforms:**
- **Railway** - Easy deployment, PostgreSQL included
- **Render** - Free tier with PostgreSQL
- **Heroku** - Free tier (limited)
- **Vercel** - Serverless functions
- **Netlify** - Serverless functions

### **Paid Platforms:**
- **DigitalOcean** - Droplets or App Platform
- **AWS** - EC2, Lambda, or App Runner
- **Google Cloud** - Compute Engine or Cloud Run
- **Azure** - App Service or Functions

---

## 📋 **Pre-Deployment Checklist**

### **1. Update Database Configuration**
Edit `my-api/db.js`:

```javascript
const pool = new Pool({
  host: 'your-hosted-database-url.com',     // Your hosted DB URL
  user: 'your-database-username',           // Your DB username
  password: 'your-database-password',       // Your DB password
  database: 'your-database-name',           // Your DB name
  port: 5432,                               // Usually 5432 for hosted DBs
  ssl: true,                                // Usually true for hosted DBs
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### **2. Update CORS Configuration**
Edit `my-api/index.js`:

```javascript
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://your-frontend-domain.com,https://your-app-domain.com";
```

### **3. Update Port Configuration**
The server will automatically use the hosting platform's port:

```javascript
const PORT = process.env.PORT || 3001;
```

---

## 🚀 **Deployment Steps**

### **Step 1: Prepare Your Code**

1. **Install Dependencies:**
   ```bash
   cd my-api
   npm install
   ```

2. **Create Database Tables:**
   ```bash
   # Run this on your hosted database
   psql -h your-db-host -U your-username -d your-database -f database-schema.sql
   ```

3. **Test Locally:**
   ```bash
   npm start
   ```

### **Step 2: Choose Your Hosting Platform**

#### **Option A: Railway (Recommended)**
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add PostgreSQL service
4. Deploy your app
5. Set environment variables in Railway dashboard

#### **Option B: Render**
1. Go to [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Add PostgreSQL database
5. Deploy

#### **Option C: Heroku**
1. Install Heroku CLI
2. Create Heroku app
3. Add PostgreSQL addon
4. Deploy with Git

### **Step 3: Configure Database**

After getting your hosted database:

1. **Update `my-api/db.js`:**
   ```javascript
   const pool = new Pool({
     host: 'your-db-host.railway.app',
     user: 'postgres',
     password: 'your-db-password',
     database: 'railway',
     port: 5432,
     ssl: true,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

2. **Create Tables:**
   ```bash
   # Use your hosting platform's database connection
   psql "postgresql://username:password@host:port/database" -f database-schema.sql
   ```

### **Step 4: Deploy**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for hosting deployment"
   git push origin main
   ```

2. **Deploy on Platform:**
   - Railway: Automatic deployment
   - Render: Manual deployment
   - Heroku: `git push heroku main`

---

## 🔧 **Platform-Specific Configurations**

### **Railway**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:** Set in Railway dashboard

### **Render**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:** Set in Render dashboard

### **Heroku**
- **Procfile:** `web: npm start`
- **Environment Variables:** Set in Heroku dashboard

### **Vercel**
- **Build Command:** `npm install`
- **Output Directory:** `my-api`
- **Install Command:** `npm install`

---

## 🧪 **Testing After Deployment**

### **1. Test API Endpoints**
```bash
# Test basic connectivity
curl https://your-app.railway.app/api/ping

# Test database connection
curl https://your-app.railway.app/api/dbtest

# Test notification sending
curl -X POST https://your-app.railway.app/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "title": "Test Alert",
    "message": "Hosting is working!",
    "type": "info",
    "category": "system"
  }'
```

### **2. Test Firebase Integration**
```bash
# Test zone breach alert
curl -X POST https://your-app.railway.app/api/alerts/zone-breach \
  -H "Content-Type: application/json" \
  -d '{
    "zoneId": 1,
    "userId": 1,
    "breachType": "entry",
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

### **3. Update Frontend Configuration**
Update `frontend/services/api.js`:

```javascript
const API_BASE_URL = 'https://your-app.railway.app/api';
```

---

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **1. Database Connection Failed**
- Check database credentials in `db.js`
- Verify SSL settings
- Test connection manually

#### **2. CORS Errors**
- Update CORS origins in `index.js`
- Add your frontend domain to allowed origins

#### **3. Firebase Not Working**
- Verify service account key is correct
- Check Firebase project settings
- Test with simple notification first

#### **4. Port Issues**
- Use `process.env.PORT` (automatic on most platforms)
- Don't hardcode port numbers

### **Debug Commands:**
```bash
# Check logs
railway logs
render logs
heroku logs --tail

# Test database connection
psql "postgresql://username:password@host:port/database" -c "SELECT NOW();"

# Test API endpoints
curl -v https://your-app.railway.app/api/ping
```

---

## 🔒 **Security Considerations**

### **For Production:**
1. **Use Environment Variables** when possible
2. **Rotate Firebase Keys** regularly
3. **Use HTTPS** for all connections
4. **Implement Rate Limiting**
5. **Add Authentication** to API endpoints

### **Current Configuration:**
- Firebase key is embedded (acceptable for demo/prototype)
- Database credentials are embedded (change for production)
- CORS is configured for specific domains

---

## 📱 **Frontend Updates**

After deploying backend:

1. **Update API URL:**
   ```javascript
   // In frontend/services/api.js
   const API_BASE_URL = 'https://your-app.railway.app/api';
   ```

2. **Test Connection:**
   ```javascript
   // Test in your app
   fetch('https://your-app.railway.app/api/ping')
     .then(response => response.json())
     .then(data => console.log('Backend connected:', data));
   ```

3. **Build and Deploy Frontend:**
   ```bash
   cd frontend
   eas build --platform android --profile production
   ```

---

## ✅ **Success Checklist**

- [ ] Backend deployed successfully
- [ ] Database connected and tables created
- [ ] API endpoints responding
- [ ] Firebase notifications working
- [ ] Frontend updated with new API URL
- [ ] All features tested on hosted backend
- [ ] SSL/HTTPS working
- [ ] CORS configured correctly

---

## 🎯 **Next Steps**

1. **Monitor Performance** - Check hosting platform metrics
2. **Set Up Monitoring** - Add error tracking (Sentry, etc.)
3. **Scale Up** - Upgrade hosting plan if needed
4. **Add Security** - Implement proper authentication
5. **Backup Strategy** - Set up database backups

---

**🎉 Your Future Soldiers APK backend is now ready for hosting without environment variables!**

The system will work on any hosting platform that supports Node.js and PostgreSQL.


## Hosted Environment Fixes
# Hosted Environment Fixes

## Issues Identified and Fixed

### 1. Login Security Issue
**Problem**: User can login without being in the users table
**Root Cause**: Need to verify the login logic is working correctly on hosted environment
**Fix Applied**: Enhanced login endpoint with detailed logging and debugging

### 2. Database Permission Error
**Problem**: `permission denied to set parameter "session_replication_role"`
**Root Cause**: Hosted databases (Render, Heroku, etc.) don't allow setting this parameter
**Fix Applied**: Added try-catch around the session_replication_role setting

## Changes Made

### 1. Enhanced Login Endpoint (`my-api/routes/users.js`)

**Added detailed logging:**
```javascript
console.log(`[LOGIN] Checking user: ${username}`);
console.log(`[LOGIN] Users table query result: ${result.rows.length} rows found`);
console.log(`[LOGIN] Registration_requests table query result: ${allRegRequests.rows.length} total rows found`);
```

**Added comprehensive debugging:**
- Checks both users and registration_requests tables
- Logs all query results
- Provides detailed error messages

### 2. Fixed Location Update Endpoint (`my-api/routes/users.js`)

**Before (causing error):**
```javascript
await client.query("SET LOCAL session_replication_role = 'replica'");
```

**After (with error handling):**
```javascript
try {
  await client.query("SET LOCAL session_replication_role = 'replica'");
} catch (triggerError) {
  console.log('Could not disable triggers (permission denied on hosted DB):', triggerError.message);
  // Continue without disabling triggers - this is acceptable for hosted environments
}
```

### 3. Created Debug Script (`my-api/debug-login-issue.js`)

**Purpose**: Help debug login issues on hosted environment
**Usage**: `node debug-login-issue.js <username>`
**Features**:
- Checks both database tables directly
- Tests login API endpoint
- Provides detailed analysis of the issue

## Deployment Instructions

### 1. Update Hosted Backend
1. Upload the updated `my-api/routes/users.js` file to your hosted environment
2. Restart the backend server to pick up the changes

### 2. Test the Fixes
1. Try to login with a user who is only in registration_requests table
2. Check the backend logs for the new debug messages
3. Verify that location updates no longer cause permission errors

### 3. Debug Login Issues
If you still have login issues, run the debug script:
```bash
node debug-login-issue.js <problematic_username>
```

## Expected Behavior After Fix

### Login Behavior:
- ✅ **Users in users table**: Can login normally
- ❌ **Users only in registration_requests (pending)**: Get 403 error with "pending approval" message
- ❌ **Users only in registration_requests (other status)**: Get 401 error with "invalid credentials" message
- ❌ **Non-existent users**: Get 401 error with "invalid credentials" message

### Location Updates:
- ✅ **No more permission errors**: Location updates work without database permission issues
- ✅ **Graceful degradation**: If triggers can't be disabled, the system continues to work

## Debugging Steps

If the login issue persists:

1. **Check the logs** for the new debug messages:
   ```
   [LOGIN] Checking user: <username>
   [LOGIN] Users table query result: X rows found
   [LOGIN] Registration_requests table query result: Y total rows found
   ```

2. **Run the debug script** to get detailed information:
   ```bash
   node debug-login-issue.js <username>
   ```

3. **Check database directly** to verify user exists in the correct table

4. **Verify the hosted backend** is using the updated code

## Files Modified

- `my-api/routes/users.js` - Enhanced login logic and fixed location update
- `my-api/debug-login-issue.js` - New debug script

## Next Steps

1. Deploy the updated code to your hosted environment
2. Test login with a user who should be rejected
3. Check the backend logs for debug information
4. Run the debug script if issues persist

The fixes should resolve both the login security issue and the database permission error on your hosted environment.


## Firebase Setup Guide
# 🔥 Firebase Integration Setup Guide
## Future Soldiers APK - Complete Notification System

This guide will walk you through setting up Firebase Cloud Messaging (FCM) for the Future Soldiers APK to enable:
- ✅ Zone Breach Alerts
- ✅ Emergency Alerts  
- ✅ Assignment Notifications
- ✅ Real-time Push Notifications
- ✅ Background Notifications

---

## 🚀 **Step 1: Create Firebase Project**

### 1.1 Go to Firebase Console
- Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
- Click "Create a project" or select existing project

### 1.2 Project Setup
- **Project name**: `future-soldiers-apk` (or your preferred name)
- **Enable Google Analytics**: Optional (recommended)
- **Analytics account**: Create new or use existing
- Click "Create project"

### 1.3 Add Android App
- Click "Android" icon to add Android app
- **Android package name**: `com.yourcompany.futuresoldiersapk`
- **App nickname**: `Future Soldiers APK`
- **Debug signing certificate**: Leave blank for now
- Click "Register app"

### 1.4 Download Configuration Files
- Download `google-services.json` file
- Place it in `frontend/android/app/` directory

---

## 📱 **Step 2: Configure Frontend (React Native)**

### 2.1 Update Firebase Config
Edit `frontend/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:android:abcdef123456"
};
```

### 2.2 Install Dependencies
```bash
cd frontend
npm install firebase @react-native-firebase/app @react-native-firebase/messaging
```

### 2.3 Update app.json
Add to `frontend/app.json`:

```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging"
    ],
    "android": {
      "googleServicesFile": "./android/app/google-services.json"
    }
  }
}
```

---

## 🖥️ **Step 3: Configure Backend (Node.js)**

### 3.1 Get Service Account Key
1. In Firebase Console, go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Rename to `firebase-service-account.json`
5. Place in `my-api/` directory

### 3.2 Update Environment Variables
Create `my-api/.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id","private_key_id":"key-id","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com"}

# Alternative: Use file path
# GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

### 3.3 Install Dependencies
```bash
cd my-api
npm install firebase-admin
```

---

## 🗄️ **Step 4: Database Setup**

### 4.1 Run Database Schema
```bash
cd my-api
psql -U postgres -d OCFA -f database-schema.sql
```

### 4.2 Verify Tables Created
```sql
\dt
-- Should show: alerts, notifications, zones, assignments, users, etc.
```

---

## 🔧 **Step 5: Test Firebase Integration**

### 5.1 Test Backend Connection
```bash
cd my-api
npm start
```

Check console for: `Firebase Admin SDK initialized successfully`

### 5.2 Test Frontend Connection
```bash
cd frontend
expo start
```

Check console for: `FCM Token: [token]`

### 5.3 Send Test Notification
Use the API endpoint:
```bash
curl -X POST http://117.251.19.107:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "title": "Test Alert",
    "message": "Firebase is working!",
    "type": "info",
    "category": "system"
  }'
```

---

## 📋 **Step 6: Notification Types Implementation**

### 6.1 Zone Breach Alerts
```javascript
// Frontend: Send zone breach
await notificationService.sendZoneBreachAlert({
  zoneId: 1,
  breachType: 'entry',
  latitude: 40.7128,
  longitude: -74.0060
});

// Backend: Automatically sends to commanders
POST /api/alerts/zone-breach
```

### 6.2 Emergency Alerts
```javascript
// Frontend: Send emergency
await notificationService.sendEmergencyAlert({
  title: 'Medical Emergency',
  message: 'Soldier requires immediate medical attention',
  severity: 'critical',
  affectedUnits: ['Alpha Company'],
  latitude: 40.7128,
  longitude: -74.0060
});

// Backend: Sends to all relevant personnel
POST /api/alerts
```

### 6.3 Assignment Notifications
```javascript
// Frontend: Send assignment
await notificationService.sendAssignmentNotification({
  assignedTo: 2,
  title: 'Patrol Duty',
  description: 'Night patrol in Sector A',
  priority: 'high',
  dueDate: '2024-01-15T20:00:00Z'
});

// Backend: Creates notification and sends push
POST /api/notifications
```

---

## 🎯 **Step 7: Advanced Features**

### 7.1 Notification Channels (Android)
The app automatically creates:
- **Default**: General notifications
- **Zone Breach**: Red alerts with vibration
- **Emergency**: Maximum priority with sound
- **Assignment**: High priority with custom color

### 7.2 Background Notifications
- Works even when app is minimized
- Requires custom build (not Expo Go)
- Uses Expo Task Manager for background processing

### 7.3 Notification Preferences
Users can customize:
- Zone breach alerts
- Assignment notifications
- Emergency alerts
- System notifications
- Quiet hours

---

## 🚨 **Troubleshooting**

### Common Issues:

#### 1. "Firebase Admin SDK not initialized"
- Check service account key in `.env`
- Verify file path is correct
- Ensure JSON is valid

#### 2. "No push tokens found"
- User hasn't granted notification permissions
- App needs to be rebuilt with custom dev client
- Check FCM token generation in console

#### 3. "Notifications not showing"
- Check notification permissions
- Verify notification channels are created
- Test with local notifications first

#### 4. "Backend connection failed"
- Check database connection
- Verify API endpoints
- Check CORS configuration

### Debug Commands:
```bash
# Check Firebase status
cd my-api && npm start

# Check frontend logs
cd frontend && expo start

# Test database
psql -U postgres -d OCFA -c "SELECT * FROM notifications LIMIT 5;"

# Check FCM tokens
psql -U postgres -d OCFA -c "SELECT username, fcm_token FROM users;"
```

---

## 📱 **Testing on Device**

### 1. Build Custom APK
```bash
cd frontend
eas build --platform android --profile development
```

### 2. Install APK
- Download and install APK on device
- Grant all permissions (especially location and notifications)
- Disable battery optimization for the app

### 3. Test Notifications
- Send test notification from backend
- Check if push notification appears
- Test different notification types
- Verify sound and vibration

---

## 🔒 **Security Considerations**

### 1. Service Account Key
- Never commit to version control
- Use environment variables
- Restrict access to production servers

### 2. API Endpoints
- Implement authentication middleware
- Validate user permissions
- Rate limit notification sending

### 3. Data Privacy
- Encrypt sensitive notification data
- Implement notification expiration
- Log notification delivery for audit

---

## 📊 **Monitoring & Analytics**

### 1. Firebase Console
- Monitor notification delivery rates
- Track user engagement
- Analyze notification performance

### 2. Backend Logs
- Notification delivery status
- Error tracking
- Performance metrics

### 3. Database Analytics
- User notification preferences
- Alert response times
- System usage patterns

---

## 🎉 **Success Checklist**

- [ ] Firebase project created
- [ ] Android app registered
- [ ] Service account key downloaded
- [ ] Frontend config updated
- [ ] Backend dependencies installed
- [ ] Database schema created
- [ ] Test notification sent
- [ ] Push notification received on device
- [ ] Zone breach alerts working
- [ ] Emergency alerts working
- [ ] Assignment notifications working

---

## 📞 **Support**

If you encounter issues:

1. **Check console logs** for error messages
2. **Verify Firebase configuration** matches project settings
3. **Test with simple notification** first
4. **Check device permissions** and notification settings
5. **Verify database connection** and table structure

---

**🎯 You now have a fully functional Firebase notification system for the Future Soldiers APK!**

The system will automatically:
- Send zone breach alerts to commanders
- Broadcast emergency alerts to relevant personnel
- Notify soldiers of new assignments
- Handle background notifications
- Manage user preferences
- Track delivery status


## Firebase Service Account Setup Guide
# 🔑 Firebase Service Account Setup Guide
## Future Soldiers APK - Backend Configuration

This guide will help you get the Firebase service account key needed for the backend to send push notifications.

---

## 🚀 **Step 1: Get Firebase Service Account Key**

### 1.1 Go to Firebase Console
- Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
- Select your **future-soldiers** project

### 1.2 Navigate to Service Accounts
- Click the **gear icon** (⚙️) next to "Project Overview"
- Select **Project settings**
- Go to **Service accounts** tab

### 1.3 Generate New Private Key
- Click **Generate new private key**
- Click **Generate key**
- Download the JSON file

### 1.4 File Structure
The downloaded file will look like this:
```json
{
  "type": "service_account",
  "project_id": "future-soldiers",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@future-soldiers.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40future-soldiers.iam.gserviceaccount.com"
}
```

---

## 📁 **Step 2: Configure Backend**

### 2.1 Option A: Use Environment Variable (Recommended)
Create `my-api/.env` file:

```env
# Database Configuration
PGHOST=117.251.19.107
PGUSER=postgres
PGPASSWORD=123456
PGDATABASE=OCFA
PGPORT=5433

# Server Configuration
PORT=3001
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=future-soldiers
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"future-soldiers","private_key_id":"YOUR_ACTUAL_PRIVATE_KEY_ID","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@future-soldiers.iam.gserviceaccount.com","client_id":"YOUR_ACTUAL_CLIENT_ID","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40future-soldiers.iam.gserviceaccount.com"}

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# CORS Configuration
CORS_ORIGIN=http://117.251.19.107:3000,http://192.168.1.100:3000

# Logging
LOG_LEVEL=info
```

**⚠️ IMPORTANT:** Replace the placeholder values with your actual service account details from the downloaded JSON file.

### 2.2 Option B: Use Service Account File
1. Rename the downloaded JSON file to `firebase-service-account.json`
2. Place it in the `my-api/` directory
3. Update `my-api/.env`:

```env
# Use file path instead of inline JSON
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

---

## 🔒 **Security Notes**

### Never Commit Service Account Keys
- Add `.env` to your `.gitignore` file
- Never commit the service account JSON file
- Use environment variables in production

### Production Security
- Restrict service account permissions
- Use IAM roles with minimal required access
- Rotate keys regularly

---

## ✅ **Verification Steps**

### 1. Test Backend Connection
```bash
cd my-api
npm start
```

Look for this message in console:
```
Firebase Admin SDK initialized successfully
```

### 2. Test Notification Sending
```bash
curl -X POST http://117.251.19.107:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "title": "Test Alert",
    "message": "Firebase is working!",
    "type": "info",
    "category": "system"
  }'
```

### 3. Check Database
```sql
-- Connect to your PostgreSQL database
psql -U postgres -d OCFA

-- Check if notifications table exists
\dt notifications

-- Check if FCM tokens are stored
SELECT username, fcm_token FROM users LIMIT 5;
```

---

## 🚨 **Troubleshooting**

### Common Issues:

#### 1. "Firebase Admin SDK not initialized"
- Check if service account key is valid
- Verify project ID matches
- Check file permissions

#### 2. "Invalid private key"
- Ensure private key includes newlines (`\n`)
- Check if key is properly escaped in .env
- Try using file path method instead

#### 3. "Permission denied"
- Verify service account has proper roles
- Check if project is active
- Ensure billing is enabled

### Debug Commands:
```bash
# Check environment variables
cd my-api
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# Test Firebase connection
node -e "
const admin = require('firebase-admin');
try {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error.message);
}
"
```

---

## 🎯 **Next Steps**

Once your service account is configured:

1. **Install Dependencies**: `npm install firebase-admin`
2. **Create Database Tables**: Run `database-schema.sql`
3. **Test Frontend**: Ensure FCM tokens are generated
4. **Send Test Notifications**: Verify end-to-end functionality

---

## 📞 **Support**

If you encounter issues:

1. **Check Firebase Console** for project status
2. **Verify Service Account** permissions and roles
3. **Test with Simple Example** first
4. **Check Console Logs** for detailed error messages

---

**🎯 Your Firebase service account is now configured for the Future Soldiers APK backend!**

The system will be able to:
- Send push notifications via Firebase Cloud Messaging
- Handle zone breach alerts
- Broadcast emergency notifications
- Manage assignment notifications
- Track delivery status

