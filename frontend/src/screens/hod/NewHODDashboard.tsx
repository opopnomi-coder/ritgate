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
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HOD, ScreenName } from '../../types';
import { apiService } from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import PassTypeBottomSheet from '../../components/PassTypeBottomSheet';
import NotificationDropdown from '../../components/NotificationDropdown';
import BulkDetailsModal from '../../components/BulkDetailsModal';
import SinglePassDetailsModal from '../../components/SinglePassDetailsModal';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';
import ConfirmationModal from '../../components/ConfirmationModal';

interface NewHODDashboardProps {
  hod: HOD;
  onLogout: () => void;
  onNavigate: (screen: ScreenName) => void;
}

const NewHODDashboard: React.FC<NewHODDashboardProps> = ({
  hod,
  onLogout,
  onNavigate,
}) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [bottomTab, setBottomTab] = useState<'HOME' | 'NEW_PASS' | 'MY_REQUESTS' | 'PROFILE'>('HOME');
  const [showPassTypeModal, setShowPassTypeModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkId, setSelectedBulkId] = useState<number | null>(null);
  const [selectedBulkRequester, setSelectedBulkRequester] = useState<any>(null);
  const [hodRemark, setHodRemark] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewAttachmentUri, setPreviewAttachmentUri] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { unreadCount, loadNotifications } = useNotifications();
  const { profileImage } = useProfile();

  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    loadRequests();
    loadNotifications(hod.hodCode, 'hod');
  }, []);

  const loadRequests = async () => {
    try {
      const response = await apiService.getAllHODRequests(hod.hodCode);

      if (response.success && response.requests) {
        setRequests(response.requests);

        // Only count requests from staff/students — exclude HOD's own submissions
        const incomingOnly = response.requests.filter((r: any) =>
          r.userType !== 'HOD' &&
          r.requestedByStaffCode !== hod.hodCode &&
          r.regNo !== hod.hodCode
        );

        const pending = incomingOnly.filter((r: any) =>
          r.status === 'PENDING_HOD'
        ).length;

        const approved = incomingOnly.filter((r: any) =>
          r.status === 'APPROVED'
        ).length;

        const rejected = incomingOnly.filter((r: any) =>
          r.status === 'REJECTED'
        ).length;

        setStats({ pending, approved, rejected });
      }
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
    // Exclude the HOD's own submissions — those belong in My Requests
    const isOwnRequest =
      request.userType === 'HOD' ||
      (request.requestedByStaffCode && request.requestedByStaffCode === hod.hodCode) ||
      (request.regNo && request.regNo === hod.hodCode);
    if (isOwnRequest) return false;

    const matchesSearch = searchQuery === '' ||
      request.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.id?.toString().includes(searchQuery);

    let matchesTab = false;
    if (activeTab === 'PENDING') {
      // Only show requests that have passed staff approval and are waiting for HOD
      matchesTab = request.status === 'PENDING_HOD';
    } else if (activeTab === 'APPROVED') {
      matchesTab = request.status === 'APPROVED';
    } else if (activeTab === 'REJECTED') {
      matchesTab = request.status === 'REJECTED';
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
    const targetRemark = remark !== undefined ? remark : hodRemark;
    if (!targetId) return;

    setProcessing(true);
    // Close modals immediately
    setShowDetailModal(false);
    setShowBulkModal(false);
    setSelectedRequest(null);
    setHodRemark('');

    try {
      await apiService.approveGatePassByHOD(hod.hodCode, targetId, targetRemark);
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
    const targetRemark = remark !== undefined ? remark : hodRemark;
    if (!targetId) return;
    if (!targetRemark.trim()) {
      setModalTitle('Remark Required');
      setModalMessage('Please provide a reason for rejection.');
      setShowErrorModal(true);
      return;
    }

    setProcessing(true);
    // Close modals immediately
    setShowDetailModal(false);
    setShowBulkModal(false);
    setSelectedRequest(null);
    setHodRemark('');

    try {
      await apiService.rejectGatePassByHOD(hod.hodCode, targetId, targetRemark.trim());
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
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.warning }]}>
                <Text style={styles.avatarText}>{getInitials(hod.hodName || 'HOD')}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>GOOD MORNING,</Text>
            <Text style={[styles.userName, { color: theme.text }]}>{(hod.hodName || 'HOD').toUpperCase()}</Text>
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
        <TouchableOpacity style={[styles.statTab, activeTab === 'PENDING' && { borderBottomColor: theme.warning }]} onPress={() => setActiveTab('PENDING')}>
          <Text style={[styles.statLabel, { color: theme.textTertiary }, activeTab === 'PENDING' && { color: theme.warning }]}>PENDING</Text>
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
              key={request.id}
              style={[styles.requestCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => {
                setSelectedRequest(request);
                setHodRemark('');
                if (request.passType === 'BULK') {
                  setSelectedBulkId(request.id);
                  setSelectedBulkRequester({ name: request.requestedByStaffName || 'Staff', role: request.userType || 'Staff', department: request.department || 'Department' });
                  setShowBulkModal(true);
                } else {
                  setShowDetailModal(true);
                }
              }}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarContainer, { backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.requestAvatarText, { color: theme.textSecondary }]}>
                    {getInitials(request.passType === 'BULK' ? (request.requestedByStaffName || 'BR') : (request.studentName || 'ST'))}
                  </Text>
                </View>
                <View style={styles.headerMainInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.requestStudentName, { color: theme.text }]} numberOfLines={1}>
                      {request.passType === 'BULK' ? (request.requestedByStaffName || `Staff: ${request.requestedByStaffCode}`) : request.studentName || 'Unknown'}
                    </Text>
                    <View style={[styles.passTypePill, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                      <Text style={[styles.passTypePillText, { color: theme.text }]}>{request.passType === 'BULK' ? 'Bulk Pass' : 'Gatepass'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.studentIdSub, { color: theme.textSecondary }]}>
                    {request.passType === 'BULK' ? `${request.userType || 'Staff'} • ${request.department || 'Department'}` : `${request.regNo || 'N/A'} • ${request.department || 'Department'}`}
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
                  request.hodApproval === 'PENDING' && { backgroundColor: theme.warning + '22' },
                  request.hodApproval === 'APPROVED' && { backgroundColor: theme.success + '22' },
                  request.hodApproval === 'REJECTED' && { backgroundColor: theme.error + '22' },
                ]}>
                  <Text style={[
                    styles.statusText,
                    request.hodApproval === 'PENDING' && { color: theme.warning },
                    request.hodApproval === 'APPROVED' && { color: theme.success },
                    request.hodApproval === 'REJECTED' && { color: theme.error },
                  ]}>
                    {request.hodApproval || 'PENDING'}
                  </Text>
                </View>
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
        <TouchableOpacity style={styles.navItem} onPress={() => { setBottomTab('NEW_PASS'); setShowPassTypeModal(true); }}>
          <Ionicons name="add-circle-outline" size={32} color={theme.textSecondary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>New Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => { setBottomTab('MY_REQUESTS'); onNavigate('HOD_MY_REQUESTS'); }}>
          <Ionicons name={bottomTab === 'MY_REQUESTS' ? 'list' : 'list-outline'} size={22} color={bottomTab === 'MY_REQUESTS' ? theme.primary : theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }, bottomTab === 'MY_REQUESTS' && { color: theme.primary }]}>My Requests</Text>
          {bottomTab === 'MY_REQUESTS' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
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
        userId={hod.hodCode}
        userType="hod"
      />

      {/* Pass Type Selection Modal */}
      <PassTypeBottomSheet
        visible={showPassTypeModal}
        onClose={() => {
          setShowPassTypeModal(false);
          setBottomTab('HOME');
        }}
        onSelectSingle={() => {
          setShowPassTypeModal(false);
          onNavigate('HOD_GATE_PASS_REQUEST');
        }}
        onSelectBulk={() => {
          setShowPassTypeModal(false);
          onNavigate('HOD_BULK_GATE_PASS');
        }}
      />

      {/* Fullscreen Attachment Preview Modal */}
      <Modal
        visible={showAttachmentPreview}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAttachmentPreview(false)}
      >
        <View style={styles.attachmentPreviewOverlay}>
          <TouchableOpacity
            style={styles.attachmentPreviewClose}
            onPress={() => setShowAttachmentPreview(false)}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {previewAttachmentUri && (
            <Image
              source={{ uri: previewAttachmentUri }}
              style={styles.attachmentPreviewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Bulk Detail Modal */}
      <BulkDetailsModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        requestId={selectedBulkId || 0}
        requesterInfo={selectedBulkRequester}
        onApprove={(id, remark) => handleApprove(id, remark)}
        onReject={(id, remark) => handleReject(id, remark)}
        showActions={selectedRequest && selectedRequest.status === 'PENDING_HOD'}
        currentUserId={hod.hodCode}
        processing={processing}
      />

      {/* Single Pass Detail Modal */}
      <SinglePassDetailsModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        request={selectedRequest}
        onApprove={(id, remark) => handleApprove(id, remark)}
        onReject={(id, remark) => handleReject(id, remark)}
        showActions={selectedRequest && selectedRequest.status === 'PENDING_HOD'}
        viewerRole="hod"
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerInfo: { gap: 2 },
  greeting: { fontSize: 12 },
  userName: { fontSize: 16, fontWeight: '700' },
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
  requestAvatarText: { fontSize: 16, fontWeight: '700' },
  headerMainInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestStudentName: { fontSize: 15, fontWeight: '700' },
  passTypePill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  passTypePillText: { fontSize: 12, fontWeight: '600' },
  studentIdSub: { fontSize: 13, marginTop: 2 },
  timeAgoContainer: { alignSelf: 'flex-start', paddingTop: 4 },
  timeAgoText: { fontSize: 12 },
  detailsBlock: { borderRadius: 12, padding: 12, gap: 8, marginBottom: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 },
  viewBadgeText: { fontSize: 13, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  viewButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, gap: 6 },
  viewButtonText: { fontSize: 14, fontWeight: '700' },
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
  attachmentPreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  attachmentPreviewClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 10 },
  attachmentPreviewImage: { width: '95%', height: '78%', borderRadius: 12 },
  vContainer: { flex: 1 },
});

export default NewHODDashboard;
