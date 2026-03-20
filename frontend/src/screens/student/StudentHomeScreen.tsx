import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Student } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useProfile } from '../../context/ProfileContext';
import NotificationDropdown from '../../components/NotificationDropdown';
import RequestTimeline from '../../components/RequestTimeline';
import GatePassQRModal from '../../components/GatePassQRModal';
import ConfirmationModal from '../../components/ConfirmationModal';

interface StudentHomeScreenProps {
  student: Student;
  onLogout: () => void;
  onNavigate: (screen: any) => void;
  onTabChange: (tab: 'HOME' | 'REQUESTS' | 'HISTORY' | 'PROFILE') => void;
  onRequestGatePass: () => void;
}

const StudentHomeScreen: React.FC<StudentHomeScreenProps> = ({
  student,
  onLogout,
  onNavigate,
  onTabChange,
  onRequestGatePass,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const { unreadCount } = useNotifications();
  const { profileImage } = useProfile();
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({
    entries: 0,
    exits: 0,
  });
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [manualEntryCode, setManualEntryCode] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load entry/exit stats
      const historyResponse = await apiService.getUserEntryHistory(student.regNo);
      const historyData = (historyResponse as any).history || historyResponse || [];
      
      const entries = historyData.filter((item: any) => 
        item.type === 'ENTRY'
      ).length;
      const exits = historyData.filter((item: any) => 
        item.type === 'EXIT'
      ).length;
      setStats({ entries, exits });

      // Load recent requests
      const response = await apiService.getStudentGatePassRequests(student.regNo);
      console.log('📊 Gate pass requests loaded:', {
        success: response.success,
        count: response.requests?.length || 0
      });

      if (response.success && response.requests) {
        // Get only the most recent 3 requests
        const recent = response.requests
          .sort((a: any, b: any) => {
            const dateB = new Date(b.requestDate).getTime();
            const dateA = new Date(a.requestDate).getTime();
            if (dateB !== dateA) return dateB - dateA;
            
            // Extract numeric part of ID for robust sorting (e.g., "GP-47" -> 47)
            const idB = parseInt(b.id?.toString().split('-')[1]) || 0;
            const idA = parseInt(a.id?.toString().split('-')[1]) || 0;
            return idB - idA;
          })
          .slice(0, 10);
        
        console.log('📋 Recent requests:', recent.map((r: any) => ({
          id: r.id,
          status: r.status,
          hodApproval: r.hodApproval,
          hasQrCode: !!r.qrCode,
          hasManualCode: !!(r.manualEntryCode || r.manualCode)
        })));
        
        setRecentRequests(recent);
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING,';
    if (hour < 17) return 'GOOD AFTERNOON,';
    return 'GOOD EVENING,';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return '#10B981';
      case 'REJECTED':
        return '#EF4444';
      case 'PENDING_HOD':
        return '#3B82F6'; // blue — staff approved, waiting for HOD
      default:
        return '#F59E0B'; // amber — PENDING_STAFF or PENDING
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING_STAFF': return 'AWAITING STAFF';
      case 'PENDING_HOD': return 'AWAITING HOD';
      case 'APPROVED': return 'APPROVED';
      case 'REJECTED': return 'REJECTED';
      default: return status || 'PENDING';
    }
  };

  const handleViewQR = async (request: any) => {
    console.log('🔍 handleViewQR called with request:', {
      id: request.id,
      status: request.status,
      hodApproval: request.hodApproval,
      hasQrCode: !!request.qrCode,
      hasManualCode: !!(request.manualEntryCode || request.manualCode)
    });

    if (!request.id) {
      console.error('❌ No request ID');
      Alert.alert('Error', 'Invalid request');
      return;
    }

    if (request.status !== 'APPROVED') {
      console.error('❌ Request not fully approved:', {
        status: request.status,
        hodApproval: request.hodApproval
      });
      Alert.alert('Error', 'This request is not fully approved yet');
      return;
    }
    
    setSelectedRequest(request);
    setQrCodeData(null);
    setManualEntryCode(null);
    setShowQRModal(true);

    try {
      // Check if QR code is already in the request object
      if (request.qrCode) {
        console.log('✅ Using QR code from request object');
        setQrCodeData(request.qrCode);
        const manualCode = request.manualEntryCode || request.manualCode || null;
        console.log('📝 Manual code from request:', manualCode);
        setManualEntryCode(manualCode);
        return;
      }

      console.log('🌐 Fetching QR code from API...');
      const response = await apiService.getGatePassQRCode(request.id, student.regNo, false);
      
      console.log('📡 API Response:', {
        success: response.success,
        hasQrCode: !!response.qrCode,
        hasManualCode: !!(response.manualCode || (response as any).manualEntryCode),
        message: response.message
      });

      if (response.success && response.qrCode) {
        let qrCodeValue = response.qrCode;
        
        // Check if it's a QR string format or base64 image
        if (!qrCodeValue.startsWith('GP|') && 
            !qrCodeValue.startsWith('ST|') && 
            !qrCodeValue.startsWith('SF|') && 
            !qrCodeValue.startsWith('VG|')) {
          qrCodeValue = qrCodeValue.startsWith('data:image')
            ? qrCodeValue
            : `data:image/png;base64,${qrCodeValue}`;
          console.log('✅ Converted to base64 image format');
        } else {
          console.log('✅ Using QR string format:', qrCodeValue.substring(0, 20) + '...');
        }

        setQrCodeData(qrCodeValue);
        
        // Try multiple fields for manual code
        const manualCode = response.manualCode || 
                          (response as any).manualEntryCode || 
                          request.manualEntryCode || 
                          request.manualCode || 
                          null;
        console.log('📝 Manual code set:', manualCode);
        setManualEntryCode(manualCode);
      } else {
        console.error('❌ API returned error:', response.message);
        Alert.alert('Error', response.message || 'Could not fetch QR code');
        setShowQRModal(false);
      }
    } catch (error) {
      console.error('❌ Error fetching QR code:', error);
      Alert.alert('Error', 'Failed to load QR code. Please try again.');
      setShowQRModal(false);
    }
  };

  const handleRequestClick = (request: any) => {
    setSelectedRequest(request);
    // If approved, show QR modal, otherwise show status modal
    if (request.status === 'APPROVED') {
      handleViewQR(request);
    } else {
      setShowDetailModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => onTabChange('PROFILE')}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(student.firstName, student.lastName)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              {student.firstName.toUpperCase()} {student.lastName?.charAt(0) || ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowNotificationDropdown(true)}
          >
            <Ionicons name="notifications-outline" size={24} color="#1F2937" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowLogoutModal(true)}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Entry/Exit Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.entries}</Text>
            <Text style={styles.statLabel}>ENTRIES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.exits}</Text>
            <Text style={styles.statLabel}>EXITS</Text>
          </View>
        </View>

        {/* Request Gate Pass Card */}
        <TouchableOpacity 
          style={styles.requestCard}
          onPress={onRequestGatePass}
          activeOpacity={0.7}
        >
          {/* Dark Top Section */}
          <View style={styles.requestCardTop}>
            <Ionicons name="shield-checkmark" size={40} color="rgba(255,255,255,0.7)" />
          </View>
          {/* White Bottom Section */}
          <View style={styles.requestCardBottom}>
            <View style={styles.requestCardContent}>
              <Text style={styles.requestCardTitle}>Request Gate Pass</Text>
            </View>
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={onRequestGatePass}
            >
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Recent Requests Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT REQUESTS</Text>
        </View>

        {recentRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No recent requests</Text>
          </View>
        ) : (
          recentRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestItem}
              onPress={() => handleRequestClick(request)}
              activeOpacity={0.7}
            >
              <View style={styles.requestItemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestId}>
                    {request.purpose || 'Gate Pass Request'}
                  </Text>
                  <Text style={styles.requestReason} numberOfLines={1}>
                    {formatDate(request.requestDate)}
                  </Text>
                </View>
                <View 
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(request.status) }
                  ]}
                >
                  <Text style={styles.statusText}>
                    {getStatusLabel(request.status)}
                  </Text>
                </View>
              </View>
              {request.status === 'APPROVED' && (
                <TouchableOpacity
                  style={styles.viewQRButton}
                  onPress={() => handleViewQR(request)}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.viewQRButtonText}>View QR</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onTabChange('HOME')}
        >
          <Ionicons name="home" size={24} color="#1F2937" />
          <Text style={styles.navLabelActive}>Home</Text>
          <View style={styles.activeIndicator} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onTabChange('REQUESTS')}
        >
          <Ionicons name="document-text-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onTabChange('HISTORY')}
        >
          <Ionicons name="time-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onTabChange('PROFILE')}
        >
          <Ionicons name="person-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Notification Dropdown */}
      <NotificationDropdown
        visible={showNotificationDropdown}
        onClose={() => setShowNotificationDropdown(false)}
        userId={student.regNo}
        userType="student"
      />

      {/* Status Detail Modal - Shows until HOD approval */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContainer}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Status</Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close-circle" size={30} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <ScrollView style={styles.detailModalContent} showsVerticalScrollIndicator={false}>
                {/* Simple Header - Request ID and Date */}
                <View style={styles.statusModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusModalId}>#{selectedRequest.id}</Text>
                    <Text style={styles.statusModalDate}>
                      {new Date(selectedRequest.requestDate).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>

                {/* Timeline */}
                <View style={{ marginBottom: 20 }}>
                  <RequestTimeline
                    status={selectedRequest.status}
                    staffApproval={selectedRequest.staffApproval || 'PENDING'}
                    hodApproval={selectedRequest.hodApproval || 'PENDING'}
                    requestDate={selectedRequest.requestDate}
                    staffRemark={selectedRequest.staffRemark}
                    hodRemark={selectedRequest.hodRemark}
                  />
                </View>

                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Text style={styles.closeModalButtonText}>Close Status</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <GatePassQRModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        personName={`${student.firstName} ${student.lastName || ''}`}
        personId={student.regNo}
        qrCodeData={qrCodeData}
        manualCode={manualEntryCode}
        reason={selectedRequest?.reason || selectedRequest?.purpose}
      />

      <ConfirmationModal
        visible={showLogoutModal}
        title="Logout"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        onConfirm={onLogout}
        onCancel={() => setShowLogoutModal(false)}
        icon="log-out-outline"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#06B6D4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerInfo: {
    gap: 2,
  },
  greeting: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  requestCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  requestCardTop: {
    backgroundColor: '#1E293B',
    paddingVertical: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
  },
  requestCardContent: {
    flex: 1,
  },
  requestCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  requestCardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  applyButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginLeft: 12,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 12,
  },
  requestItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  requestItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  viewQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06B6D4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 12,
    gap: 6,
    alignSelf: 'flex-start',
  },
  viewQRButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  requestId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  requestReason: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  navLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  navLabelActive: {
    fontSize: 12,
    color: '#1F2937',
    marginTop: 4,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 3,
    backgroundColor: '#1F2937',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  qrModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    padding: 20,
  },
  qrCodeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  qrCodeImage: {
    width: 200,
    height: 200,
  },
  qrLoadingContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrLoadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  manualCodeContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  manualCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  manualCodeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 2,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
  },
  detailModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  detailModalContent: {
    paddingHorizontal: 20,
  },
  infoSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
  closeModalButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontWeight: '800',
    color: '#1F2937',
  },
  // Floating QR Styles
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalSheet: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    width: '85%',
    maxWidth: 360,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
  },
  qrModalScrollContent: {
    width: '100%',
  },
  qrModalUserName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  qrModalUserCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  qrModalCodeCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalManualBox: {
    borderWidth: 2,
    borderColor: '#1F2937',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  qrModalManualLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  qrModalManualValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F2937',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrModalScanText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  qrModalDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  qrModalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrModalDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  qrModalDetailValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '800',
  },
  // Status Modal Header Styles
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusModalId: {
    fontSize: 20,
    fontWeight: '800',
    color: '#06B6D4',
    marginBottom: 6,
  },
  statusModalDate: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

});

export default StudentHomeScreen;


