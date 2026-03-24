import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../../config/api.config';
import { useTheme } from '../../context/ThemeContext';

interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  timestamp: string;
  createdAt: string;
}

interface NotificationsScreenProps {
  userId: string;
  userType: 'student' | 'staff' | 'hod' | 'hr' | 'security';
  onBack?: () => void;
}

export default function NotificationsScreen({ userId, userType, onBack }: NotificationsScreenProps) {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/notifications/${userType}/${userId}`);
      const data = await response.json();
      
      if (data.success && data.notifications) {
        // Get latest 5 notifications
        const latest = data.notifications.slice(0, 5);
        setNotifications(latest);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch(`${API_CONFIG.BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      
      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.isRead);
      for (const notif of unreadNotifs) {
        await fetch(`${API_CONFIG.BASE_URL}/notifications/${notif.id}/read`, {
          method: 'PUT',
        });
      }
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  useEffect(() => {
    fetchNotifications();
  }, [userId, userType]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getNotificationIcon = (notificationType: string) => {
    switch (notificationType) {
      case 'APPROVAL':
        return { name: 'checkmark-circle', color: '#10b981' };
      case 'REJECTION':
        return { name: 'close-circle', color: '#ef4444' };
      case 'INFO':
        return { name: 'information-circle', color: '#3b82f6' };
      case 'URGENT':
        return { name: 'warning', color: '#f59e0b' };
      case 'ENTRY':
        return { name: 'enter', color: '#8b5cf6' };
      case 'EXIT':
        return { name: 'exit', color: '#ec4899' };
      default:
        return { name: 'notifications', color: '#6b7280' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={markAllAsRead} style={styles.actionButton}>
              <Ionicons name="checkmark-done-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionText, { color: theme.primary }]}>Mark Read</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearAllNotifications} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
              <Text style={[styles.actionText, { color: theme.error }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Latest messages</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={theme.border} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
            You'll see your latest notifications here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={({ item }) => {
            const icon = getNotificationIcon(item.notificationType);
            return (
              <TouchableOpacity
                style={[
                  styles.notificationCard,
                  { backgroundColor: theme.cardBackground },
                  !item.isRead && { backgroundColor: theme.primary + '12', borderLeftWidth: 3, borderLeftColor: theme.primary },
                ]}
                onPress={() => !item.isRead && markAsRead(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: theme.surfaceHighlight }]}>
                  <Ionicons name={icon.name as any} size={24} color={icon.color} />
                </View>
                <View style={styles.contentContainer}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                  </View>
                  <Text style={[styles.message, { color: theme.textSecondary }]} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <Text style={[styles.timestamp, { color: theme.textTertiary }]}>
                    {formatTimestamp(item.timestamp)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },
  header: { padding: 20, borderBottomWidth: 1 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#f3f4f6' },
  actionText: { fontSize: 12, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  headerSubtitle: { fontSize: 14 },
  listContainer: { padding: 16 },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  contentContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  timestamp: { fontSize: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});
