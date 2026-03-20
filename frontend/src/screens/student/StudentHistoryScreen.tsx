import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Student } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

interface StudentHistoryScreenProps {
  student: Student;
  onTabChange: (tab: 'HOME' | 'REQUESTS' | 'HISTORY' | 'PROFILE') => void;
}

interface HistoryItem {
  id: string;
  type: 'ENTRY' | 'EXIT' | 'LATE_ENTRY' | 'GATE_PASS';
  timestamp: string;
  reason?: string;
  passId?: string;
  location?: string;
}

const StudentHistoryScreen: React.FC<StudentHistoryScreenProps> = ({
  student,
  onTabChange,
}) => {
  const { theme, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const onBackPress = () => {
      onTabChange('HOME');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onTabChange]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const entryHistory = await apiService.getUserEntryHistory(student.regNo);
      const gatePassResponse = await apiService.getStudentGatePassRequests(student.regNo);
      const gatePasses = gatePassResponse.success ? gatePassResponse.requests : [];
      const combinedHistory: HistoryItem[] = [];

      entryHistory.forEach((item: any) => {
        if (item.entryTime) {
          combinedHistory.push({
            id: `entry-${item.id || Date.now()}`,
            type: item.lateEntry ? 'LATE_ENTRY' : 'ENTRY',
            timestamp: item.entryTime,
            reason: item.lateReason || undefined,
            location: 'Main Gate',
          });
        }
        if (item.exitTime) {
          combinedHistory.push({
            id: `exit-${item.id || Date.now()}`,
            type: 'EXIT',
            timestamp: item.exitTime,
            location: 'Main Gate',
          });
        }
      });

      if (gatePasses && Array.isArray(gatePasses)) {
        gatePasses
          .filter((pass: any) => pass.status === 'APPROVED' && pass.usedAt)
          .forEach((pass: any) => {
            combinedHistory.push({
              id: `gatepass-${pass.id}`,
              type: 'GATE_PASS',
              timestamp: pass.usedAt,
              passId: `GP-${pass.id}`,
              reason: pass.purpose || pass.reason,
              location: 'Main Gate',
            });
          });
      }

      combinedHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistoryData(combinedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const getIconName = (type: string) => {
    switch (type) {
      case 'ENTRY': return 'log-in';
      case 'EXIT': return 'log-out';
      case 'LATE_ENTRY': return 'warning';
      case 'GATE_PASS': return 'qr-code';
      default: return 'time';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'ENTRY': return '#10B981';
      case 'EXIT': return '#EF4444';
      case 'LATE_ENTRY': return '#F59E0B';
      case 'GATE_PASS': return '#06B6D4';
      default: return '#6B7280';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'ENTRY': return 'Entry';
      case 'EXIT': return 'Exit';
      case 'LATE_ENTRY': return 'Late Entry';
      case 'GATE_PASS': return 'Gate Pass Used';
      default: return type;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>History</Text>
      </View>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {historyData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>No history records</Text>
          </View>
        ) : (
          historyData.map((item) => (
            <View key={item.id} style={[styles.historyCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.iconContainer, { backgroundColor: getIconColor(item.type) + '20' }]}>
                <Ionicons name={getIconName(item.type)} size={24} color={getIconColor(item.type)} />
              </View>
              <View style={styles.historyContent}>
                <Text style={[styles.historyType, { color: theme.text }]}>{getTypeLabel(item.type)}</Text>
                {item.passId && <Text style={[styles.historyPassId, { color: theme.primary }]}>{item.passId}</Text>}
                {item.reason && <Text style={[styles.historyReason, { color: theme.textSecondary }]} numberOfLines={2}>{item.reason}</Text>}
                <View style={styles.historyMeta}>
                  <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
                  <Text style={[styles.historyTimestamp, { color: theme.textTertiary }]}>{formatTimestamp(item.timestamp)}</Text>
                </View>
                {item.location && (
                  <View style={styles.historyMeta}>
                    <Ionicons name="location-outline" size={14} color={theme.textTertiary} />
                    <Text style={[styles.historyLocation, { color: theme.textTertiary }]}>{item.location}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <View style={[styles.bottomNav, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('HOME')}>
          <Ionicons name="home-outline" size={24} color={theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('REQUESTS')}>
          <Ionicons name="document-text-outline" size={24} color={theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('HISTORY')}>
          <Ionicons name="time" size={24} color={theme.primary} />
          <Text style={[styles.navLabelActive, { color: theme.primary }]}>History</Text>
          <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('PROFILE')}>
          <Ionicons name="person-outline" size={24} color={theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  emptyState: { paddingVertical: 80, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  historyCard: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, gap: 12 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  historyContent: { flex: 1, gap: 4 },
  historyType: { fontSize: 16, fontWeight: '700' },
  historyPassId: { fontSize: 13, fontWeight: '600' },
  historyReason: { fontSize: 14, lineHeight: 20 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyTimestamp: { fontSize: 13 },
  historyLocation: { fontSize: 13 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, elevation: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  navLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  navLabelActive: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  activeIndicator: { position: 'absolute', bottom: 0, width: 32, height: 3, borderRadius: 2 },
});

export default StudentHistoryScreen;
