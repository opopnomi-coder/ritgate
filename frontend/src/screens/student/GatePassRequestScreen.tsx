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
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Student, Staff, HOD } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useActionLock } from '../../context/ActionLockContext';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface GatePassRequestScreenProps {
  user: Student | Staff | HOD;
  navigation?: any;
  onBack?: () => void;
}

const GatePassRequestScreen: React.FC<GatePassRequestScreenProps> = ({ user, navigation, onBack }) => {
  const { theme, isDark } = useTheme();
  const { withLock, isLocked } = useActionLock();
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [requestDate, setRequestDate] = useState(new Date());
  const [attachment, setAttachment] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
  
  const handleGoBack = React.useCallback(() => {
    if (navigation?.goBack) navigation.goBack();
    else if (onBack) onBack();
  }, [navigation, onBack]);

  useEffect(() => {
    const onBackPress = () => {
      handleGoBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleGoBack]);

  useEffect(() => {
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
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permResult.status !== 'granted') {
        await pickViaDocumentPicker();
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, allowsEditing: false });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) {
        setErrorMessage('Could not read the selected file. Please try again.');
        setShowErrorModal(true);
        return;
      }
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `attachment_${Date.now()}.jpg`;
      if (asset.base64) setAttachment({ name: fileName, base64Uri: `data:${mimeType};base64,${asset.base64}`, uri: asset.uri });
      else if (asset.uri) setAttachment({ name: fileName, base64Uri: asset.uri, uri: asset.uri });
    } catch (error: any) {
      await pickViaDocumentPicker();
    }
  };

  const pickViaDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      setAttachment({ name: file.name || 'attachment', base64Uri: file.uri, uri: file.uri });
    } catch (err: any) {
      setErrorMessage('Could not open file picker.');
      setShowErrorModal(true);
    }
  };

  const handleSubmit = async () => {
    if (isLocked) return;
    if (!purpose.trim() || !reason.trim()) {
      setErrorMessage('Please provide purpose and reason.');
      setShowErrorModal(true);
      return;
    }
    const staffCode = (user as any).staffCode;
    const hodCode = (user as any).hodCode;
    const regNo = (user as any).regNo;
    const isStaff = !!staffCode;
    const isHOD = !staffCode && !!hodCode;
    const identifier = staffCode || hodCode || regNo;
    const payload = isStaff
      ? { staffCode: identifier, purpose: purpose.trim(), reason: reason.trim(), requestDate: requestDate.toISOString(), attachmentUri: attachment?.base64Uri }
      : isHOD
      ? { staffCode: identifier, purpose: purpose.trim(), reason: reason.trim(), requestDate: requestDate.toISOString(), attachmentUri: attachment?.base64Uri }
      : { regNo: identifier, purpose: purpose.trim(), reason: reason.trim(), requestDate: requestDate.toISOString(), attachmentUri: attachment?.base64Uri || undefined };
    await withLock(async () => {
      try {
        const response = (isStaff || isHOD) ? await apiService.submitStaffGatePassRequest(payload as any) : await apiService.submitGatePassRequest(payload as any);
        if (response.success) setShowSuccessModal(true);
        else { setErrorMessage(response.message || 'Failed to submit.'); setShowErrorModal(true); }
      } catch (error: any) { setErrorMessage(error.message || 'Error occurred.'); setShowErrorModal(true); }
    }, 'Submitting request...');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.surfaceHighlight }]} onPress={handleGoBack}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New Gate Pass Request</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View>
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}><Text style={[styles.avatarText, { color: theme.primary }]}>{userInfo.firstLetter}</Text></View>
              <View><Text style={[styles.userName, { color: theme.text }]}>{userInfo.fullName}</Text><Text style={[styles.userDetail, { color: theme.textSecondary }]}>Dept: {user?.department || 'AIDS'}</Text></View>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: theme.success + '15' }]}><Text style={[styles.activeText, { color: theme.success }]}>ACTIVE</Text></View>
          </View>
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>DATE & TIME</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}><Ionicons name="calendar-outline" size={22} color={theme.primary} /><Text style={[styles.selectorText, { color: theme.text }]}>{requestDate.toLocaleDateString()}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowTimePicker(true)}><Ionicons name="time-outline" size={22} color={theme.primary} /><Text style={[styles.selectorText, { color: theme.text }]}>{requestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>PURPOSE</Text>
            <TextInput style={[styles.purposeInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} placeholder="Purpose" value={purpose} onChangeText={setPurpose} />
          </View>
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>REASON</Text>
            <TextInput style={[styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} placeholder="Reason" multiline value={reason} onChangeText={setReason} />
          </View>
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>ATTACHMENT</Text>
            <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]} onPress={pickDocument}><Ionicons name="attach-outline" size={22} color={theme.primary} /><Text style={[styles.uploadText, { color: theme.textSecondary }]}>{attachment ? attachment.name : 'Attach image'}</Text></TouchableOpacity>
            {attachment && attachment.uri && <Image source={{ uri: attachment.base64Uri || attachment.uri }} style={styles.attachmentPreview} resizeMode="cover" />}
          </View>
          <TouchableOpacity style={[styles.submitBtn, isLocked && { opacity: 0.7 }]} onPress={handleSubmit} disabled={isLocked}>
            <LinearGradient colors={theme.gradients.primary as [string, string, ...string[]]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={styles.btnContent}><Ionicons name="send" size={20} color="#FFF" /><Text style={styles.submitText}>SUBMIT REQUEST</Text></View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {showDatePicker && <DateTimePicker value={requestDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />}
      {showTimePicker && <DateTimePicker value={requestDate} mode="time" display="default" onChange={handleTimeChange} />}
      <SuccessModal visible={showSuccessModal} title="Success" message="Submitted!" onClose={() => { setShowSuccessModal(false); handleGoBack(); }} />
      <ErrorModal visible={showErrorModal} title="Error" message={errorMessage} onClose={() => setShowErrorModal(false)} type="general" />
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  infoCard: { padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, elevation: 2 },
  avatarContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '700' },
  userDetail: { fontSize: 12 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeText: { fontSize: 10, fontWeight: '700' },
  formSection: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 10 },
  selector: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, borderWidth: 1 },
  selectorText: { fontSize: 13, fontWeight: '600', flex: 1 },
  purposeInput: { borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1 },
  textArea: { borderRadius: 12, padding: 12, minHeight: 90, fontSize: 14, borderWidth: 1, textAlignVertical: 'top' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, gap: 10, borderWidth: 1.5, borderStyle: 'dashed' },
  uploadText: { flex: 1, fontSize: 13 },
  attachmentPreview: { width: '100%', height: 140, borderRadius: 12, marginTop: 8 },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, elevation: 4 },
  btnGradient: { paddingVertical: 15, alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default GatePassRequestScreen;