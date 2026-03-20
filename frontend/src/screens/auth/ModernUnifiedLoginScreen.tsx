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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
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
  const [detectedRole, setDetectedRole] = useState<UserRole | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Sending OTP...');
  const [serverWakeSeconds, setServerWakeSeconds] = useState(0);

  const { errorInfo, showError, hideError, handleRetry, isVisible } = useErrorModal();
  const { successInfo, showSuccess, hideSuccess, isVisible: isSuccessVisible } = useSuccessModal();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Wake up Render backend as soon as screen loads (fire-and-forget)
  useEffect(() => {
    apiService.wakeUpBackend();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
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

  const handleSendOTP = async () => {
    if (!userId.trim()) {
      showError(new AppError('validation', 'Please enter your ID', 'Missing ID'));
      return;
    }

    const role = detectUserRole(userId);
    setLoading(true);
    setLoadingMessage('Connecting to server...');
    setServerWakeSeconds(0);

    // Progressive loading messages with countdown
    let elapsed = 0;
    const msgInterval = setInterval(() => {
      elapsed += 1;
      setServerWakeSeconds(elapsed);
      if (elapsed < 5) {
        setLoadingMessage('Sending OTP...');
      } else if (elapsed < 15) {
        setLoadingMessage('Server is waking up...');
      } else if (elapsed < 30) {
        setLoadingMessage(`Server starting up... (${elapsed}s)`);
      } else {
        setLoadingMessage(`Almost ready... (${elapsed}s)`);
      }
    }, 1000);

    try {
      const response = await apiService.sendOTP(userId, role);

      if (response.success) {
        setOtpSent(true);
        setDetectedRole(role);
        setMaskedEmail(response.maskedEmail || response.email || 'm***@institution.edu');
        setOtpTimer(120);
        showSuccess('OTP has been sent to your registered email', 'OTP Sent');
      } else {
        showError(
          new AppError('api', response.message || 'Failed to send OTP', 'OTP Send Failed'),
          handleSendOTP
        );
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('starting up') || msg.includes('timeout') || error?.name === 'AbortError') {
        showError(
          new AppError(
            'api',
            'Server is starting up (Render free tier). Please wait ~60 seconds and tap Retry.',
            'Server Starting'
          ),
          handleSendOTP
        );
      } else {
        showError(error, handleSendOTP);
      }
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
      setLoadingMessage('Sending OTP...');
      setServerWakeSeconds(0);
    }
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
    
    try {
      console.log('📱 Processing QR scan with data:', qrData);
      
      // Set the userId from QR data
      setUserId(qrData);
      
      // Detect role from the scanned ID
      const role = detectUserRole(qrData);
      setDetectedRole(role);
      
      // Automatically send OTP after QR scan
      setLoading(true);
      const response = await apiService.sendOTP(qrData, role);
      
      if (response.success) {
        setOtpSent(true);
        setMaskedEmail(response.maskedEmail || 'm***@institution.edu');
        setOtpTimer(120); // 2 minutes
        showSuccess('OTP has been sent to your registered email. Please enter it to complete login.', 'QR Scan Successful');
      } else {
        showError(new AppError('api', response.message || 'Failed to send OTP. Please try manual entry.', 'QR Scan Failed'));
      }
    } catch (error: any) {
      console.error('❌ QR scan error:', error);
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  if (showQRScanner) {
    return (
      <QRLoginScanner
        onScanSuccess={handleQRScanSuccess}
        onClose={() => setShowQRScanner(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          {/* Header */}
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
            </TouchableOpacity>
          )}

          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {!otpSent ? (
              // Login Screen
              <>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <Image 
                    source={require('../../../assets/rit-logo.png')} 
                    style={styles.logoImage} 
                  />
                </View>

                {/* Title */}
                <Text style={styles.title}>RIT Gate</Text>


                {/* Input Section */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>IDENTIFICATION</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Security ID / Staff ID / Roll No"
                    placeholderTextColor={THEME.colors.textTertiary}
                    value={userId}
                    onChangeText={setUserId}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                  style={[styles.continueButton, loading && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={[styles.continueButtonText, { fontSize: 13 }]}>{loadingMessage}</Text>
                      </View>
                      {serverWakeSeconds >= 5 && (
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${Math.min((serverWakeSeconds / 90) * 100, 100)}%` as any }]} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.continueButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.qrOption}
                  onPress={() => setShowQRScanner(true)}
                >
                  <View style={styles.qrIconCircle}>
                    <Ionicons name="qr-code-outline" size={24} color={THEME.colors.primary} />
                  </View>
                  <View style={styles.qrTextContainer}>
                    <Text style={styles.qrTitle}>Scan QR Code</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </TouchableOpacity>

              </>
            ) : (
              // OTP Verification Screen
              <>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <Image 
                    source={require('../../../assets/rit-logo.png')} 
                    style={styles.logoImage} 
                  />
                </View>

                {/* Title */}
                <Text style={styles.title}>Verify OTP</Text>
                <Text style={styles.subtitle}>
                  We've sent a 6-digit verification code to{'\n'}
                  <Text style={styles.emailText}>{maskedEmail}</Text>
                </Text>

                {/* OTP Input */}
                <View style={styles.otpContainer}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="------"
                    placeholderTextColor={THEME.colors.textTertiary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    editable={!loading}
                  />
                </View>

                {/* Timer */}
                {otpTimer > 0 && (
                  <View style={styles.timerContainer}>
                    <Ionicons name="time-outline" size={16} color={THEME.colors.textSecondary} />
                    <Text style={styles.timerText}>
                      {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                )}

                {/* Resend OTP */}
                <View style={styles.resendSection}>
                  <Text style={styles.resendText}>Didn't receive the code?</Text>
                  <TouchableOpacity onPress={handleResendOTP} disabled={otpTimer > 0}>
                    <Text style={[styles.resendLink, otpTimer > 0 && styles.resendLinkDisabled]}>
                      Resend OTP
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  style={[styles.verifyButton, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify and Continue</Text>
                  )}
                </TouchableOpacity>

                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => {
                    setOtpSent(false);
                    setOtp('');
                    setOtpTimer(0);
                  }}
                >
                  <Ionicons name="arrow-back" size={16} color={THEME.colors.primary} />
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      {errorInfo && (
        <ErrorModal
          visible={isVisible}
          type={errorInfo.type}
          title={errorInfo.title}
          message={errorInfo.message}
          onClose={hideError}
          onRetry={errorInfo.canRetry ? handleRetry : undefined}
        />
      )}

      {/* Success Modal */}
      {successInfo && (
        <SuccessModal
          visible={isSuccessVisible}
          title={successInfo.title}
          message={successInfo.message}
          onClose={hideSuccess}
          autoClose={successInfo.autoClose}
          autoCloseDelay={successInfo.autoCloseDelay}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 0,
    marginTop: -20, // push up slightly more past the normal safe area
  },
  iconContainer: {
    marginBottom: 8,
  },
  logoImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'monospace',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  emailText: {
    fontWeight: '600',
    color: '#1E293B',
  },
  inputSection: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  continueButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  progressBar: {
    width: '80%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginHorizontal: 16,
  },
  qrOption: {
    width: '100%',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  qrTextContainer: {
    flex: 1,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  qrSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },

  version: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  otpContainer: {
    width: '100%',
    marginBottom: 16,
  },
  otpInput: {
    width: '100%',
    height: 64,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  resendLinkDisabled: {
    color: '#94A3B8',
  },
  verifyButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
});

export default ModernUnifiedLoginScreen;
