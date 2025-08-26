import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

export default function AssignmentScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user.id);
          // Fetch tasks for this soldier
          const response = await apiService.getTasksForSoldier(user.id);
          setTasks(response.tasks || []);
        }
      } catch (err) {
        setError('Failed to load tasks.');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const renderTask = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="clipboard-outline" size={24} color="#2E3192" style={styles.icon} />
        <Text style={styles.title}>Zone ID: {item.zone_id}</Text>
      </View>
      <View style={styles.infoRow}>
        <Icon name="person-add-outline" size={16} color="#757575" style={styles.infoIcon} />
        <Text style={styles.infoText}>Assigned By: {item.assigned_by || '-'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Icon name="person-circle-outline" size={16} color="#757575" style={styles.infoIcon} />
        <Text style={styles.infoText}>Created By: {item.created_by || '-'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2E3192" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        renderItem={renderTask}
        contentContainerStyle={tasks.length === 0 ? styles.centered : undefined}
        ListEmptyComponent={<Text style={styles.empty}>No zone assignments found.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E3192',
  },
  description: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  infoIcon: {
    marginRight: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#757575',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: '#F44336',
    fontSize: 16,
  },
  empty: {
    color: '#757575',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
}); 