// API Configuration for MyGate App
// VERSION: 6.0.0 - Production Render URL (no local discovery)

// ============================================
// BACKEND URL — always Render in production APK
// ============================================

const PRODUCTION_URL = 'https://ritgate-backend.onrender.com/api';

const getBackendUrl = (): string => {
  // Env override (CI/staging only)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  // In dev mode with Expo Go, use local server
  try {
    const Constants = require('expo-constants').default;
    if (__DEV__ && Constants.expoConfig?.hostUri) {
      const ip = Constants.expoConfig.hostUri.split(':')[0];
      return `http://${ip}:8080/api`;
    }
  } catch (_) {}

  return PRODUCTION_URL;
};

export const API_CONFIG = {
  BASE_URL: getBackendUrl(),
  PRODUCTION_URL,
  TIMEOUT: 120000,      // 120s — Render free tier cold start can take ~60s
  RETRY_ATTEMPTS: 1,    // No retry loop — one clean attempt
  RETRY_DELAY: 2000,
  POSSIBLE_URLS: [PRODUCTION_URL],
};

// OTP Configuration
export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  RESEND_DELAY_SECONDS: 60,
};

// QR Code Configuration
export const QR_CONFIG = {
  SCAN_DELAY: 2000,
  EXPIRY_HOURS: 24,
};

// Modern App Theme
export const THEME = {
  colors: {
    primary: '#1E40AF',
    primaryLight: '#3B82F6',
    primaryDark: '#1E3A8A',
    secondary: '#1E293B',
    secondaryLight: '#334155',
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    background: '#F8FAFC',
    backgroundDark: '#F1F5F9',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    textInverse: '#FFFFFF',
    border: '#E2E8F0',
    borderDark: '#CBD5E1',
    borderFocus: '#3B82F6',
    student: '#06B6D4',
    studentGradient: ['#06B6D4', '#0891B2'],
    staff: '#8B5CF6',
    staffGradient: ['#8B5CF6', '#7C3AED'],
    hod: '#F59E0B',
    hodGradient: ['#F59E0B', '#D97706'],
    hr: '#10B981',
    hrGradient: ['#10B981', '#059669'],
    security: '#1E40AF',
    securityGradient: ['#1E40AF', '#1E3A8A'],
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999 },
  fontSize: { xs: 11, sm: 12, md: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 28, huge: 32 },
  fontWeight: {
    regular: '400', medium: '500', semibold: '600',
    bold: '700', extrabold: '800', black: '900',
  },
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
    xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  },
};

export const ROLE_PATTERNS = {
  HOD: /HOD/i,
  HR: /^HR\d+$/i,
  SECURITY: /^SEC\d+$/i,
  STAFF: /^[A-Z]{2,3}\d+$/,
  STUDENT: /^\d+$/,
};

export const STORAGE_KEYS = {
  USER_DATA: '@mygate_user_data',
  USER_ROLE: '@mygate_user_role',
  AUTH_TOKEN: '@mygate_auth_token',
  BACKEND_URL: '@mygate_backend_url',
};

export const POSSIBLE_BACKEND_URLS: string[] = [PRODUCTION_URL];
