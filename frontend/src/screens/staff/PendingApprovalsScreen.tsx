import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Staff } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import BulkDetailsModal from '../../components/BulkDetailsModal';
import SinglePassDetailsModal from '../../components/SinglePassDetailsModal';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface PendingApprovalsScreenProps {
  user: Staff;
  navigation?: any;
  onBack?: () => void;
}

const PendingApprovalsScreen: React.FC<PendingApprovalsScreenProps> = ({ user, navigation, onBack }) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkId, setSelectedBulkId] = useState<number | null>(null);
  const [selectedBulkRequester, setSelectedBulkRequester] = useState<any>(null);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [staffRemark, setStaffRemark] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const handleGoBack = () => {
    if (navigation?.goBack) navigation.goBack();
    else if (onBack) onBack();
  };

  useEffect(() => { loadPendingRequests(); }, []);

  const loadPendingRequests = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getStaffVisitorRequests(user.staffCode);
      if (response.success && response.data) setPendingRequests(response.data);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingRequests();
    setRefreshing(false);
  };

  const handleApprove = async (requestId: number, remark?: string) => {
    const targetRemark = remark !== undefined ? remark : staffRemark;
    setProcessingId(requestId);
    setVerificationModalVisible(false);
    setShowBulkModal(false);
    try {
      const res = await apiService.approveGatePassByStaff(user.staffCode, requestId, targetRemark);
      if (res.success !== false) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setFeedbackMessage('Request approved successfully.');
        setShowSuccessModal(true);
      } else {
        setFeedbackMessage(res.message || 'Failed to approve request.');
        setShowErrorModal(true);
      }
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to approve request.');
      setShowErrorModal(true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (requestId: number, remark?: string) => {
    if (remark !== undefined) {
      setShowBulkModal(false);
      doReject(requestId, remark);
    } else {
      setRejectingRequestId(requestId);
      setRejectReason('');
      setRejectModalVisible(true);
    }
  };

  const doReject = async (requestId: number, reason: string) => {
    setProcessingId(requestId);
    try {
      const res = await apiService.rejectGatePassByStaff(user.staffCode, requestId, reason.trim());
      if (res.success !== false) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setFeedbackMessage('Request rejected.');
        setShowSuccessModal(true);
      } else {
        setFeedbackMessage(res.message || 'Failed to reject request.');
        setShowErrorModal(true);
      }
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to reject request.');
      setShowErrorModal(true);
    } finally {
      setProcessingId(null);
    }
  };

  const confirmReject = () => {
    const requestId = selectedRequest?.id || rejectingRequestId;
    const reason = rejectReason || staffRemark;
    if (!reason.trim()) { Alert.alert('Error', 'Please provide a reason for rejection'); return; }
    if (requestId === null) return;
    setRejectModalVisible(false);
    setVerificationModalVisible(false);
    setRejectReason('');
    setStaffRemark('');
    setRejectingRequestId(null);
    doReject(requestId as number, reason);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={handleGoBack} style={[styles.backButton, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Pending Approvals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading requests...</Text>
          </View>
        ) : pendingRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>No pending requests</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>All gate pass requests have been processed</Text>
          </View>
        ) : (
          pendingRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => {
                setSelectedRequest(request);
                setStaffRemark('');
                if (request.passType === 'BULK') {
                  setSelectedBulkId(request.id);
                  setSelectedBulkRequester({ name: request.requestedByStaffName || 'Staff', role: request.userType || 'Staff', department: request.department || 'Dept' });
                  setShowBulkModal(true);
                } else {
                  setVerificationModalVisible(true);
                }
              }}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarContainer, { backgroundColor: theme.inputBackground }]}>
                  <Text style={[styles.avatarText, { color: theme.textSecondary }]}>
                    {getInitials(request.passType === 'BULK' ? (request.requestedByStaffName || 'BR') : (request.regNo || 'ST'))}
                  </Text>
                </View>
                <View style={styles.headerMainInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.requestStudentName, { color: theme.text }]}>
                      {request.passType === 'BULK' ? (request.requestedByStaffName || 'Bulk Request') : request.regNo}
                    </Text>
                    <Text style={[styles.passTypeLabel, { color: theme.textSecondary }]}>
                      {request.passType === 'BULK' ? '(Bulk Gatepass)' : '(Single Gatepass)'}
                    </Text>
                  </View>
                  <Text style={[styles.studentIdSub, { color: theme.textSecondary }]}>
                    {request.passType === 'BULK'
                      ? `${request.userType || 'Staff'} • ${request.department || 'Dept'}`
                      : `${request.regNo} • ${request.department || 'Department'}`}
                  </Text>
                </View>
                <View style={styles.timeAgoContainer}>
                  <Text style={[styles.timeAgoText, { color: theme.textTertiary }]}>{request.requestDate ? '2h ago' : ''}</Text>
                </View>
              </View>

              <View style={[styles.detailsBlock, { backgroundColor: theme.inputBackground }]}>
                <View style={styles.detailItem}>
                  <Ionicons name="medical" size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.text }]}>{request.purpose || 'General'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar" size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.text }]}>
                    Exit: {new Date(request.exitDateTime || request.requestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                {request.passType === 'BULK' && (
                  <View style={styles.detailItem}>
                    <Ionicons name="people" size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {(() => {
                        const parts: string[] = [];
                        if (request.includeStaff) parts.push('Staff - 1');
                        if (request.studentCount) parts.push(`Students - ${request.studentCount}`);
                        return parts.join(', ') || 'Bulk Pass';
                      })()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardFooter}>
                <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.statusText, { color: theme.warning }]}>PENDING</Text>
                </View>
                <View style={styles.footerActions}>
                  {request.passType === 'BULK' && (
                    <View style={[styles.viewBadge, { backgroundColor: theme.inputBackground }]}>
                      <Ionicons name="people" size={14} color={theme.textSecondary} />
                      <Text style={[styles.viewBadgeText, { color: theme.textSecondary }]}>Bulk Pass</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.actionIcon, { backgroundColor: theme.success }, processingId === request.id && { opacity: 0.5 }]}
                    onPress={() => handleApprove(request.id)}
                    disabled={processingId !== null}
                  >
                    {processingId === request.id ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="checkmark" size={20} color="#FFF" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionIcon, { backgroundColor: theme.error }, processingId === request.id && { opacity: 0.5 }]}
                    onPress={() => handleReject(request.id)}
                    disabled={processingId !== null}
                  >
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <BulkDetailsModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        requestId={selectedBulkId || 0}
        requesterInfo={selectedBulkRequester}
        onApprove={(id, remark) => handleApprove(id, remark)}
        onReject={(id, remark) => handleReject(id, remark)}
        showActions={selectedRequest && (selectedRequest.status === 'PENDING' || !selectedRequest.status)}
      />

      <SinglePassDetailsModal
        visible={verificationModalVisible}
        onClose={() => setVerificationModalVisible(false)}
        request={selectedRequest}
        onApprove={(id, remark) => handleApprove(id, remark)}
        onReject={(id, remark) => handleReject(id, remark)}
        showActions={selectedRequest && (selectedRequest.status === 'PENDING' || !selectedRequest.status)}
        viewerRole="staff"
        processing={processingId !== null}
      />

      <SuccessModal visible={showSuccessModal} title="Done" message={feedbackMessage} onClose={() => setShowSuccessModal(false)} autoClose={true} autoCloseDelay={2000} />
      <ErrorModal visible={showErrorModal} type="api" title="Action Failed" message={feedbackMessage} onClose={() => setShowErrorModal(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 16 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyStateText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  requestCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  headerMainInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestStudentName: { fontSize: 17, fontWeight: '700' },
  passTypeLabel: { fontSize: 9, fontWeight: '500' },
  studentIdSub: { fontSize: 13, marginTop: 2 },
  timeAgoContainer: { alignSelf: 'flex-start', paddingTop: 4 },
  timeAgoText: { fontSize: 12 },
  detailsBlock: { borderRadius: 12, padding: 12, gap: 8, marginBottom: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  viewBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  viewBadgeText: { fontSize: 9, fontWeight: '600' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});

export default PendingApprovalsScreen;
