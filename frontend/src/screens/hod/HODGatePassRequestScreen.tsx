import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { HOD } from '../../types';
import { apiService } from '../../services/api';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface HODGatePassRequestScreenProps {
  user: HOD;
  onBack?: () => void;
}

const HODGatePassRequestScreen: React.FC<HODGatePassRequestScreenProps> = ({ user, onBack }) => {
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [requestDate, setRequestDate] = useState(new Date());
  const [attachment, setAttachment] = useState<{ name: string; base64Uri: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(requestDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setRequestDate(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(requestDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setRequestDate(newDate);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const base64Uri = `data:${mimeType};base64,${asset.base64}`;
        setAttachment({ name: asset.fileName || 'attachment.jpg', base64Uri });
      }
    } catch (error) { console.error('Image pick error:', error); }
  };

  const handleSubmit = async () => {
    if (!purpose.trim()) {
      setErrorMessage('Please enter the purpose of your gate pass request');
      setShowErrorModal(true);
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Please provide a reason for your gate pass request');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.submitHODGatePassRequest(
        user.hodCode,
        purpose.trim(),
        reason.trim(),
        attachment?.base64Uri
      );
      if (result.success) {
        setShowSuccessModal(true);
      } else {
        setErrorMessage(result.message || 'Failed to submit request');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'H';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Gate Pass Request</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* User Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user.hodName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{user.hodName}</Text>
                <Text style={styles.userDetail}>Department: {user.department}</Text>
              </View>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.formSection}>
            <Text style={styles.label}>REQUEST DATE & TIME</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.selector} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color="#0EA5E9" />
                <Text style={styles.selectorText}>{requestDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.selector} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={20} color="#0EA5E9" />
                <Text style={styles.selectorText}>
                  {requestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Purpose */}
          <View style={styles.formSection}>
            <Text style={styles.label}>PURPOSE</Text>
            <TextInput
              style={styles.purposeInput}
              placeholder="e.g. Conference, Official Meeting..."
              placeholderTextColor="#94a3b8"
              value={purpose}
              onChangeText={setPurpose}
            />
          </View>

          {/* Reason */}
          <View style={styles.formSection}>
            <Text style={styles.label}>REASON</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Medical Appointment, Family Emergency..."
              placeholderTextColor="#94a3b8"
              multiline
              value={reason}
              onChangeText={setReason}
            />
          </View>

          {/* Attachment */}
          <View style={styles.formSection}>
            <Text style={styles.label}>ATTACHMENT (OPTIONAL)</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
              <Ionicons name="attach-outline" size={22} color="#9CA3AF" />
              <Text style={styles.uploadText}>
                {attachment ? attachment.name : 'Tap to upload image'}
              </Text>
              {attachment && (
                <TouchableOpacity onPress={() => setAttachment(null)}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {attachment && (
              <Image source={{ uri: attachment.base64Uri }} style={styles.attachmentPreview} resizeMode="cover" />
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={['#0EA5E9', '#0284C7']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.submitText}>SUBMIT REQUEST</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker value={requestDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />
      )}
      {showTimePicker && (
        <DateTimePicker value={requestDate} mode="time" display="default" onChange={handleTimeChange} />
      )}

      <SuccessModal
        visible={showSuccessModal}
        title="Request Submitted"
        message="Your gate pass request has been submitted successfully. It will be reviewed by HR."
        onClose={() => { setShowSuccessModal(false); if (onBack) onBack(); }}
        autoClose={true}
        autoCloseDelay={2500}
      />
      <ErrorModal
        visible={showErrorModal}
        type="api"
        title="Submission Failed"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  infoCard: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E920',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0EA5E9',
    fontSize: 16,
    fontWeight: '700',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  userDetail: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  activeBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  formSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  selector: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  purposeInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  textArea: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  uploadText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  attachmentPreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 8,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

export default HODGatePassRequestScreen;
