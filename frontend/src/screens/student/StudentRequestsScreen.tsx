import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  TextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Student } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import MyRequestsBulkModal from '../../components/MyRequestsBulkModal';
import SinglePassDetailsModal from '../../components/SinglePassDetailsModal';
import { useErrorModal } from '../../hooks/useErrorModal';
import ErrorModal from '../../components/ErrorModal';

interface StudentRequestsScreenProps {
  student: Student;
  onTabChange: (tab: 'HOME' | 'REQUESTS' | 'HISTORY' | 'PROFILE') => void;
}

const StudentRequestsScreen: React.FC<StudentRequestsScreenProps> = ({ student, onTabChange }) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkId, setSelectedBulkId] = useState<number | null>(null);
  const { errorInfo, showError, hideError, handleRetry, isVisible: isErrorVisible } = useErrorModal();

  useEffect(() => {
    const onBackPress = () => { onTabChange('HOME'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onTabChange]);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      const response = await apiService.getStudentGatePassRequests(student.regNo);
      if (response.success && response.requests) {
        const sorted = response.requests.sort((a: any, b: any) => {
          if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
          if (a.status !== 'APPROVED' && b.status === 'APPROVED') return 1;
          return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
        });
        setRequests(sorted);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadRequests(); };

  const filteredRequests = requests.filter(r =>
    searchQuery === '' ||
    r.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id?.toString().includes(searchQuery)
  );

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') return { text: 'ACTIVE', color: '#10B981', bg: '#D1FAE5' };
    if (status === 'REJECTED') return { text: 'REJECTED', color: '#EF4444', bg: '#FEE2E2' };
    if (status === 'PENDING_HOD') return { text: 'AWAITING HOD', color: '#3B82F6', bg: '#DBEAFE' };
    return { text: 'AWAITING STAFF', color: '#F59E0B', bg: '#FEF3C7' };
  };

  const getTimeAgo = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });

  // derive initials from student name
  const name = student.fullName || `${student.firstName} ${student.lastName}`.trim() || student.regNo || 'S';
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const renderCard = (request: any) => {
    const isBulk = request.requestType === 'BULK' || request.passType === 'BULK';
    const badge = getStatusBadge(request.status);
    const dateStr = request.requestDate || request.exitDateTime || request.createdAt;

    return (
      <TouchableOpacity
        key={request.id}
        style={[styles.card, { backgroundColor: theme.cardBackground }]}
        onPress={() => {
          if (isBulk) {
            setSelectedBulkId(request.id);
            setShowBulkModal(true);
          } else {
            setSelectedRequest(request);
            setShowDetailModal(true);
          }
        }}
        activeOpacity={0.85}
      >
        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
          </View>
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
              <View style={[styles.typePill, { backgroundColor: theme.inputBackground }]}>
                <Text style={[styles.typePillText, { color: theme.text }]}>
                  {isBulk ? 'Bulk Gatepass' : 'Single Gatepass'}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              Student • {student.department || 'Department'}
            </Text>
          </View>
          <Text style={[styles.timeAgo, { color: theme.textTertiary }]}>{getTimeAgo(dateStr)}</Text>
        </View>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: theme.inputBackground }]}>
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.text }]} numberOfLines={1}>
              {request.purpose || request.reason || 'Gate Pass Request'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.text }]}>{formatDate(dateStr)}</Text>
          </View>
        </View>

        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.statusText, { color: badge.color }]}>{badge.text}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.surface} />

      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Requests</Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={20} color={theme.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search requests..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={64} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>No requests found</Text>
          </View>
        ) : (
          filteredRequests.map(r => renderCard(r))
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {[
          { tab: 'HOME', icon: 'home-outline', label: 'Home' },
          { tab: 'REQUESTS', icon: 'document-text', label: 'Requests' },
          { tab: 'HISTORY', icon: 'time-outline', label: 'History' },
          { tab: 'PROFILE', icon: 'person-outline', label: 'Profile' },
        ].map(({ tab, icon, label }) => {
          const active = tab === 'REQUESTS';
          return (
            <TouchableOpacity key={tab} style={styles.navItem} onPress={() => onTabChange(tab as any)}>
              <Ionicons name={icon as any} size={24} color={active ? theme.primary : theme.textTertiary} />
              <Text style={[styles.navLabel, { color: active ? theme.primary : theme.textTertiary, fontWeight: active ? '700' : '500' }]}>
                {label}
              </Text>
              {active && <View style={[styles.navIndicator, { backgroundColor: theme.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Single pass details */}
      <SinglePassDetailsModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        request={selectedRequest}
        viewerRole="student"
        timelineSteps={selectedRequest ? (() => {
          const s = selectedRequest.status;
          const staffDone = s !== 'PENDING_STAFF';
          const hodApproved = s === 'APPROVED';
          const hodRejected = s === 'REJECTED';
          return [
            { label: 'Request Submitted', status: 'done' as const },
            { label: 'Staff Approval', status: staffDone ? 'done' as const : 'pending' as const, remark: selectedRequest.staffRemark },
            { label: 'HOD Approval', status: hodApproved ? 'done' as const : hodRejected ? 'rejected' as const : 'pending' as const, remark: selectedRequest.hodRemark || selectedRequest.rejectionReason },
          ];
        })() : []}
      />

      {/* Bulk pass details */}
      <MyRequestsBulkModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        requestId={selectedBulkId || 0}
        userRole="STAFF"
        viewerRole="STUDENT"
        currentUserId={student.regNo}
        requesterInfo={{
          name: student.fullName || `${student.firstName} ${student.lastName}`.trim() || student.regNo,
          role: 'Student',
          department: student.department || '',
        }}
      />

      <ErrorModal visible={isErrorVisible} type={errorInfo?.type || 'general'} title={errorInfo?.title} message={errorInfo?.message || ''} onClose={hideError} onRetry={errorInfo?.canRetry ? handleRetry : undefined} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  empty: { paddingVertical: 80, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },

  /* Card */
  card: { borderRadius: 16, padding: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  nameBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  typePill: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  typePillText: { fontSize: 9, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 2 },
  timeAgo: { fontSize: 12, flexShrink: 0 },

  infoBox: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoText: { fontSize: 13, flex: 1 },

  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  /* Bottom nav */
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, elevation: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  navLabel: { fontSize: 12, marginTop: 4 },
  navIndicator: { position: 'absolute', bottom: 0, width: 32, height: 3, borderRadius: 2 },
});

export default StudentRequestsScreen;
