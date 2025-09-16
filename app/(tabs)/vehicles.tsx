import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, TextInput, StyleSheet } from 'react-native';
import { VehicleApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Vehicle {
  id: number;
  vehicle_type?: string;
  make: string;
  model: string;
  year?: number;
  color: string;
  plate_number: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function VehiclesScreen() {
  const { updateCurrentVehicle } = useAuthStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_type: 'car',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    plate_number: '',
    capacity: 4
  });

  useEffect(() => {
    fetchVehicles();
    fetchCurrentVehicle();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await VehicleApi.getMyVehicles();
      setVehicles(response.data?.data || response.data || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentVehicle = async () => {
    try {
      const response = await VehicleApi.getCurrentVehicle();
      setCurrentVehicle(response.data?.data || response.data || null);
    } catch (error) {
      // Don't show alert for this as it's expected if no vehicle is set
    }
  };

  const handleSetCurrentVehicle = async (vehicleId: number) => {
    try {
      setLoading(true);
      await VehicleApi.setCurrentVehicle(vehicleId);
      
      // Find the vehicle that was set as current
      const selectedVehicle = vehicles.find(v => v.id === vehicleId);
      if (selectedVehicle) {
        // Update auth store with the new current vehicle
        const vehicleData = {
          id: selectedVehicle.id,
          vehicle_type: selectedVehicle.vehicle_type || 'car',
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          year: selectedVehicle.year,
          color: selectedVehicle.color,
          plate_number: selectedVehicle.plate_number,
          capacity: selectedVehicle.capacity,
        };
        
        console.log("🚗 Updating auth store with vehicle data:", vehicleData);
        await updateCurrentVehicle(vehicleData);
      }
      
      Alert.alert('Success', 'Current vehicle updated successfully');
      fetchCurrentVehicle();
    } catch (error) {
      Alert.alert('Error', 'Failed to set current vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.color || !newVehicle.plate_number) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await VehicleApi.registerVehicle(newVehicle);
      Alert.alert('Success', 'Vehicle added successfully');
      setShowAddForm(false);
      setNewVehicle({
        vehicle_type: 'car',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        plate_number: '',
        capacity: 4
      });
      fetchVehicles();
    } catch (error) {
      Alert.alert('Error', 'Failed to add vehicle');
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'car': return '🚗';
      case 'auto': return '🛺';
      case 'bike': return '🏍️';
      case 'suv': return '🚙';
      case 'truck': return '🚛';
      case 'van': return '🚐';
      default: return '🚗';
    }
  };

  const getVehicleTypeName = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'car': return 'Car';
      case 'auto': return 'Auto';
      case 'bike': return 'Bike';
      case 'suv': return 'SUV';
      case 'truck': return 'Truck';
      case 'van': return 'Van';
      default: return 'Car';
    }
  };

  if (loading && vehicles.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading vehicles...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Vehicles</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text style={styles.addButtonText}>+ Add Vehicle</Text>
        </TouchableOpacity>
      </View>

      {currentVehicle && (
        <View style={styles.currentVehicleCard}>
          <Text style={styles.currentVehicleTitle}>Current Active Vehicle</Text>
          <View style={styles.vehicleCard}>
            <Text style={styles.vehicleIcon}>{getVehicleIcon(currentVehicle.vehicle_type)}</Text>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>
                {currentVehicle.make} {currentVehicle.model}
              </Text>
              <Text style={styles.vehicleDetails}>
                {getVehicleTypeName(currentVehicle.vehicle_type)} • {currentVehicle.color} • {currentVehicle.plate_number}
              </Text>
              <Text style={styles.vehicleCapacity}>
                Capacity: {currentVehicle.capacity} passengers
              </Text>
            </View>
          </View>
        </View>
      )}

      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>Add New Vehicle</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.vehicleTypeSelector}>
              {['car', 'auto', 'bike', 'suv', 'truck', 'van'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    newVehicle.vehicle_type === type && styles.vehicleTypeButtonSelected
                  ]}
                  onPress={() => setNewVehicle({ ...newVehicle, vehicle_type: type })}
                >
                  <Text style={styles.vehicleTypeIcon}>{getVehicleIcon(type)}</Text>
                  <Text style={styles.vehicleTypeText}>{getVehicleTypeName(type)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Make *</Text>
            <TextInput
              style={styles.input}
              value={newVehicle.make}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, make: text })}
              placeholder="e.g., Toyota, Honda, Bajaj"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model *</Text>
            <TextInput
              style={styles.input}
              value={newVehicle.model}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, model: text })}
              placeholder="e.g., Camry, City, Pulsar"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Year</Text>
            <TextInput
              style={styles.input}
              value={newVehicle.year?.toString()}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, year: parseInt(text) || new Date().getFullYear() })}
              placeholder="e.g., 2020"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color *</Text>
            <TextInput
              style={styles.input}
              value={newVehicle.color}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, color: text })}
              placeholder="e.g., Red, Blue, White"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Plate Number *</Text>
            <TextInput
              style={styles.input}
              value={newVehicle.plate_number}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, plate_number: text })}
              placeholder="e.g., MH01AB1234"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Capacity</Text>
            <TextInput
              style={styles.input}
              value={newVehicle.capacity.toString()}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, capacity: parseInt(text) || 4 })}
              placeholder="e.g., 4"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAddForm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddVehicle}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Adding...' : 'Add Vehicle'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.vehiclesList}>
        <Text style={styles.sectionTitle}>All Vehicles ({vehicles.length})</Text>
        {vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No vehicles added yet</Text>
            <Text style={styles.emptyStateSubtext}>Add your first vehicle to get started</Text>
          </View>
        ) : (
          vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <Text style={styles.vehicleIcon}>{getVehicleIcon(vehicle.vehicle_type)}</Text>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>
                  {vehicle.make} {vehicle.model}
                </Text>
                <Text style={styles.vehicleDetails}>
                  {getVehicleTypeName(vehicle.vehicle_type)} • {vehicle.color} • {vehicle.plate_number}
                </Text>
                <Text style={styles.vehicleCapacity}>
                  Capacity: {vehicle.capacity} passengers
                </Text>
                {vehicle.year && (
                  <Text style={styles.vehicleYear}>Year: {vehicle.year}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.setCurrentButton,
                  currentVehicle?.id === vehicle.id && styles.currentVehicleButton
                ]}
                onPress={() => handleSetCurrentVehicle(vehicle.id)}
                disabled={currentVehicle?.id === vehicle.id || loading}
              >
                <Text style={[
                  styles.setCurrentButtonText,
                  currentVehicle?.id === vehicle.id && styles.currentVehicleButtonText
                ]}>
                  {currentVehicle?.id === vehicle.id ? 'Current' : 'Set Current'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  currentVehicleCard: {
    marginBottom: 20,
  },
  currentVehicleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 12,
  },
  vehicleCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  vehicleCapacity: {
    fontSize: 12,
    color: '#9ca3af',
  },
  vehicleYear: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  addForm: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  vehicleTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    minWidth: 80,
  },
  vehicleTypeButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  vehicleTypeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  vehicleTypeText: {
    fontSize: 12,
    color: '#374151',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  vehiclesList: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  setCurrentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  currentVehicleButton: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  setCurrentButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  currentVehicleButtonText: {
    color: '#16a34a',
  },
});
