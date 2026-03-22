import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HR, ScreenName } from '../../types';
import { apiService } from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { formatDateShort } from '../../utils/dateUtils';
import NotificationDropdown from '../../components/NotificationDropdown';
import BulkDetailsModal from '../../components/BulkDetailsModal';
import SinglePassDetailsModal from '../../components/SinglePassDetailsModal';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';
import ConfirmationModal from '../../components/ConfirmationModal';

interface NewHRDashboardProps {
  hr: HR;
  onLogout: () => void;
  onNavigate: (screen: ScreenName) => void;
}

const NewHRDashboard: React.FC<NewHRDashboardProps> = ({
  hr,
  onLogout,
  onNavigate,
}) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [bottomTab, setBottomTab] = useState<'HOME' | 'PROFILE'>('HOME');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkId, setSelectedBulkId] = useState<number | null>(null);
  const [selectedBulkRequester, setSelectedBulkRequester] = useState<any>(null);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { unreadCount, loadNotifications } = useNotifications();

  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    loadRequests();
    loadNotifications(hr.hrCode, 'hr');
  }, []);

  const loadRequests = async () => {
    try {
      const hrCode = hr.hrCode;
      
      // Fetch HOD bulk pass requests pending HR approval
      const bulkResult = await apiService.getHRPendingBulkPasses();
      // Fetch HOD single gate pass requests pending HR approval
      const singleResult = await apiService.getHRPendingRequests(hrCode);
      
      let allRequests: any[] = [];
      
      if (bulkResult.success && bulkResult.requests) {
        allRequests = bulkResult.requests.map((req: any) => ({
          ...req,
          requestType: 'BULK',
        }));
      }

      if (singleResult.success && singleResult.data) {
        const singleRequests = singleResult.data.map((req: any) => ({
          ...req,
          requestType: 'SINGLE',
          hrApproval: req.hrApproval || 'PENDING',
        }));
        allRequests = [...allRequests, ...singleRequests];
      }
      
      setRequests(allRequests);
      
      const pending = allRequests.filter((r: any) =>
        r.hrApproval === 'PENDING_HR' || r.hrApproval === 'PENDING' || !r.hrApproval
      ).length;
      const approved = allRequests.filter((r: any) => r.hrApproval === 'APPROVED').length;
      const rejected = allRequests.filter((r: any) => r.hrApproval === 'REJECTED').length;
      
      setStats({ pending, approved, rejected });
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = searchQuery === '' ||
      request.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.hodCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.regNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.id?.toString().includes(searchQuery);

    let matchesTab = false;
    if (activeTab === 'PENDING') {
      matchesTab = request.hrApproval === 'PENDING_HR' || request.hrApproval === 'PENDING' || !request.hrApproval;
    } else if (activeTab === 'APPROVED') {
      matchesTab = request.hrApproval === 'APPROVED';
    } else if (activeTab === 'REJECTED') {
      matchesTab = request.hrApproval === 'REJECTED';
    }

    return matchesSearch && matchesTab;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleApprove = async (id?: number, remark?: string) => {
    const targetId = id || selectedRequest?.id;
    if (!targetId) return;
    const req = selectedRequest;

    setProcessing(true);

    try {
      if (req && req.requestType === 'SINGLE') {
        await apiService.approveRequestAsHR(targetId, hr.hrCode);
      } else {
        await apiService.approveHODBulkPass(targetId, hr.hrCode);
      }
      setShowDetailModal(false);
      setShowBulkModal(false);
      setSelectedRequest(null);
      setModalTitle('Approved');
      setModalMessage('Request approved successfully.');
      setShowSuccessModal(true);
      loadRequests();
    } catch (error: any) {
      setModalTitle('Error');
      setModalMessage(error.message || 'An error occurred.');
      setShowErrorModal(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id?: number, remark?: string) => {
    const targetId = id || selectedRequest?.id;
    if (!targetId) return;
    const req = selectedRequest;
    const targetRemark = remark || 'Rejected by HR';

    setProcessing(true);

    try {
      if (req && req.requestType === 'SINGLE') {
        await apiService.rejectRequestAsHR(targetId, hr.hrCode, targetRemark);
      } else {
        await apiService.rejectHODBulkPass(targetId, hr.hrCode, targetRemark);
      }
      setShowDetailModal(false);
      setShowBulkModal(false);
      setSelectedRequest(null);
      setModalTitle('Rejected');
      setModalMessage('Request has been rejected.');
      setShowSuccessModal(true);
      loadRequests();
    } catch (error: any) {
      setModalTitle('Error');
      setModalMessage(error.message || 'An error occurred.');
      setShowErrorModal(true);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.type === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => { setBottomTab('PROFILE'); onNavigate('PROFILE'); }}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{getInitials(hr.name || 'HR')}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>GOOD MORNING,</Text>
            <Text style={[styles.userName, { color: theme.text }]}>{(hr.name || 'HR').toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surfaceHighlight }]} onPress={() => setShowNotificationDropdown(true)}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && <View style={[styles.notificationIndicator, { backgroundColor: theme.success, borderColor: theme.surface }]} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surfaceHighlight }]} onPress={() => setShowLogoutModal(true)}>
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={20} color={theme.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search requests..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Stats Tabs */}
      <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={[styles.statTab, activeTab === 'PENDING' && { borderBottomColor: theme.primary }]} onPress={() => setActiveTab('PENDING')}>
          <Text style={[styles.statLabel, { color: theme.textTertiary }, activeTab === 'PENDING' && { color: theme.primary }]}>PENDING</Text>
          <Text style={[styles.statValue, { color: theme.textSecondary }, activeTab === 'PENDING' && { color: theme.text }]}>{stats.pending}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statTab, activeTab === 'APPROVED' && { borderBottomColor: theme.success }]} onPress={() => setActiveTab('APPROVED')}>
          <Text style={[styles.statLabel, { color: theme.textTertiary }, activeTab === 'APPROVED' && { color: theme.success }]}>APPROVED</Text>
          <Text style={[styles.statValue, { color: theme.textSecondary }, activeTab === 'APPROVED' && { color: theme.text }]}>{stats.approved}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statTab, activeTab === 'REJECTED' && { borderBottomColor: theme.error }]} onPress={() => setActiveTab('REJECTED')}>
          <Text style={[styles.statLabel, { color: theme.textTertiary }, activeTab === 'REJECTED' && { color: theme.error }]}>REJECTED</Text>
          <Text style={[styles.statValue, { color: theme.textSecondary }, activeTab === 'REJECTED' && { color: theme.text }]}>{stats.rejected}</Text>
        </TouchableOpacity>
      </View>

      {/* Request List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No {activeTab.toLowerCase()} requests</Text>
          </View>
        ) : (
          filteredRequests.map((request) => (
            <TouchableOpacity
              key={`${request.requestType}-${request.id}`}
              style={[styles.requestCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => {
                setSelectedRequest(request);
                setSelectedBulkId(request.id);
                if (request.requestType === 'BULK') {
                  setSelectedBulkRequester({ name: request.requestedByStaffName || request.hodCode || 'HOD', role: request.userType || 'HOD', department: request.department || 'Department' });
                  setShowBulkModal(true);
                } else {
                  setShowDetailModal(true);
                }
              }}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarContainer, { backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.cardAvatarText, { color: theme.textSecondary }]}>
                    {getInitials(request.requestType === 'BULK' ? (request.hodCode || 'HOD') : (request.requestedByStaffName || request.studentName || 'ST'))}
                  </Text>
                </View>
                <View style={styles.headerMainInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.requestStudentName, { color: theme.text }]} numberOfLines={1}>
                      {request.requestType === 'SINGLE' ? (request.requestedByStaffName || request.studentName || request.regNo || `Request #${request.id}`) : `${request.requestedByStaffName || request.hodCode || 'Staff'}`}
                    </Text>
                    <Text style={[styles.passTypeLabel, { color: theme.textSecondary }]}>
                      {request.requestType === 'BULK' ? '(Bulk Gatepass)' : '(Single Gatepass)'}
                    </Text>
                  </View>
                  <Text style={[styles.studentIdSub, { color: theme.textSecondary }]}>
                    {request.requestType === 'SINGLE' ? `${request.requestedByStaffCode || request.regNo || 'N/A'} • ${request.department || 'Department'}` : `${request.userType || 'HOD'} • ${request.department || 'N/A'}`}
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
                    Exit: {formatDateShort(request.exitDateTime || request.requestDate)}
                  </Text>
                </View>
                {request.requestType === 'BULK' && (
                  <View style={styles.detailItem}>
                    <Ionicons name="people" size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {(() => {
                        const parts: string[] = [];
                        const total = request.participantCount || 0;
                        const students = request.studentCount || 0;
                        const staffCount = Math.max(0, total - students);
                        if (staffCount > 0) parts.push(`Staff - ${staffCount}`);
                        if (students > 0) parts.push(`Students - ${students}`);
                        return parts.join(', ') || `${total} Participants`;
                      })()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardFooter}>
                <View style={[
                  styles.statusBadge,
                  (request.hrApproval === 'PENDING_HR' || request.hrApproval === 'PENDING' || !request.hrApproval) && { backgroundColor: theme.warning + '22' },
                  request.hrApproval === 'APPROVED' && { backgroundColor: theme.success + '22' },
                  request.hrApproval === 'REJECTED' && { backgroundColor: theme.error + '22' },
                ]}>
                  <Text style={[
                    styles.statusText,
                    (request.hrApproval === 'PENDING_HR' || request.hrApproval === 'PENDING' || !request.hrApproval) && { color: theme.warning },
                    request.hrApproval === 'APPROVED' && { color: theme.success },
                    request.hrApproval === 'REJECTED' && { color: theme.error },
                  ]}>
                    {request.hrApproval === 'PENDING_HR' || request.hrApproval === 'PENDING' || !request.hrApproval ? 'PENDING' : request.hrApproval}
                  </Text>
                </View>
                {request.requestType === 'BULK' && (
                  <View style={[styles.viewBadge, { backgroundColor: theme.surfaceHighlight }]}>
                    <Ionicons name="people" size={14} color={theme.textSecondary} />
                    <Text style={[styles.viewBadgeText, { color: theme.textSecondary }]}>Bulk Gatepass</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setBottomTab('HOME')}>
          <Ionicons name={bottomTab === 'HOME' ? 'home' : 'home-outline'} size={22} color={bottomTab === 'HOME' ? theme.primary : theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }, bottomTab === 'HOME' && { color: theme.primary }]}>Home</Text>
          {bottomTab === 'HOME' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => { setBottomTab('PROFILE'); onNavigate('PROFILE'); }}>
          <Ionicons name={bottomTab === 'PROFILE' ? 'person' : 'person-outline'} size={22} color={bottomTab === 'PROFILE' ? theme.primary : theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }, bottomTab === 'PROFILE' && { color: theme.primary }]}>Profile</Text>
          {bottomTab === 'PROFILE' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
        </TouchableOpacity>
      </View>

      {/* Notification Dropdown */}
      <NotificationDropdown
        visible={showNotificationDropdown}
        onClose={() => setShowNotificationDropdown(false)}
        userId={hr.hrCode}
        userType="hr"
      />

      {/* Bulk Detail Modal */}
      <BulkDetailsModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        requestId={selectedBulkId || 0}
        requesterInfo={selectedBulkRequester}
        onApprove={(id, remark) => handleApprove(id, remark)}
        onReject={(id, remark) => handleReject(id, remark)}
        showActions={selectedRequest && (selectedRequest.hrApproval === 'PENDING_HR' || selectedRequest.hrApproval === 'PENDING' || !selectedRequest.hrApproval)}
        currentUserId={hr.hrCode}
        processing={processing}
      />

      {/* Request Detail Modal */}
      {/* Single Pass Detail Modal */}
      <SinglePassDetailsModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        request={selectedRequest}
        onApprove={(id, remark) => handleApprove(id, remark)}
        onReject={(id, remark) => handleReject(id, remark)}
        showActions={selectedRequest && (selectedRequest.hrApproval === 'PENDING_HR' || selectedRequest.hrApproval === 'PENDING' || !selectedRequest.hrApproval)}
        viewerRole="hr"
        processing={processing}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setShowSuccessModal(false)}
        autoClose={true}
        autoCloseDelay={2500}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        type="api"
        title={modalTitle}
        message={modalMessage}
        onClose={() => setShowErrorModal(false)}
      />
      <ConfirmationModal
        visible={showLogoutModal}
        title="Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        onConfirm={onLogout}
        onCancel={() => setShowLogoutModal(false)}
        icon="log-out-outline"
        confirmColor={theme.error}
      />

      {/* Full-screen processing overlay */}
      {processing && (
        <View style={styles.processingOverlay} pointerEvents="box-only">
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.processingText, { color: theme.text }]}>Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerInfo: { gap: 2 },
  greeting: { fontSize: 13 },
  userName: { fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notificationIndicator: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  searchInput: { flex: 1, fontSize: 16 },
  statsContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  statTab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  statLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: '700' },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyState: { paddingVertical: 80, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  requestCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardAvatarText: { fontSize: 16, fontWeight: '700' },
  headerMainInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8, flexShrink: 1 },
  requestStudentName: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
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
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 8 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, position: 'relative' },
  navLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  activeIndicator: { position: 'absolute', bottom: 0, width: 32, height: 3, borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContainer: { flex: 1, marginTop: 60, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, maxHeight: '100%' },
  modalScrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  modalSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, letterSpacing: 0.5 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalLabel: { fontSize: 14 },
  modalValue: { fontSize: 14, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8 },
  rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 12, gap: 8 },
  rejectButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  approveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, gap: 8 },
  approveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  remarkBox: { borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  remarkLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  remarkValue: { fontSize: 14, fontWeight: '500' },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  processingBox: { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', gap: 14, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  processingText: { fontSize: 15, fontWeight: '600' },
});

export default NewHRDashboard;
