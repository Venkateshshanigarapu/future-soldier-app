import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

export default function ZoneBreachNotification({ notification, onPress, onDelete, index }) {
  const getBreachIcon = (breachType, severity) => {
    if (breachType === 'exit') {
      return severity === 'critical' ? 'exit-outline' : 'walk-outline';
    } else if (breachType === 'unauthorized_entry') {
      return 'warning';
    } else if (breachType === 'zone_return') {
      return 'checkmark-circle';
    }
    return 'location-outline';
  };

  const getSeverityColor = (severity, breachType) => {
    // Zone returns are always green regardless of severity
    if (breachType === 'zone_return') {
      return '#10B981'; // Green
    }

    switch (severity) {
      case 'critical': return '#DC2626'; // Red
      case 'high': return '#F59E0B'; // Orange
      case 'medium': return '#10B981'; // Green
      default: return '#6B7280'; // Gray
    }
  };

  const getSeverityText = (severity) => {
    const normalized = (severity || '').toLowerCase();
    const key = `notificationSeverityLabels.${normalized}`;
    const translation = i18n.t(key);
    return translation === key ? (severity ? severity.toUpperCase() : '') : translation;
  };

  const getBreachTypeText = (breachType) => {
    const normalized = breachType || 'default';
    const key = `zoneBreachType.${normalized}`;
    const translation = i18n.t(key);
    return translation === key ? normalized : translation;
  };

  const breachType = notification.breachType || notification.data?.breachType || notification.type || 'exit';
  const severityColor = getSeverityColor(notification.severity || 'medium', breachType);
  const zoneName = notification.zoneName || notification.data?.zoneName || i18n.t('unknownZone');
  const soldierName = notification.soldierName || notification.data?.soldierName;
  const isCommanderView = !!soldierName; // If soldierName exists, this is a commander view
  const dateLocale = getDateFnsLocale();

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: severityColor }]}
      onPress={() => onPress && onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Header with severity and time */}
        <View style={styles.header}>
          <View style={styles.severityContainer}>
            <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
              <Text style={styles.severityText}>
                {getSeverityText(notification.severity || 'medium')}
              </Text>
            </View>
            <View style={styles.breachTypeContainer}>
              <Icon
                name={getBreachIcon(breachType, notification.severity)}
                size={16}
                color={severityColor}
              />
              <Text style={[styles.breachTypeText, { color: severityColor }]}>
                {getBreachTypeText(breachType)}
              </Text>
            </View>
          </View>
          <Text style={styles.timestamp}>
            {formatDistanceToNow(new Date(notification.timestamp || notification.created_at), { addSuffix: true, locale: dateLocale })}
          </Text>
        </View>

        {/* Main content */}
        <View style={styles.mainContent}>
          <View style={styles.zoneInfo}>
            <Icon name="location" size={20} color="#6B7280" />
            <View style={styles.zoneDetails}>
              <Text style={styles.zoneName}>{zoneName}</Text>
              <Text style={styles.zoneType}>
                {notification.zoneType || notification.data?.zoneType || i18n.t('operationalZone')}
              </Text>
            </View>
          </View>

          {/* Soldier info for commanders */}
          {isCommanderView && (
            <View style={styles.soldierInfo}>
              <Icon name="person" size={16} color="#6B7280" />
              <Text style={styles.soldierName}>{soldierName}</Text>
            </View>
          )}

          {/* Action required indicator */}
          {notification.requiresAction && (
            <View style={styles.actionRequired}>
              <Icon name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.actionText}>{i18n.t('actionRequired')}</Text>
            </View>
          )}
        </View>

        {/* Status indicator */}
        <View style={styles.footer}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, {
              backgroundColor: notification.read ? '#10B981' : severityColor
            }]} />
            <Text style={styles.statusText}>
              {notification.read ? i18n.t('acknowledged') : i18n.t('newAlert')}
            </Text>
          </View>

          <View style={styles.footerRight}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete && onDelete(notification.id)}
              activeOpacity={0.7}
            >
              <Icon name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>

            {!notification.read && (
              <View style={styles.unreadIndicator}>
                <View style={styles.unreadDot} />
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  breachTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breachTypeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  mainContent: {
    marginBottom: 12,
  },
  zoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneDetails: {
    marginLeft: 8,
    flex: 1,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  zoneType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  soldierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  soldierName: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    marginLeft: 4,
  },
  actionRequired: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  actionText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});
