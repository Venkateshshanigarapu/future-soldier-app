import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Alert, RefreshControl } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { green } from '../theme';

export default function SoldierDetailScreen({ navigation, route }) {
  const initialSoldier = route.params?.soldier || {};
  const [soldier, setSoldier] = useState(initialSoldier);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCommander, setIsCommander] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', priority: '', status: '' });
  const [editSoldierVisible, setEditSoldierVisible] = useState(false);
  const [soldierForm, setSoldierForm] = useState({ name: '', email: '', unit: '', MobileNumber: '' });
  const [savingSoldier, setSavingSoldier] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        if (!initialSoldier?.username) return;
        setLoading(true);
        const latest = await apiService.getUserByUsername(initialSoldier.username);
        if (latest) setSoldier({ ...initialSoldier, ...latest });
      } catch {}
      finally { setLoading(false); }
    };
    fetchLatest();
  }, [initialSoldier?.username]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setAssignmentsLoading(true);
        // Backend does not expose soldier-specific filter; fetch all and filter by assigned_commander or objectives containing soldier id/username if available.
        const list = await apiService.getAssignments({ limit: 200 });
        const userIdStr = String(soldier.id || soldier.username || '').toLowerCase();
        const filtered = (list || []).filter(a => {
          const text = `${a.title || ''} ${a.description || ''} ${a.objectives || ''}`.toLowerCase();
          return userIdStr && text.includes(userIdStr);
        });
        setAssignments(filtered);
      } catch (e) {
        setAssignments([]);
      } finally {
        setAssignmentsLoading(false);
      }
    };
    loadAssignments();
  }, [soldier?.id, soldier?.username]);

  // Determine if current user is commander to allow editing
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('currentUser');
        if (stored) {
          const me = JSON.parse(stored);
          setIsCommander(String(me?.role || '').trim().toLowerCase() === 'commander');
        }
      } catch {}
    })();
  }, []);

  const openEdit = (a) => {
    setEditingAssignment(a);
    setForm({
      title: a.title || '',
      description: a.description || '',
      priority: a.priority || '',
      status: a.status || 'pending',
    });
    setEditModalVisible(true);
  };

  const resetAssignmentForm = () => {
    setForm({
      title: '',
      description: '',
      priority: '',
      status: 'pending',
    });
    setEditingAssignment(null);
  };

  const saveEdit = async () => {
    try {
      if (!editingAssignment?.id) {
        Alert.alert('Error', 'Assignment ID not found');
        return;
      }

      // Validate form
      if (!form.title || form.title.trim().length === 0) {
        Alert.alert('Validation Error', 'Title is required');
        return;
      }

      if (!form.status || form.status.trim().length === 0) {
        Alert.alert('Validation Error', 'Status is required');
        return;
      }

      setSavingAssignment(true);

      await apiService.updateAssignment(editingAssignment.id, {
        assignment_name: form.title,
        brief_description: form.description,
        priority: form.priority,
        status: form.status,
      });
      
      setEditModalVisible(false);
      
      // refresh list
      const list = await apiService.getAssignments({ limit: 200 });
      const userIdStr = String(soldier.id || soldier.username || '').toLowerCase();
      const filtered = (list || []).filter(a => {
        const text = `${a.title || ''} ${a.description || ''} ${a.objectives || ''}`.toLowerCase();
        return userIdStr && text.includes(userIdStr);
      });
      setAssignments(filtered);
      
      Alert.alert('Success', 'Assignment updated successfully');
    } catch (error) {
      console.error('Error updating assignment:', error);
      Alert.alert('Error', `Failed to update assignment: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingAssignment(false);
    }
  };

  // Initialize soldier form with current values
  const openEditSoldier = () => {
    setSoldierForm({
      name: soldier.name || '',
      email: soldier.email || '',
      unit: soldier.unit || '',
      MobileNumber: soldier.MobileNumber || soldier.phone || '',
    });
    setEditSoldierVisible(true);
  };

  const resetSoldierForm = () => {
    setSoldierForm({
      name: '',
      email: '',
      unit: '',
      MobileNumber: '',
    });
  };

  // Validate soldier form
  const validateSoldierForm = () => {
    if (!soldierForm.name || soldierForm.name.trim().length === 0) {
      Alert.alert('Validation Error', 'Name is required');
      return false;
    }
    if (soldierForm.email && !soldierForm.email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }
    if (!soldierForm.unit || soldierForm.unit.trim().length === 0) {
      Alert.alert('Validation Error', 'Unit is required');
      return false;
    }
    return true;
  };

  // Save soldier details
  const saveSoldier = async () => {
    if (!validateSoldierForm()) return;
    
    setSavingSoldier(true);
    try {
      // Prepare the payload with only the fields that have values
      const payload = {};
      if (soldierForm.name.trim()) payload.name = soldierForm.name.trim();
      if (soldierForm.email.trim()) payload.email = soldierForm.email.trim();
      if (soldierForm.unit.trim()) payload.unit = soldierForm.unit.trim();
      if (soldierForm.MobileNumber.trim()) payload.MobileNumber = soldierForm.MobileNumber.trim();

      console.log('Updating soldier with payload:', payload);
      console.log('Soldier ID:', soldier.id);

      const updatedSoldier = await apiService.updateUser(soldier.id, payload);
      console.log('Update response:', updatedSoldier);

      // Update local state
      setSoldier({ ...soldier, ...updatedSoldier });
      setEditSoldierVisible(false);
      
      Alert.alert('Success', 'Soldier details updated successfully');
    } catch (error) {
      console.error('Error updating soldier:', error);
      Alert.alert('Error', `Failed to update soldier: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingSoldier(false);
    }
  };

  const Field = ({ label, value }) => (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ?? '-'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}> 
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={22} color={green.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Soldier Details</Text>
        </View>

        <View style={styles.card}>
          <Field label="Full Name" value={soldier.name} />
          <Field label="Soldier ID" value={soldier.username || String(soldier.id || '')} />
          <Field label="Rank" value={soldier.rank} />
          <Field label="Unit" value={soldier.unit} />
          <Field label="Status" value={soldier.status || 'Active'} />
          {isCommander && (
            <TouchableOpacity
              style={styles.editSoldierBtn}
              onPress={openEditSoldier}
            >
              <Icon name="create-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.editSoldierBtnText}>Edit Soldier</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { marginTop: 12 }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.subTitle}>Assignments</Text>
            <TouchableOpacity onPress={async () => {
              // Optional: navigate to create assignment or add inline creation later
              const list = await apiService.getAssignments({ limit: 200 });
              const userIdStr = String(soldier.id || soldier.username || '').toLowerCase();
              const filtered = (list || []).filter(a => {
                const text = `${a.title || ''} ${a.description || ''} ${a.objectives || ''}`.toLowerCase();
                return userIdStr && text.includes(userIdStr);
              });
              setAssignments(filtered);
            }}>
              <Icon name="refresh" size={20} color={green.primary} />
            </TouchableOpacity>
          </View>

          {assignmentsLoading ? (
            <Text style={{ color: '#666', marginTop: 8 }}>Loading assignments...</Text>
          ) : assignments.length === 0 ? (
            <Text style={{ color: '#777', marginTop: 8 }}>No assignments found for this soldier.</Text>
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(a) => a.id?.toString() || Math.random().toString()}
              renderItem={({ item }) => (
                <View style={styles.assignmentItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignmentTitle}>{item.title || 'Untitled'}</Text>
                    <Text style={styles.assignmentMeta}>Priority: {item.priority || '-'} • Status: {(item.status || '').replace(/_/g,' ')}</Text>
                    {item.description ? <Text style={styles.assignmentDesc}>{item.description}</Text> : null}
                  </View>
                  {isCommander && (
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                      <Icon name="create-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
                setRefreshing(true);
                try {
                  const list = await apiService.getAssignments({ limit: 200 });
                  const userIdStr = String(soldier.id || soldier.username || '').toLowerCase();
                  const filtered = (list || []).filter(a => {
                    const text = `${a.title || ''} ${a.description || ''} ${a.objectives || ''}`.toLowerCase();
                    return userIdStr && text.includes(userIdStr);
                  });
                  setAssignments(filtered);
                } catch {}
                setRefreshing(false);
              }} />}
            />
          )}
        </View>

        <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={styles.modalTitle}>Edit Assignment</Text>
                <TouchableOpacity onPress={() => {
                  setEditModalVisible(false);
                  resetAssignmentForm();
                }}>
                  <Icon name="close" size={22} color="#333"/>
                </TouchableOpacity>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter assignment title" 
                  value={form.title} 
                  onChangeText={(v) => setForm({ ...form, title: v })}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput 
                  style={[styles.input, { height: 80 }]} 
                  multiline 
                  placeholder="Enter assignment description" 
                  value={form.description} 
                  onChangeText={(v) => setForm({ ...form, description: v })}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Priority</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="High/Medium/Low" 
                  value={form.priority} 
                  onChangeText={(v) => setForm({ ...form, priority: v })}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Status *</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="pending/in_progress/completed/cancelled" 
                  value={form.status} 
                  onChangeText={(v) => setForm({ ...form, status: v })}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={[styles.cancelBtn, { marginRight: 10 }]} 
                  onPress={() => {
                    setEditModalVisible(false);
                    resetAssignmentForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveBtn, { flex: 1 }]} 
                  onPress={saveEdit}
                  disabled={savingAssignment}
                >
                  {savingAssignment ? (
                    <Text style={styles.saveBtnText}>Saving...</Text>
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
              </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={editSoldierVisible} transparent animationType="fade" onRequestClose={() => setEditSoldierVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={styles.modalTitle}>Edit Soldier Details</Text>
                <TouchableOpacity onPress={() => {
                  setEditSoldierVisible(false);
                  resetSoldierForm();
                }}>
                  <Icon name="close" size={22} color="#333"/>
                </TouchableOpacity>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter full name" 
                  value={soldierForm.name} 
                  onChangeText={(v) => setSoldierForm({ ...soldierForm, name: v })}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter email address" 
                  value={soldierForm.email} 
                  onChangeText={(v) => setSoldierForm({ ...soldierForm, email: v })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Unit *</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter unit" 
                  value={soldierForm.unit} 
                  onChangeText={(v) => setSoldierForm({ ...soldierForm, unit: v })}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter mobile number" 
                  value={soldierForm.MobileNumber} 
                  onChangeText={(v) => setSoldierForm({ ...soldierForm, MobileNumber: v })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={[styles.cancelBtn, { marginRight: 10 }]} 
                  onPress={() => {
                    setEditSoldierVisible(false);
                    resetSoldierForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveBtn, { flex: 1 }]} 
                  onPress={saveSoldier}
                  disabled={savingSoldier}
                >
                  {savingSoldier ? (
                    <Text style={styles.saveBtnText}>Saving...</Text>
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
              </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {loading ? (
          <Text style={{ textAlign: 'center', color: '#666', marginTop: 8 }}>Refreshing...</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: green.background },
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 6, marginRight: 6 },
  title: { fontSize: 18, fontWeight: 'bold', color: green.primary },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, elevation: 2 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  fieldLabel: { color: '#555', fontWeight: '600' },
  fieldValue: { color: '#222', fontWeight: 'bold' },
  subTitle: { fontSize: 16, fontWeight: 'bold', color: green.primary },
  assignmentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 10, padding: 10, marginTop: 10 },
  assignmentTitle: { fontWeight: 'bold', color: '#222' },
  assignmentMeta: { color: '#555', marginTop: 2 },
  assignmentDesc: { color: '#666', marginTop: 4 },
  editBtn: { backgroundColor: green.primary, borderRadius: 20, padding: 8, marginLeft: 10 },
  editSoldierBtn: { 
    alignSelf: 'flex-end', 
    backgroundColor: green.primary, 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  editSoldierBtnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 14
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: green.primary },
  formGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    fontSize: 16,
    backgroundColor: '#fff'
  },
  buttonGroup: { 
    flexDirection: 'row', 
    marginTop: 20 
  },
  saveBtn: { 
    backgroundColor: green.primary, 
    borderRadius: 8, 
    paddingVertical: 12, 
    alignItems: 'center' 
  },
  saveBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  cancelBtn: { 
    backgroundColor: '#6c757d', 
    borderRadius: 8, 
    paddingVertical: 12, 
    alignItems: 'center',
    paddingHorizontal: 20
  },
  cancelBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
});


