import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { green } from '../theme';

export default function CustomHeader({ title, navigation, userRole, userName, unreadNotifications = 0, hideIcons = false }) {
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
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Profile', { 
              screen: 'Notifications',
              userRole,
              userName
            })}
          >
            <Icon name="notifications" size={24} color="#fff" />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setMenuVisible(true)}
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
    right: -10,
    backgroundColor: green.accent,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: green.dark,
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 