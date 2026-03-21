import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { Staff } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import SinglePassDetailsModal from '../../components/SinglePassDetailsModal';
import MyRequestsBulkModal from '../../components/MyRequestsBulkModal';
import GatePassQRModal from '../../components/GatePassQRModal';

interface MyRequestsScreenProps {
  user: Staff;
  onBack?: () => void;
}

const MyRequestsScreen: React.FC<MyRequestsScreenProps> = ({ user, onBack }) => {
  const { theme } = useTheme();
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkId, setSelectedBulkId] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      const [singleResult, bulkResult] = await Promise.all([
        apiService.getStaffOwnGatePassRequests(user.staffCode),
        apiService.getStaffBulkPassRequests(user.staffCode),
      ]);
      let combined: any[] = [];
      if (singleResult.success) combined = [...((singleResult as any).requests || singleResult.data || [])];
      if (bulkResult.success) combined = [...combined, ...(bulkResult.requests || [])];
      combined.sort((a, b) => {
        if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
        if (a.status !== 'APPROVED' && b.status === 'APPROVED') return 1;
        const dateA = new Date(a.passType === 'BULK' ? (a.exitDateTime || a.createdAt) : (a.requestDate || a.createdAt)).getTime();
        const dateB = new Date(b.passType === 'BULK' ? (b.exitDateTime || b.createdAt) : (b.requestDate || b.createdAt)).getTime();
        return dateB - dateA;
      });
      setAllRequests(combined);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchRequests(); }, []);

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') return { text: 'ACTIVE', color: theme.success, bgColor: theme.success + '22' };
    if (status === 'REJECTED') return { text: 'REJECTED', color: theme.error, bgColor: theme.error + '22' };
    return { text: 'PENDING', color: theme.warning, bgColor: theme.warning + '22' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleViewQR = async (request: any, isBulk: boolean = false) => {
    if (request.status !== 'APPROVED') return;
    setSelectedRequest(request);
    setQrCodeData(null);
    setManualCode(null);
    setShowQRModal(true);
    try {
      if (isBulk && request.qrCode) {
        setQrCodeData(request.qrCode);
        setManualCode(request.manualCode || null);
      } else {
        const result = await apiService.getGatePassQRCode(request.id, user.staffCode, true);
        if (result.success && result.qrCode) { setQrCodeData(result.qrCode); setManualCode(result.manualCode || null); }
      }
    } catch (error: any) {
      setShowQRModal(false);
    }
  };

  const handleReviewRequest = (request: any) => {
    if (request.passType === 'BULK') { setSelectedBulkId(request.id); setShowBulkModal(true); }
    else { setSelectedRequest(request); setShowDetailModal(true); }
  };

  const getTimeAgo = (dateString: string) => {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const renderRequestCard = (request: any) => {
    const badge = getStatusBadge(request.status);
    const isBulk = request.passType === 'BULK';
    const name = user.name || user.staffName || 'Staff';
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const dateStr = isBulk ? (request.exitDateTime || request.createdAt || request.requestDate) : (request.requestDate || request.createdAt);

    return (
      <TouchableOpacity style={[styles.requestCard, { backgroundColor: theme.surface }]} onPress={() => handleReviewRequest(request)} activeOpacity={0.85}>
        <View style={styles.cardTopRow}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.warning + '22' }]}>
            <Text style={[styles.avatarText, { color: theme.warning }]}>{initials}</Text>
          </View>
          <View style={styles.cardNameBlock}>
            <View style={styles.cardNameRow}>
              <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
              <View style={[styles.typePillInline, { backgroundColor: theme.inputBackground }]}>
                <Text style={[styles.typePillInlineText, { color: theme.text }]}>{isBulk ? 'Bulk Gatepass' : 'Single Gatepass'}</Text>
              </View>
            </View>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Staff • {user.department || 'Department'}</Text>
          </View>
          <Text style={[styles.cardTimeAgo, { color: theme.textTertiary }]}>{getTimeAgo(dateStr)}</Text>
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.inputBackground }]}>
          <View style={styles.infoBoxRow}>
            <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.infoBoxText, { color: theme.text }]} numberOfLines={1}>{request.purpose || 'General'}</Text>
          </View>
          <View style={styles.infoBoxRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.infoBoxText, { color: theme.text }]}>{formatDate(dateStr)}</Text>
          </View>
          {isBulk && (
            <View style={styles.infoBoxRow}>
              <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.infoBoxText, { color: theme.text }]}>
                {(() => {
                  const parts: string[] = [];
                  const sc = request.staffCount ?? 0;
                  const stc = request.studentCount ?? 0;
                  if (sc > 0) parts.push(`Staff - ${sc}`);
                  if (stc > 0) parts.push(`Students - ${stc}`);
                  if (parts.length === 0) { const total = request.participantCount || 0; return `${total} Participant${total !== 1 ? 's' : ''}`; }
                  return parts.join(', ');
                })()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardBottomRow}>
          <View style={[styles.statusPill, { backgroundColor: badge.bgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
            <Text style={[styles.statusPillText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => onBack && onBack()} style={[styles.backButton, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>My Requests</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => onBack && onBack()} style={[styles.backButton, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: theme.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {allRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>No requests found</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>Your requests will appear here</Text>
          </View>
        ) : (
          allRequests.map((request, index) => (
            <View key={`${request.passType === 'BULK' ? 'bulk' : 'single'}-${request.id}-${index}`}>
              {renderRequestCard(request)}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <SinglePassDetailsModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        request={selectedRequest}
        viewerRole="staff"
        onViewQR={(req) => handleViewQR(req, false)}
        timelineSteps={selectedRequest ? (() => {
          const s = selectedRequest.status;
          const approved = s === 'APPROVED';
          const rejected = s === 'REJECTED';
          return [
            { label: 'Request Submitted', status: 'done' as const },
            {
              label: 'HOD Approval',
              status: approved ? 'done' as const : rejected ? 'rejected' as const : 'pending' as const,
              remark: selectedRequest.hodRemark || selectedRequest.rejectionReason,
            },
          ];
        })() : []}
      />

      <GatePassQRModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        personName={user.name || user.staffName || 'Staff'}
        personId={user.staffCode}
        qrCodeData={qrCodeData}
        manualCode={manualCode}
        reason={selectedRequest?.reason || selectedRequest?.purpose}
      />

      <MyRequestsBulkModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        requestId={selectedBulkId || 0}
        userRole="STAFF"
        viewerRole="STAFF"
        currentUserId={user.staffCode}
        requesterInfo={{ name: user.name || user.staffName || 'Staff', role: 'Staff', department: user.department || '' }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  emptyState: { paddingVertical: 80, alignItems: 'center' },
  emptyStateText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, marginTop: 8 },
  requestCard: { borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  cardNameBlock: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  typePillInline: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  typePillInlineText: { fontSize: 9, fontWeight: '600' },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  cardTimeAgo: { fontSize: 12, flexShrink: 0 },
  infoBox: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 5 },
  infoBoxRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoBoxText: { fontSize: 13, flex: 1 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  requestInfoCard: { borderRadius: 12, padding: 16, marginBottom: 20 },
  requestInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestInfoLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  requestInfoValue: { fontSize: 14, fontWeight: '600' },
  reasonSection: { marginBottom: 24 },
  reasonLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  reasonText: { fontSize: 15, lineHeight: 22 },
  timeline: { marginBottom: 24 },
  timelineHeading: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  timelineBar: { height: 3, borderRadius: 2, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineContent: { flex: 1, paddingTop: 8 },
  timelineTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  timelineStatus: { fontSize: 14 },
  remarkBox: { marginTop: 8, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 3 },
  remarkLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  remarkText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  timelineLine: { width: 2, height: 32, marginLeft: 19, marginVertical: 4 },
  viewQRButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 8 },
  viewQRButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default MyRequestsScreen;
