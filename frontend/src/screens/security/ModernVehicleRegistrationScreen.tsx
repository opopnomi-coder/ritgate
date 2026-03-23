import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SecurityPersonnel, ScreenName } from '../../types';
import { apiService } from '../../services/api';
import SecurityBottomNav from '../../components/SecurityBottomNav';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface ModernVehicleRegistrationScreenProps {
  security: SecurityPersonnel;
  onBack: () => void;
  onNavigate: (screen: ScreenName) => void;
}

interface Vehicle {
  id: number;
  licensePlate: string;
  vehicleType: string;
  ownerName: string;
  ownerPhone: string;
  registeredAt: string;
}

const ModernVehicleRegistrationScreen: React.FC<ModernVehicleRegistrationScreenProps> = ({
  security,
  onBack,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Vehicle[]>([]);
  const [recentVehicles, setRecentVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Registration form
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE' | 'TRUCK' | ''>('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerType, setOwnerType] = useState<'VISITOR' | 'DELIVERY' | 'CONTRACTOR' | 'VENDOR' | 'STUDENT' | 'FACULTY' | 'STAFF'>('VISITOR');

  const vehicleTypes = [
    { id: 'CAR', label: 'Car', icon: 'car' },
    { id: 'BIKE', label: 'Bike', icon: 'bicycle' },
    { id: 'TRUCK', label: 'Truck', icon: 'bus' },
  ];

  const ownerTypes = [
    { id: 'VISITOR', label: 'Visitor', icon: 'person' },
    { id: 'DELIVERY', label: 'Delivery', icon: 'cube' },
    { id: 'CONTRACTOR', label: 'Contractor', icon: 'construct' },
    { id: 'VENDOR', label: 'Vendor', icon: 'storefront' },
    { id: 'STUDENT', label: 'Student', icon: 'school' },
    { id: 'FACULTY', label: 'Faculty', icon: 'briefcase' },
    { id: 'STAFF', label: 'Staff', icon: 'people' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await apiService.searchVehicle(searchQuery);
      if (response.success && response.data && response.data.length > 0) {
        setSearchResults(response.data);
        const vehicle = response.data[0];
        fillFormWithVehicleData(vehicle);
        setSuccessMessage('Vehicle details have been loaded. You can update the information if needed.');
        setShowSuccessModal(true);
      } else {
        setSearchResults([]);
        setErrorMessage('No vehicles found with that license plate. You can register a new vehicle.');
        setShowErrorModal(true);
      }
    } catch (error) {
      setErrorMessage('Failed to search vehicle');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const fillFormWithVehicleData = (vehicle: any) => {
    setLicensePlate(vehicle.licensePlate || '');
    setVehicleType(vehicle.vehicleType?.toUpperCase() || '');
    setVehicleModel(vehicle.vehicleModel || vehicle.model || '');
    setVehicleColor(vehicle.vehicleColor || vehicle.color || '');
    setOwnerName(vehicle.ownerName || '');
    setOwnerPhone(vehicle.ownerPhone || vehicle.contactNumber || '');
    setOwnerType(vehicle.ownerType || 'VISITOR');
  };

  const handleRegister = () => {
    if (!licensePlate.trim() || !vehicleType || !ownerName.trim() || !ownerPhone.trim()) {
      setErrorMessage('Please fill all required fields');
      setShowErrorModal(true);
      return;
    }

    const payload = {
      licensePlate: licensePlate.toUpperCase(),
      vehicleType,
      vehicleModel: vehicleModel.trim() || 'Not specified',
      vehicleColor: vehicleColor.trim() || 'Not specified',
      ownerName,
      ownerPhone,
      ownerType,
      registeredBy: security.securityId,
    };
    resetForm();
    setSuccessMessage('Vehicle registered successfully');
    setShowSuccessModal(true);
    apiService.registerVehicle(payload).catch(err => console.error('Vehicle registration error:', err));
  };

  const resetForm = () => {
    setLicensePlate('');
    setVehicleType('');
    setVehicleModel('');
    setVehicleColor('');
    setOwnerName('');
    setOwnerPhone('');
    setOwnerType('VISITOR');
  };

  const getVehicleIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'CAR': return 'car';
      case 'BIKE': return 'bicycle';
      case 'TRUCK': return 'bus';
      default: return 'car';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Registration</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Vehicle</Text>
          <View style={styles.searchCard}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Enter license plate number"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeader}>
                Found {searchResults.length} vehicle{searchResults.length > 1 ? 's' : ''}. Tap to load details.
              </Text>
              {searchResults.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={styles.vehicleCard}
                  onPress={() => {
                    fillFormWithVehicleData(vehicle);
                    setSuccessMessage('Vehicle details have been loaded into the form. You can update the information if needed.');
                    setShowSuccessModal(true);
                  }}
                >
                  <View style={styles.vehicleIcon}>
                    <Ionicons name={getVehicleIcon(vehicle.vehicleType) as any} size={24} color="#00BCD4" />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                    <Text style={styles.vehicleType}>{vehicle.vehicleType}</Text>
                    <Text style={styles.vehicleOwner}>{vehicle.ownerName}</Text>
                  </View>
                  <Ionicons name="arrow-down-circle" size={20} color="#00BCD4" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Registration Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {searchResults.length > 0 ? 'Update Vehicle Details' : 'Register New Vehicle'}
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Owner Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ownerTypeScroll}>
              <View style={styles.ownerTypeChips}>
                {ownerTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.ownerTypeChip,
                      ownerType === type.id && styles.ownerTypeChipActive
                    ]}
                    onPress={() => setOwnerType(type.id as any)}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={18}
                      color={ownerType === type.id ? '#FFF' : '#6B7280'}
                    />
                    <Text style={[
                      styles.ownerTypeChipText,
                      ownerType === type.id && styles.ownerTypeChipTextActive
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>License Plate *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="card-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="e.g., KA01AB1234"
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle Type *</Text>
            <View style={styles.typeChips}>
              {vehicleTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeChip,
                    vehicleType === type.id && styles.typeChipActive
                  ]}
                  onPress={() => setVehicleType(type.id as any)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={20}
                    color={vehicleType === type.id ? '#FFF' : '#6B7280'}
                  />
                  <Text style={[
                    styles.typeChipText,
                    vehicleType === type.id && styles.typeChipTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle Model</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="car-sport-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="e.g., Honda Activa, Maruti Swift"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle Color</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="color-palette-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="e.g., Red, Blue, Black"
                value={vehicleColor}
                onChangeText={setVehicleColor}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Owner Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Enter owner name"
                value={ownerName}
                onChangeText={setOwnerName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Owner Phone *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                value={ownerPhone}
                onChangeText={setOwnerPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.registerButtonText}>
              {searchResults.length > 0 ? 'Update Vehicle' : 'Register Vehicle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Vehicles */}
        {recentVehicles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Registrations</Text>
            {recentVehicles.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={styles.vehicleCard}
                onPress={() => {
                  setSelectedVehicle(vehicle);
                  setShowDetailModal(true);
                }}
              >
                <View style={styles.vehicleIcon}>
                  <Ionicons name={getVehicleIcon(vehicle.vehicleType) as any} size={24} color="#00BCD4" />
                </View>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                  <Text style={styles.vehicleType}>{vehicle.vehicleType}</Text>
                  <Text style={styles.vehicleDate}>{formatDate(vehicle.registeredAt)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Vehicle Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vehicle Details</Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedVehicle && (
              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.modalVehicleIcon}>
                  <Ionicons name={getVehicleIcon(selectedVehicle.vehicleType) as any} size={48} color="#00BCD4" />
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Vehicle Information</Text>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>License Plate</Text>
                    <Text style={styles.modalValue}>{selectedVehicle.licensePlate}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Type</Text>
                    <Text style={styles.modalValue}>{selectedVehicle.vehicleType}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Owner Information</Text>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Name</Text>
                    <Text style={styles.modalValue}>{selectedVehicle.ownerName}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Phone</Text>
                    <Text style={styles.modalValue}>{selectedVehicle.ownerPhone}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Registered</Text>
                    <Text style={styles.modalValue}>{formatDate(selectedVehicle.registeredAt)}</Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <SecurityBottomNav activeTab="vehicle" onNavigate={onNavigate} />

      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />
      <ErrorModal
        visible={showErrorModal}
        type="validation"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  searchButton: {
    backgroundColor: '#00BCD4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  resultsContainer: {
    marginTop: 12,
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  vehicleType: {
    fontSize: 13,
    color: '#00BCD4',
    fontWeight: '600',
    marginBottom: 2,
  },
  vehicleOwner: {
    fontSize: 13,
    color: '#6B7280',
  },
  vehicleDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  typeChips: {
    flexDirection: 'row',
    gap: 12,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  typeChipActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  ownerTypeScroll: {
    marginHorizontal: -4,
  },
  ownerTypeChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  ownerTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  ownerTypeChipActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  ownerTypeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  ownerTypeChipTextActive: {
    color: '#FFF',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BCD4',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  registerButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalVehicleIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
});

export default ModernVehicleRegistrationScreen;
