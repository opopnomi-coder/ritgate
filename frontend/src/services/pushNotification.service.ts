import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_CONFIG } from '../config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@mygate_push_token';
const PROJECT_ID = '3f0c386d-7505-4d3e-b0b1-bf2d2b1fad7c';

// ─── MUST be called at module load time (before any component renders) ────────
// Controls how notifications appear when the app IS in the foreground.
// Background/killed state is handled by the OS automatically via the plugin.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Permission + token registration ─────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('ℹ️ Push notifications require a physical device');
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('⚠️ Push notification permission denied');
      return null;
    }

    // Android: create a high-priority notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('gate-pass', {
        name: 'Gate Pass Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#06B6D4',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    console.log('📲 Expo push token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.warn('⚠️ Failed to get push token:', error);
    return null;
  }
}

export async function initPushNotifications(userId: string, userType: string): Promise<void> {
  try {
    const token = await registerForPushNotifications();
    if (!token) return;

    // Skip if already registered for this user+token combo
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (stored === `${userId}:${token}`) return;

    await savePushTokenToBackend(userId, token);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, `${userId}:${token}`);
  } catch (error) {
    console.warn('⚠️ Push init failed:', error);
  }
}

export async function savePushTokenToBackend(userId: string, token: string): Promise<void> {
  try {
    const deviceType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    const res = await fetch(`${API_CONFIG.BASE_URL}/notifications/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pushToken: token, deviceType }),
    });
    const data = await res.json();
    if (data.success) console.log('✅ Push token registered with backend');
  } catch (error) {
    console.warn('⚠️ Failed to save push token to backend:', error);
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!stored) return;

    // Try to get the live token; fall back to stored value
    let pushToken: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
      pushToken = tokenData.data;
    } catch {
      // stored format is "userId:ExponentPushToken[...]"
      pushToken = stored.substring(stored.indexOf(':') + 1);
    }

    await fetch(`${API_CONFIG.BASE_URL}/notifications/push-token`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushToken }),
    });

    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    console.log('✅ Push token unregistered');
  } catch (error) {
    console.warn('⚠️ Failed to unregister push token:', error);
  }
}

// ─── Notification tap handler (call once in App root) ────────────────────────
// Returns a cleanup function. Call this in a useEffect in App.tsx.
// `onNavigate` receives the actionRoute from the notification data.
export function setupNotificationTapHandler(
  onNavigate: (route: string) => void
): () => void {
  // Fired when user taps a notification while app is FOREGROUNDED or BACKGROUNDED
  const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any;
    const route: string = data?.actionRoute || data?.route || '';
    console.log('🔔 Notification tapped, route:', route);
    if (route) onNavigate(route);
  });

  // Fired when a notification arrives while app is FOREGROUNDED
  const receiveSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('🔔 Notification received in foreground:', notification.request.content.title);
  });

  return () => {
    tapSub.remove();
    receiveSub.remove();
  };
}

// ─── Handle notification that launched the app from KILLED state ──────────────
// Call once on app startup (not inside useEffect — call it synchronously).
export async function handleInitialNotification(
  onNavigate: (route: string) => void
): Promise<void> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data as any;
      const route: string = data?.actionRoute || data?.route || '';
      console.log('🔔 App opened from notification, route:', route);
      if (route) {
        // Small delay to let the app finish mounting
        setTimeout(() => onNavigate(route), 500);
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to get initial notification:', error);
  }
}
