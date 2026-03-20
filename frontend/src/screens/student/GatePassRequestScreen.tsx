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
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Student, Staff, HOD } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface GatePassRequestScreenProps {
  user: Student | Staff | HOD;
  navigation?: any;
  onBack?: () => void;
}

const GatePassRequestScreen: React.FC<GatePassRequestScreenProps> = ({ user, navigation, onBack }) => {
  const { theme, isDark } = useTheme();
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [requestDate, setRequestDate] = useState(new Date());
  const [attachment, setAttachment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // State for Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Helper functions
  const getUserDisplayName = () => {
    if (!user) return { fullName: 'User', firstLetter: 'U' };
    if ('firstName' in user) {
        return { fullName: `${user.firstName} ${user.lastName || ''}`, firstLetter: user.firstName.charAt(0) };
    }
    const name = (user as any).staffName || (user as any).hodName || 'User';
    return { fullName: name, firstLetter: name.charAt(0) };
  };

  const getUserIdentifier = () => {
    if (!user) return 'UNKNOWN';
    return (user as any).regNo || (user as any).staffCode || (user as any).hodCode || 'UNKNOWN';
  };

  const userInfo = getUserDisplayName();
  const userIdentifier = getUserIdentifier();

  const handleGoBack = () => {
    if (navigation?.goBack) navigation.goBack();
    else if (onBack) onBack();
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    if (!user) {
      setErrorMessage('Session expired. Please log in again.');
      setShowErrorModal(true);
    }
  }, [user]);

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
      // Request permission first — required on Android 13+ and iOS
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library in Settings to attach files.',
          [{ text: 'OK' }]
        );
        return;
      }

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
      setErrorMessage('Please provide a purpose for your gate pass request.');
      setShowErrorModal(true);
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Please provide a reason for your gate pass request.');
      setShowErrorModal(true);
      return;
    }

    const isStaff = 'staffCode' in user;
    const identifier = isStaff ? (user as any).staffCode : ('regNo' in user ? (user as any).regNo : (user as any).userId);
    if (!identifier) {
      setErrorMessage('User identifier not found');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);

    const payload = isStaff
      ? { staffCode: identifier, purpose: purpose.trim(), reason: reason.trim(), requestDate: requestDate.toISOString(), attachmentUri: attachment?.base64Uri }
      : { regNo: identifier, purpose: purpose.trim(), reason: reason.trim(), requestDate: requestDate.toISOString(), attachmentUri: attachment?.base64Uri || undefined };

    try {
      const response = isStaff
        ? await apiService.submitStaffGatePassRequest(payload as any)
        : await apiService.submitGatePassRequest(payload as any);
      if (response.success) {
        setShowSuccessModal(true);
      } else {
        setErrorMessage(response.message || 'Failed to submit request. Please try again.');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to submit request. Please try again.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Modern White Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.surfaceHighlight }]} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New Gate Pass Request</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Student Info Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>{userInfo.firstLetter}</Text>
              </View>
              <View>
                <Text style={[styles.userName, { color: theme.text }]}>{userInfo.fullName}</Text>
                <Text style={[styles.userDetail, { color: theme.textSecondary }]}>Department: {user?.department || 'AIDS'}</Text>
              </View>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: theme.success + '15' }]}>
              <Text style={[styles.activeText, { color: theme.success }]}>ACTIVE</Text>
            </View>
          </View>

          {/* Form Groups */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>REQUEST DATE & TIME</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={22} color={theme.primary} />
                <Text style={[styles.selectorText, { color: theme.text }]}>{requestDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={22} color={theme.primary} />
                <Text style={[styles.selectorText, { color: theme.text }]}>
                  {requestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>PURPOSE</Text>
            <TextInput
              style={[styles.purposeInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. Conference, Official Meeting..."
              placeholderTextColor={theme.textTertiary}
              value={purpose}
              onChangeText={setPurpose}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>REASON</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. Medical Appointment, Family Emergency..."
              placeholderTextColor={theme.textTertiary}
              multiline
              value={reason}
              onChangeText={setReason}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>ATTACHMENT (OPTIONAL)</Text>
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

          {/* Submit Button */}
          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            <LinearGradient
              colors={theme.gradients.primary as [string, string, ...string[]]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.btnContent}>
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.submitText}>SUBMITTING...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFF" style={styles.btnIcon} />
                    <Text style={styles.submitText}>SUBMIT REQUEST</Text>
                  </>
                )}
              </View>
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
        message="Your gate pass request has been submitted successfully. You'll be notified once staff reviews it."
        onClose={() => {
          setShowSuccessModal(false);
          handleGoBack();
        }}
        autoClose={false}
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

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingBottom: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  formSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
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
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  purposeInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
    borderWidth: 1,
  },
  textArea: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 14,
    fontWeight: '500',
    borderWidth: 1,
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
    shadowColor: '#06B6D4',
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
  submitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnIcon: {},
});

export default GatePassRequestScreen;