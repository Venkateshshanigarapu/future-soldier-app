import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { green } from '../theme';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { addLanguageChangeListener } from '../utils/i18n';

export default function AmmoScreen() {
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [showRequestCard, setShowRequestCard] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [requestType, setRequestType] = useState('ammunition');
  const [urgency, setUrgency] = useState('low');
  const [details, setDetails] = useState('');
  const [showDamageCard, setShowDamageCard] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState('');
  const [damageUrgency, setDamageUrgency] = useState('low');
  const [damageDetails, setDamageDetails] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('currentUser');
        if (stored) {
          const user = JSON.parse(stored);
          setCurrentUser(user);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading user:', error);
        }
      }
    };

    const loadApprovedRequests = async () => {
      try {
        // Get all supply requests for this soldier with status 'approved'
        const userData = await AsyncStorage.getItem('currentUser');
        if (userData) {
          const user = JSON.parse(userData);
          
          // Fetch supply requests for this soldier
          const requests = await apiService.getSupplyRequests({ 
            soldier_id: user.id,
            status: 'approved' 
          });
          
          console.log('Approved requests:', requests);
          setApprovedRequests(Array.isArray(requests) ? requests : []);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading approved requests:', error);
        }
        setApprovedRequests([]);
      }
    };

    loadUser();
    loadApprovedRequests();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* main card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="shield-checkmark" size={20} color={green.primary} />
          <Text style={styles.cardTitle}>
            Ammunition Management
          </Text>
        </View>

        {/* inner Card - Approved Ammunition */}
        <View style={styles.innerCard}>
          <View style={styles.cardHeader}>
            <Icon name="layers" size={20} color={green.primary} />
            <Text style={styles.innerCardTitle}>
              Your Approved Ammunition
            </Text>
          </View>

          {/* Approved requests inventory */}
          <View style={{ marginTop: 12 }}>
            {approvedRequests.length > 0 ? (
              approvedRequests.map((request, index) => (
                <View key={request.id || index} style={styles.ammoItem}>
                  <View style={styles.ammoHeader}>
                    <Text style={styles.ammoName}>
                      Request #{request.id}
                    </Text>
                    <View style={styles.approvedBadge}>
                      <Text style={styles.approvedBadgeText}>APPROVED</Text>
                    </View>
                  </View>
                  <Text style={styles.ammoDetails}>
                    Type: {request.type}
                  </Text>
                  <Text style={styles.ammoDetails}>
                    Details: {request.details || 'No details provided'}
                  </Text>
                  <Text style={styles.ammoDate}>
                    Approved: {new Date(request.processed_at || request.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noAmmoText}>
                No approved ammunition available
              </Text>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setShowRequestCard(true);
                setShowDamageCard(false);
              }}
            >
              <Text style={styles.primaryButtonText}>
                Request New Ammunition
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => {
                if (approvedRequests.length === 0) {
                  Alert.alert('Error', 'No approved ammunition to report damage for');
                  return;
                }
                setShowDamageCard(true);
                setShowRequestCard(false);
              }}
            >
              <Text style={styles.outlineButtonText}>
                Report Damaged Ammunition
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Request supplies card */}
        {showRequestCard && (
          <View style={styles.requestCard}>
            <Text style={styles.requestCardTitle}>
              New Ammunition Request
            </Text>

            <View style={styles.subFormCard}>
              <Text style={styles.reqFormTitle}>
                Request Ammunition
              </Text>

              {/* Soldier */}
              <Text style={styles.label}>Soldier</Text>
              <Text style={styles.readOnlyField}>
                {currentUser?.username || 'Loading...'}
              </Text>

              {/* Request Type - Fixed as ammunition */}
              <Text style={styles.label}>Request Type</Text>
              <Text style={styles.readOnlyField}>
                Ammunition
              </Text>

              {/* Urgency */}
              <Text style={styles.label}>Urgency</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={urgency}
                  onValueChange={(value) => setUrgency(value)}
                >
                  <Picker.Item label="Low" value="low" />
                  <Picker.Item label="Medium" value="medium" />
                  <Picker.Item label="High" value="high" />
                </Picker>
              </View>

              {/* Details */}
              <Text style={styles.label}>Details</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe what ammunition you need (type, quantity, etc.)"
                multiline
                numberOfLines={4}
                value={details}
                onChangeText={setDetails}
              />

              {/* Submit Button */}
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={async () => {
                  try {
                    if (!details.trim()) {
                      Alert.alert('Error', 'Please enter request details');
                      return;
                    }

                    if (!currentUser?.id) {
                      Alert.alert('Error', 'User not found. Please login again.');
                      return;
                    }

                    const response = await apiService.createSupplyRequest({
                      soldier_id: currentUser.id,
                      type: 'ammunition',
                      urgency: urgency,
                      details: details
                    });

                    Alert.alert('Success', 'Request Submitted. Waiting for approval.');

                    // Reset form
                    setShowRequestCard(false);
                    setDetails('');
                    setUrgency('low');

                  } catch (error) {
                    if (__DEV__) {
                      console.error('Submit error:', error);
                    }
                    Alert.alert('Error', error.message || 'Server not reachable. Please check your connection.');
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>
                  Submit Request
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Damage Report Card */}
        {showDamageCard && approvedRequests.length > 0 && (
          <View style={styles.requestCard}>
            <Text style={styles.requestCardTitle}>
              Report Damaged Ammunition
            </Text>

            <View style={styles.subFormCard}>
              <Text style={styles.reqFormTitle}>
                Select ammunition to report as damaged
              </Text>

              {/* Select Approved Request */}
              <Text style={styles.label}>Select Ammunition</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedRequest}
                  onValueChange={(value) => setSelectedRequest(value)}
                >
                  <Picker.Item label="Select approved ammunition" value="" />
                  {approvedRequests.map((request) => (
                    <Picker.Item
                      key={request.id}
                      label={`Request #${request.id} - ${request.details?.substring(0, 30)}...`}
                      value={request.id.toString()}
                    />
                  ))}
                </Picker>
              </View>

              {/* Urgency */}
              <Text style={styles.label}>Urgency</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={damageUrgency}
                  onValueChange={(value) => setDamageUrgency(value)}
                >
                  <Picker.Item label="Low" value="low" />
                  <Picker.Item label="Medium" value="medium" />
                  <Picker.Item label="High" value="high" />
                </Picker>
              </View>

              {/* Damage Details */}
              <Text style={styles.label}>Damage Details</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the damage..."
                multiline
                numberOfLines={4}
                value={damageDetails}
                onChangeText={setDamageDetails}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  try {
                    if (!selectedRequest) {
                      Alert.alert('Error', 'Please select ammunition');
                      return;
                    }

                    if (!damageDetails.trim()) {
                      Alert.alert('Error', 'Please describe the damage');
                      return;
                    }

                    if (!currentUser?.id) {
                      Alert.alert('Error', 'User not found. Please login again.');
                      return;
                    }

                    // Find the selected request details
                    const selectedRequestItem = approvedRequests.find(r => r.id.toString() === selectedRequest);

                    const response = await apiService.createDamagedRequest({
                      soldier_id: currentUser.id,
                      category: 'ammunition',
                      item_name: `Supply Request #${selectedRequest}`,
                      item_identifier: selectedRequest,
                      urgency: damageUrgency,
                      description: `Original Request: ${selectedRequestItem?.details || 'N/A'}\nDamage Report: ${damageDetails}`
                    });

                    Alert.alert('Success', 'Damage Report Submitted');

                    // Reset form
                    setShowDamageCard(false);
                    setSelectedRequest('');
                    setDamageDetails('');
                    setDamageUrgency('low');

                  } catch (error) {
                    if (__DEV__) {
                      console.error('Submit damage error:', error);
                    }
                    Alert.alert('Error', error.message || 'Failed to submit damage report');
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>
                  Submit Damage Report
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  content: {
    padding: 16
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8
  },
  innerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  innerCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8
  },
  ammoItem: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  ammoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  ammoName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#111827'
  },
  approvedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  approvedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700'
  },
  ammoDetails: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2
  },
  ammoDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4
  },
  noAmmoText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20
  },
  buttonRow: {
    marginTop: 16,
    gap: 12
  },
  primaryButton: {
    backgroundColor: '#00FF00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  outlineButton: {
    borderWidth: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  outlineButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  requestCard: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  requestCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827'
  },
  subFormCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  reqFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
    color: '#374151'
  },
  readOnlyField: {
    padding: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    color: '#374151'
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#fff'
  },
});