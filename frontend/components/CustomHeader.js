import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { green } from '../theme';

export default function CustomHeader({ title, navigation, userRole, userName, unreadNotifications = 0, hideIcons = false, onMenuPress, showLanguageIcon = false, onPressLanguage }) {
  const [menuVisible, setMenuVisible] = useState(false);
  
  const handleLogout = () => {
    setMenuVisible(false);
    navigation.navigate('Login');
  };
  
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      
      {!hideIcons && (
        <View style={styles.rightIcons}>
          {showLanguageIcon && (
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => {
                if (typeof onPressLanguage === 'function') onPressLanguage();
              }}
              accessibilityLabel="Change language"
            >
              <Icon name="globe-outline" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon name="notifications" size={24} color="#fff" />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : String(unreadNotifications)}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => {
              if (typeof onMenuPress === 'function') {
                onMenuPress();
              } else {
                navigation.navigate('MoreOptions');
              }
            }}
          >
            <Icon name="menu" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Define styles
const styles = StyleSheet.create({
  header: {
    backgroundColor: green.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: green.background,
    fontSize: 20,
    fontWeight: 'bold',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 16,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
}); 