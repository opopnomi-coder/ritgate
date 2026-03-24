import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'mygate_biometric_session';

async function setSecureValue(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function getSecureValue(key: string): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(key);
    if (secure !== null) return secure;
  } catch {
    // ignore and fallback
  }
  return AsyncStorage.getItem(key);
}

async function removeSecureValue(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore and fallback
  }
  await AsyncStorage.removeItem(key);
}

export const biometricAuthService = {
  async markSessionActive(): Promise<void> {
    await setSecureValue(SESSION_KEY, '1');
  },

  async clearSession(): Promise<void> {
    await removeSecureValue(SESSION_KEY);
  },

  async hasSessionFlag(): Promise<boolean> {
    const value = await getSecureValue(SESSION_KEY);
    return value === '1';
  },

  async canUseBiometricOrDeviceCredential(): Promise<{ available: boolean; reason?: string }> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { available: false, reason: 'Biometric hardware not available' };

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return { available: false, reason: 'No biometric or device credential enrolled' };

    return { available: true };
  },

  async authenticate(): Promise<{
    success: boolean;
    error?: string;
  }> {
    const available = await this.canUseBiometricOrDeviceCredential();
    if (!available.available) {
      return { success: false, error: available.reason };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use device passcode',
      disableDeviceFallback: false,
    });

    if (result.success) return { success: true };
    return { success: false, error: result.error || 'Authentication failed' };
  },
};

