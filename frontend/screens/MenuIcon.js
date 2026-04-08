import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Modal, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';  // Import Ionicons
import { useNavigation } from '@react-navigation/native';  // Import the useNavigation hook
import AsyncStorage from '@react-native-async-storage/async-storage';

// Menu Icon component to be used in the header
const MenuIcon = ({ toggleDropdown, dropdownVisible, setDropdownVisible }) => {
  const navigation = useNavigation();  // Use the useNavigation hook to access navigation
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [logoutVisible, setLogoutVisible] = useState(false);

  // Load user data from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          setUserRole(user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '');
          setUserName(user.name || '');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
  }, []);

  const confirmAndLogout = async () => {
    try {
      setLogoutVisible(false);
      await AsyncStorage.removeItem('currentUser');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      setDropdownVisible(false);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Menu Icon only (remove duplicate bell) */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => toggleDropdown()}
      >
        <Icon name="menu" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Fullscreen modal for dropdown with overlay to close on outside tap */}
      {dropdownVisible && (
        <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
          <Pressable style={styles.overlay} onPress={() => setDropdownVisible(false)}>
            <View style={styles.menuDropdown}>
          {/* Role badge */}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{userRole}</Text>
          </View>

          {/* User name */}
          {userName && (
            <Text style={styles.userName}>{userName}</Text>
          )}

          {/* Profile option */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate('Profile');
              setDropdownVisible(false);
            }}
          >
            <Icon name="person" size={20} color="#2E3192" style={styles.menuIcon} />
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>Profile</Text>
              <Text style={styles.menuDescription}>User Information</Text>
            </View>
          </TouchableOpacity>
          
          {/* Notifications option */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate('Notifications');
              setDropdownVisible(false);
            }}
          >
            <Icon name="notifications" size={20} color="#2E3192" style={styles.menuIcon} />
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>Notifications</Text>
              <Text style={styles.menuDescription}>View Alerts & Messages</Text>
            </View>
          </TouchableOpacity>

          {/* Reports option */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate('Profile', { initialTab: 'reports' });
              setDropdownVisible(false);
            }}
          >
            <Icon name="document-text" size={20} color="#2E3192" style={styles.menuIcon} />
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>Reports</Text>
              <Text style={styles.menuDescription}>Incident & Activity Reports</Text>
            </View>
          </TouchableOpacity>
          
          {/* Logout button */}
          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem]}
            onPress={() => setLogoutVisible(true)}
          >
            <Icon name="log-out" size={20} color="#F44336" style={styles.menuIcon} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          
            {/* Version info */}
            <Text style={styles.versionText}>Military Personnel Tracker v1.0</Text>
            </View>
          </Pressable>
        </Modal>
      )}
      {/* Logout confirm modal */}
      <Modal visible={logoutVisible} transparent animationType="fade" onRequestClose={() => setLogoutVisible(false)}>
        <View style={styles.logoutBackdrop}>
          <View style={styles.logoutCard}>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutSubtitle}>Are you sure you want to logout?</Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity style={[styles.logoutBtn, styles.logoutCancel]} onPress={() => setLogoutVisible(false)}>
                <Text style={styles.logoutCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.logoutBtn, styles.logoutConfirm]} onPress={confirmAndLogout}>
                <Text style={styles.logoutConfirmText}>LOGOUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles for the dropdown menu items
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 50,
    paddingRight: 0,
  },
  iconButton: {
    marginLeft: 15,
  },
  menuDropdown: {
    position: 'relative',
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    padding: 15,
    zIndex: 1000,
  },
  roleBadge: {
    backgroundColor: '#2E3192',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginBottom: 10,
  },
  roleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDescription: {
    fontSize: 12,
    color: '#757575',
  },
  logoutItem: {
    marginTop: 5,
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '500',
  },
  versionText: {
    fontSize: 12,
    color: '#9e9e9e',
    textAlign: 'center',
    marginTop: 15,
  },
});

export default MenuIcon;
