import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { green } from '../theme';
import { apiService } from '../services/api';

export default function AssignmentEditScreen({ route, navigation }) {
  const assignment = route?.params?.assignment || {};
  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [status, setStatus] = useState(assignment.status || 'pending');

  const onSave = async () => {
    try {
      if (!assignment?.id) return Alert.alert('Error', 'Missing assignment id');
      await apiService.updateAssignment(assignment.id, {
        assignment_name: title,
        brief_description: description,
        status,
      });
      Alert.alert('Success', 'Assignment updated successfully');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update assignment');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Assignment title" />

      <Text style={styles.label}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} style={[styles.input, { height: 100 }]} multiline placeholder="Description" />

      <Text style={styles.label}>Status</Text>
      <TextInput value={status} onChangeText={setStatus} style={styles.input} placeholder="pending | in_progress | completed | cancelled" />

      <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: green.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});


