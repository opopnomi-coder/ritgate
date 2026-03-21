import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { HOD } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import MyRequestsBulkModal from '../../components/MyRequestsBulkModal';
import GatePassQRModal from '../../components/GatePassQRModal';
import SinglePassDetailsModal from '../../components/SinglePassDetailsModal';

interface HODMyRequestsScreenProps {
  user: HOD;
  onBack?: () => void;
}

const HODMyRequestsScreen: React.FC<HODMyRequestsScreenProps> = ({ user, onBack }) => {
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
      const result = await apiService.getHODMyGatePassRequests(user.hodCode);
      let combined: any[] = [];
      
      if (result.success && result.requests) {
        combined = result.requests;
      }

      // Sort by approval status first (APPROVED first), then by date
      combined.sort((a, b) => {
        // Priority 1: APPROVED requests first
        if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
        if (a.status !== 'APPROVED' && b.status === 'APPROVED') return 1;
        
        // Priority 2: Within same status, sort by date (newest first)
        const dateA = new Date(a.passType === 'BULK' ? a.exitDateTime : a.requestDate).getTime();
        const dateB = new Date(b.passType === 'BULK' ? b.exitDateTime : b.requestDate).getTime();
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

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, []);

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') {
      return { text: 'ACTIVE', color: '#10B981', bgColor: '#D1FAE5' };
    } else if (status === 'REJECTED') {
      return { text: 'REJECTED', color: '#EF4444', bgColor: '#FEE2E2' };
    } else {
      return { text: 'PENDING', color: '#F59E0B', bgColor: '#FEF3C7' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
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
        const result = await apiService.getHODGatePassQRCode(request.id, user.hodCode);
        if (result.success && result.qrCode) {
          setQrCodeData(result.qrCode);
          setManualCode(result.manualCode || null);
        }
      }
    } catch (error: any) {
      setShowQRModal(false);
    }
  };

  const handleReviewRequest = (request: any) => {
    if (request.passType === 'BULK') {
      setSelectedBulkId(request.id);
      setShowBulkModal(true);
    } else {
      setSelectedRequest(request);
      setShowDetailModal(true);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderRequestCard = (request: any) => {
    const badge = getStatusBadge(request.status);
    const isBulk = request.passType === 'BULK';
    const name = user.hodName || user.name || 'HOD';
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const dateStr = isBulk ? request.exitDateTime : request.requestDate;

    return (
      <TouchableOpacity
        style={styles.requestCard}
        onPress={() => handleReviewRequest(request)}
        activeOpacity={0.85}
      >
        {/* Top row: avatar + name + badge + time */}
        <View style={styles.cardTopRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.cardNameBlock}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
              <View style={styles.typePillInline}>
                <Text style={styles.typePillInlineText}>{isBulk ? 'Bulk Gatepass' : 'Single Gatepass'}</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>HOD • {user.department || 'Department'}</Text>
          </View>
          <Text style={styles.cardTimeAgo}>{getTimeAgo(dateStr)}</Text>
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <View style={styles.infoBoxRow}>
            <Ionicons name="document-text-outline" size={14} color="#6B7280" />
            <Text style={styles.infoBoxText} numberOfLines={1}>{request.purpose || 'General'}</Text>
          </View>
          <View style={styles.infoBoxRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.infoBoxText}>{formatDate(dateStr)}</Text>
          </View>
          {isBulk && (
            <View style={styles.infoBoxRow}>
              <Ionicons name="people-outline" size={14} color="#6B7280" />
              <Text style={styles.infoBoxText}>
                {(() => {
                  const parts: string[] = [];
                  const sc = request.staffCount ?? 0;
                  const stc = request.studentCount ?? 0;
                  if (sc > 0) parts.push(`Staff - ${sc}`);
                  if (stc > 0) parts.push(`Students - ${stc}`);
                  if (parts.length === 0) {
                    const total = request.participantCount || 0;
                    return `${total} Participant${total !== 1 ? 's' : ''}`;
                  }
                  return parts.join(', ');
                })()}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom row: status pill */}
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onBack && onBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Requests</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onBack && onBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F59E0B']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {allRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>No requests found</Text>
            <Text style={styles.emptyStateSubtext}>
              Your requests will appear here
            </Text>
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

      {/* Detail — full-screen */}
      <SinglePassDetailsModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        request={selectedRequest}
        viewerRole="hod"
        onViewQR={(req) => handleViewQR(req, false)}
        timelineSteps={selectedRequest ? (() => {
          const s = selectedRequest.status;
          const approved = s === 'APPROVED';
          const rejected = s === 'REJECTED';
          return [
            { label: 'Request Submitted', status: 'done' as const },
            {
              label: 'HR Approval',
              status: approved ? 'done' as const : rejected ? 'rejected' as const : 'pending' as const,
              remark: selectedRequest.hrRemark || selectedRequest.rejectionReason,
            },
          ];
        })() : []}
      />

      {/* QR Code Modal */}
      <GatePassQRModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        personName={user.hodName || user.name || 'HOD'}
        personId={user.hodCode}
        qrCodeData={qrCodeData}
        manualCode={manualCode}
        reason={selectedRequest?.reason || selectedRequest?.purpose}
      />

      {/* Bulk Detail Modal */}
      <MyRequestsBulkModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        requestId={selectedBulkId || 0}
        userRole="HOD"
        viewerRole="HOD"
        currentUserId={user.hodCode}
        requesterInfo={{
          name: user.hodName || user.name || 'HOD',
          role: 'HOD',
          department: user.department || ''
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#F59E0B',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#F59E0B',
  },
  tabBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#F9FAFB',
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  cardNameBlock: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
  },
  bulkBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  bulkBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  typePillInline: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  typePillInlineText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cardTimeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
    flexShrink: 0,
  },
  infoBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 5,
  },
  infoBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    marginLeft: 'auto',
  },
  qrButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  requestInfoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  requestInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  requestInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  reasonSection: {
    marginBottom: 24,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
  },
  timeline: {
    marginBottom: 24,
  },
  timelineHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  timelineBar: {
    height: 3,
    backgroundColor: '#10B981',
    borderRadius: 2,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconComplete: {
    backgroundColor: '#10B981',
  },
  timelineIconPending: {
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  timelineIconRejected: {
    backgroundColor: '#EF4444',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9CA3AF',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  timelineStatus: {
    fontSize: 14,
    color: '#6B7280',
  },
  timelineStatusComplete: {
    color: '#10B981',
  },
  timelineStatusRejected: {
    color: '#EF4444',
  },
  remarkBox: {
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  remarkLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 2,
  },
  remarkText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    fontWeight: '500',
  },
  timelineLine: {
    width: 2,
    height: 32,
    backgroundColor: '#E5E7EB',
    marginLeft: 19,
    marginVertical: 4,
  },
  timelineLineComplete: {
    backgroundColor: '#10B981',
  },
  viewQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  viewQRButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  qrCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrStaffInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrStaffName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  qrStaffCode: {
    fontSize: 14,
    color: '#6B7280',
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrScanText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  qrDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  qrDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  qrDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  qrCloseButtonBottom: {
    backgroundColor: '#1F2937',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  qrCloseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualCodeContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderStyle: 'dashed',
  },
  manualCodeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 1,
    marginBottom: 8,
  },
  manualCodeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 4,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  manualCodeHint: {
    fontSize: 11,
    color: '#B45309',
    textAlign: 'center',
  },
});

export default HODMyRequestsScreen;
