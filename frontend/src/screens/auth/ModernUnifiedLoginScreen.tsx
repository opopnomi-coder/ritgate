import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api.service';
import { detectUserRole } from '../../utils/roleDetection';
import { UserRole } from '../../types';
import { THEME } from '../../config/api.config';
import QRLoginScanner from './QRLoginScanner';
import ErrorModal from '../../components/ErrorModal';
import SuccessModal from '../../components/SuccessModal';
import { useErrorModal } from '../../hooks/useErrorModal';
import { useSuccessModal } from '../../hooks/useSuccessModal';
import { AppError } from '../../utils/errorHandler';

interface ModernUnifiedLoginScreenProps {
  onLoginSuccess: (user: any, role: UserRole) => void;
  onBack?: () => void;
}

const ModernUnifiedLoginScreen: React.FC<ModernUnifiedLoginScreenProps> = ({ onLoginSuccess, onBack }) => {
  const [userId, setUserId] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showOTPSuccessModal, setShowOTPSuccessModal] = useState(false);
  const [detectedRole, setDetectedRole] = useState<UserRole | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Sending OTP...');

  const { errorInfo, showError, hideError, handleRetry, isVisible } = useErrorModal();
  const { successInfo, showSuccess, hideSuccess, isVisible: isSuccessVisible } = useSuccessModal();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const otpPageFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    apiService.wakeUpBackend();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (userId.trim().length > 0) {
      const role = detectUserRole(userId);
      setDetectedRole(role);
    } else {
      setDetectedRole(null);
    }
  }, [userId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  useEffect(() => {
    if (showOTPSuccessModal) {
      Animated.spring(modalScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      modalScale.setValue(0.9);
    }
  }, [showOTPSuccessModal]);

  useEffect(() => {
    if (otpSent) {
      Animated.timing(otpPageFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      otpPageFade.setValue(0);
    }
  }, [otpSent]);

  const handleSendOTP = async () => {
    if (!userId.trim()) {
      showError(new AppError('validation', 'Please enter your ID', 'Missing ID'));
      return;
    }
    const role = detectUserRole(userId);
    setLoading(true);
    setLoadingMessage('Connecting...');
    try {
      const response = await apiService.sendOTP(userId, role);
      if (response.success) {
        setMaskedEmail(response.maskedEmail || response.email || 'm***@institution.edu');
        setDetectedRole(role);
        setOtpTimer(120);
        setShowOTPSuccessModal(true);
      } else {
        showError(new AppError('api', response.message || 'Failed to send OTP', 'OTP Send Failed'), handleSendOTP);
      }
    } catch (error: any) {
      showError(error, handleSendOTP);
    } finally {
      setLoading(false);
    }
  };

  const goToOTPPage = () => {
    setShowOTPSuccessModal(false);
    setOtpSent(true);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      showError(new AppError('validation', 'Please enter a valid 6-digit OTP', 'Invalid OTP'));
      return;
    }
    setLoading(true);
    try {
      const response = await apiService.verifyOTP(userId, otp, detectedRole!);
      if (response.success && response.user) {
        onLoginSuccess(response.user, detectedRole!);
      } else {
        showError(new AppError('auth', response.message || 'Invalid OTP', 'Verification Failed'), handleVerifyOTP);
      }
    } catch (error: any) {
      showError(error, handleVerifyOTP);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (otpTimer > 0) {
      showError(new AppError('general', `You can resend OTP in ${otpTimer} seconds`, 'Please Wait'));
      return;
    }
    setOtp('');
    handleSendOTP();
  };

  const handleQRScanSuccess = async (qrData: string) => {
    setShowQRScanner(false);
    setUserId(qrData);
    handleSendOTP();
  };

  if (showQRScanner) return <QRLoginScanner onScanSuccess={handleQRScanSuccess} onClose={() => setShowQRScanner(false)} />;

  if (otpSent) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Animated.View style={[styles.otpPage, { opacity: otpPageFade }]}>
          <TouchableOpacity style={styles.otpBackBtn} onPress={() => setOtpSent(false)}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.otpScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.otpIconContainer}>
              <View style={styles.otpIconBg}>
                <Ionicons name="mail-open" size={40} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.otpTitle}>Verification</Text>
            <Text style={styles.otpSub}>A 6-digit code has been sent to</Text>
            <Text style={styles.otpEmail}>{maskedEmail}</Text>
            
            <View style={styles.otpInputContainer}>
              <TextInput
                style={styles.otpInputPage}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#CBD5E1"
                autoFocus
              />
            </View>

            <View style={styles.otpActionContainer}>
              {otpTimer > 0 ? (
                <View style={styles.timerBadge}>
                  <Ionicons name="time-outline" size={16} color="#64748B" />
                  <Text style={styles.timerTextPage}>{Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={handleResendOTP} style={styles.resendLink}>
                  <Text style={styles.resendLinkText}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.btn, styles.verifyBtnPage, loading && styles.btnDisabled]} 
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnTxt}>Verify Now</Text>}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
        <ErrorModal visible={isVisible} type={errorInfo?.type || 'general'} title={errorInfo?.title} message={errorInfo?.message || ''} onClose={hideError} onRetry={errorInfo?.canRetry ? handleRetry : undefined} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {onBack && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
            </TouchableOpacity>
          )}
          <Animated.View style={[styles.mainContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.logoCont}><Image source={require('../../../assets/rit-logo.png')} style={styles.logo} /></View>
            <Text style={styles.mainTitle}>RIT Gate</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>IDENTIFICATION</Text>
              <TextInput style={styles.input} placeholder="Security ID / Staff ID / Roll No" placeholderTextColor="#94A3B8" value={userId} onChangeText={setUserId} autoCapitalize="none" editable={!loading} />
            </View>
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSendOTP} disabled={loading}>
              {loading ? (
                <View style={styles.loaderWrap}>
                   <ActivityIndicator color="#FFF" size="small" />
                   <Text style={styles.loaderTxt}>{loadingMessage}</Text>
                </View>
              ) : <Text style={styles.btnTxt}>Continue</Text>}
            </TouchableOpacity>
            <View style={styles.divider}><View style={styles.line} /><Text style={styles.divTxt}>OR</Text><View style={styles.line} /></View>
            <TouchableOpacity style={styles.qrBtn} onPress={() => setShowQRScanner(true)}>
              <View style={styles.qrIcon}><Ionicons name="qr-code-outline" size={24} color="#1E293B" /></View>
              <Text style={styles.qrTxt}>Scan QR Code</Text>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showOTPSuccessModal} transparent animationType="fade" onRequestClose={() => setShowOTPSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalBox, { transform: [{ scale: modalScale }] }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}><Ionicons name="shield-checkmark" size={32} color="#FFFFFF" /></View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowOTPSuccessModal(false)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
            </View>
            <Text style={styles.modalTitle}>OTP Sent</Text>
            <Text style={styles.modalSub}>A 6-digit code has been sent to <Text style={styles.emailHighlight}>{maskedEmail}</Text></Text>
            <TouchableOpacity style={styles.verifyBtn} onPress={goToOTPPage}>
              <Text style={styles.verifyTxt}>Enter Code</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <ErrorModal visible={isVisible} type={errorInfo?.type || 'general'} title={errorInfo?.title} message={errorInfo?.message || ''} onClose={hideError} onRetry={errorInfo?.canRetry ? handleRetry : undefined} />
      <SuccessModal visible={isSuccessVisible} title={successInfo?.title} message={successInfo?.message || ''} onClose={hideSuccess} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  mainContent: { flex: 1, alignItems: 'center' },
  logoCont: { marginBottom: 12 },
  logo: { width: 120, height: 120, borderRadius: 60 },
  mainTitle: { fontSize: 32, fontWeight: '900', color: '#1E293B', marginBottom: 32, letterSpacing: -0.5 },
  inputWrap: { width: '100%', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  input: { width: '100%', height: 56, backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  btn: { width: '100%', height: 58, backgroundColor: '#1E293B', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  btnTxt: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
  loaderWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loaderTxt: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
  line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  divTxt: { marginHorizontal: 16, color: '#94A3B8', fontWeight: '700', fontSize: 12 },
  qrBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  qrIcon: { width: 44, height: 44, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  qrTxt: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1E293B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  modalClose: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 24 },
  emailHighlight: { color: '#1E293B', fontWeight: '800' },
  verifyBtn: { width: '100%', height: 58, backgroundColor: '#1E293B', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  verifyTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  otpPage: { flex: 1, backgroundColor: '#FFFFFF' },
  otpBackBtn: { width: 44, height: 44, justifyContent: 'center', marginLeft: 16, marginTop: 10 },
  otpScroll: { flexGrow: 1, paddingHorizontal: 32, alignItems: 'center', paddingTop: 40 },
  otpIconContainer: { marginBottom: 32 },
  otpIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', shadowColor: '#1E293B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  otpTitle: { fontSize: 32, fontWeight: '900', color: '#1E293B', marginBottom: 12 },
  otpSub: { fontSize: 15, color: '#64748B', marginBottom: 4 },
  otpEmail: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 40 },
  otpInputContainer: { width: '100%', marginBottom: 32 },
  otpInputPage: { width: '100%', height: 80, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', textAlign: 'center', fontSize: 42, fontWeight: '900', color: '#1E293B', letterSpacing: 12 },
  otpActionContainer: { marginBottom: 48 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8 },
  timerTextPage: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  resendLink: { paddingVertical: 8, paddingHorizontal: 16 },
  resendLinkText: { fontSize: 15, fontWeight: '700', color: '#1E293B', textDecorationLine: 'underline' },
  verifyBtnPage: { height: 64, borderRadius: 20 },
});

export default ModernUnifiedLoginScreen;
