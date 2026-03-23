import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { SecurityPersonnel, ScreenName, Department, StaffMember } from '../../types';
import { apiService } from '../../services/api';
import SecurityBottomNav from '../../components/SecurityBottomNav';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface ModernVisitorRegistrationScreenProps {
  security: SecurityPersonnel;
  onBack: () => void;
  onNavigate: (screen: ScreenName) => void;
}

const ModernVisitorRegistrationScreen: React.FC<ModernVisitorRegistrationScreenProps> = ({
  security,
  onBack,
  onNavigate,
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  
  const [numberOfVisitors, setNumberOfVisitors] = useState('1');
  const [visitorNames, setVisitorNames] = useState<string[]>(['']);
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredVisitorName, setRegisteredVisitorName] = useState('');

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      loadStaffMembers(selectedDepartment);
    }
  }, [selectedDepartment]);

  useEffect(() => {
    // Update visitor names array when number changes
    const num = parseInt(numberOfVisitors) || 1;
    const newNames = Array(num).fill('').map((_, index) => visitorNames[index] || '');
    setVisitorNames(newNames);
  }, [numberOfVisitors]);

  const loadDepartments = async () => {
    try {
      const response = await apiService.getDepartments();
      if (response.success && response.data) {
        setDepartments(response.data);
      } else {
        setErrorMessage('Failed to load departments. Please try again.');
        setShowErrorModal(true);
      }
    } catch (error) {
      setErrorMessage('Failed to load departments. Please check your connection.');
      setShowErrorModal(true);
    }
  };

  const loadStaffMembers = async (deptId: string) => {
    try {
      const response = await apiService.getStaffByDepartment(deptId);
      if (response.success && response.data) {
        setStaffMembers(response.data);
      } else {
        setStaffMembers([]);
      }
    } catch (error) {
      setStaffMembers([]);
    }
  };

  const handleSubmit = async () => {
    if (visitorNames.some(name => !name.trim())) {
      setErrorMessage('Please enter names for all visitors');
      setShowErrorModal(true);
      return;
    }
    if (!visitorEmail.trim() || !visitorEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      setShowErrorModal(true);
      return;
    }
    if (!visitorPhone.trim() || visitorPhone.length < 10) {
      setErrorMessage('Please enter a valid phone number (minimum 10 digits)');
      setShowErrorModal(true);
      return;
    }
    if (!selectedDepartment) {
      setErrorMessage('Please select a department');
      setShowErrorModal(true);
      return;
    }
    if (!selectedStaff) {
      setErrorMessage('Please select a staff member to meet');
      setShowErrorModal(true);
      return;
    }
    if (!purpose.trim()) {
      setErrorMessage('Please enter the purpose of visit');
      setShowErrorModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedSecurityId = security.securityId || (security as any).userId || (security as any).id?.toString() || '';
      const response = await apiService.registerVisitorForSecurity({
        name: visitorNames[0],
        phone: visitorPhone,
        email: visitorEmail,
        numberOfPeople: parseInt(numberOfVisitors) || 1,
        departmentId: selectedDepartment,
        staffCode: selectedStaff,
        purpose,
        vehicleNumber: vehicleNumber || undefined,
        securityId: resolvedSecurityId,
      });

      if (response.success) {
        setRegisteredVisitorName(visitorNames[0]);
        resetForm();
        setShowSuccessModal(true);
      } else {
        setErrorMessage(response.message || 'Could not register visitor. Please try again.');
        setShowErrorModal(true);
      }
    } catch (err) {
      setErrorMessage('Failed to register visitor. Please check your connection.');
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNumberOfVisitors('1');
    setVisitorNames(['']);
    setVisitorPhone('');
    setVisitorEmail('');
    setVehicleNumber('');
    setSelectedDepartment('');
    setSelectedStaff('');
    setPurpose('');
  };

  const updateVisitorName = (index: number, value: string) => {
    const newNames = [...visitorNames];
    newNames[index] = value;
    setVisitorNames(newNames);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visitor Registration</Text>
        <TouchableOpacity 
          style={styles.qrButton} 
          onPress={() => onNavigate('VISITOR_QR')}
        >
          <Ionicons name="qr-code-outline" size={20} color="#00BCD4" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Visitor Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visitor Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Visitors *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="people-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="1"
                value={numberOfVisitors}
                onChangeText={setNumberOfVisitors}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Dynamic Visitor Names */}
          {visitorNames.map((name, index) => (
            <View key={index} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {index === 0 ? 'Main Visitor Name *' : `Visitor ${index + 1} Name *`}
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder={`Enter visitor ${index + 1} name`}
                  value={name}
                  onChangeText={(value) => updateVisitorName(index, value)}
                />
              </View>
            </View>
          ))}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                value={visitorEmail}
                onChangeText={setVisitorEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number (min 10 digits)"
                value={visitorPhone}
                onChangeText={setVisitorPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle Number (Optional)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="car-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Enter vehicle number"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        {/* Visit Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Department *</Text>
            <View style={styles.pickerContainer}>
              <Ionicons name="business-outline" size={20} color="#9CA3AF" style={styles.pickerIcon} />
              <Picker
                selectedValue={selectedDepartment}
                onValueChange={setSelectedDepartment}
                style={styles.picker}
              >
                <Picker.Item label="Select Department" value="" />
                {departments.map(dept => (
                  <Picker.Item key={dept.id} label={dept.name} value={dept.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Staff to Meet *</Text>
            <View style={styles.pickerContainer}>
              <Ionicons name="person-circle-outline" size={20} color="#9CA3AF" style={styles.pickerIcon} />
              <Picker
                selectedValue={selectedStaff}
                onValueChange={setSelectedStaff}
                style={styles.picker}
                enabled={!!selectedDepartment}
              >
                <Picker.Item label="Select Staff" value="" />
                {staffMembers.map(staff => (
                  <Picker.Item key={staff.id} label={staff.name} value={staff.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Purpose of Visit *</Text>
            <View style={styles.textAreaContainer}>
              <Ionicons name="document-text-outline" size={20} color="#9CA3AF" style={styles.textAreaIcon} />
              <TextInput
                style={styles.textArea}
                placeholder="Enter purpose of visit"
                value={purpose}
                onChangeText={setPurpose}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Register Visitor</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Navigation */}
      <SecurityBottomNav activeTab="visitor" onNavigate={onNavigate} />

      <SuccessModal
        visible={showSuccessModal}
        title="Visitor Registered!"
        message={`${registeredVisitorName} has been registered successfully. The staff member has been notified for approval.`}
        onClose={() => setShowSuccessModal(false)}
        autoClose={false}
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
  qrButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F7FA',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 16,
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
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerIcon: {
    marginRight: 12,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  textAreaContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  textAreaIcon: {
    marginTop: 2,
  },
  textArea: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BCD4',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  successName: {
    fontWeight: '700',
    color: '#1F2937',
  },
  successActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00BCD4',
    gap: 6,
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00BCD4',
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#00BCD4',
    gap: 6,
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default ModernVisitorRegistrationScreen;
