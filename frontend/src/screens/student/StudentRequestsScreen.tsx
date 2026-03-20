import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  Image,
  TextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Student } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import RequestTimeline from '../../components/RequestTimeline';
import MyRequestsBulkModal from '../../components/MyRequestsBulkModal';
import GatePassQRModal from '../../components/GatePassQRModal';
import { useErrorModal } from '../../hooks/useErrorModal';
import { AppError } from '../../utils/errorHandler';
import ErrorModal from '../../components/ErrorModal';

interface StudentRequestsScreenProps {
  student: Student;
  onTabChange: (tab: 'HOME' | 'REQUESTS' | 'HISTORY' | 'PROFILE') => void;
}

const StudentRequestsScreen: React.FC<StudentRequestsScreenProps> = ({
  student,
  onTabChange,
}) => {
  const { theme, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [manualEntryCode, setManualEntryCode] = useState<string | null>(null);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewAttachmentUri, setPreviewAttachmentUri] = useState<string | null>(null);
  const { errorInfo, showError, hideError, handleRetry, isVisible: isErrorVisible } = useErrorModal();

  useEffect(() => {
    const onBackPress = () => {
      onTabChange('HOME');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onTabChange]);

  useEffect(() => {
    loadRequests();
  }, []);

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

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const filteredRequests = requests.filter(request => {
    return searchQuery === '' ||
      request.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.id?.toString().includes(searchQuery);
  });

  const handleViewQR = async (request: any) => {
    if (!request.id) return;
    setSelectedRequest(request);
    setShowQRModal(true);
    try {
       if (request.qrCode) {
        setQrCodeData(request.qrCode);
        setManualEntryCode(request.manualEntryCode || request.manualCode || null);
        return;
      }
      const response = await apiService.getGatePassQRCode(request.id, student.regNo, false);
      if (response.success && response.qrCode) {
        setQrCodeData(response.qrCode);
        setManualEntryCode(response.manualCode || null);
      } else {
        showError(new AppError('api', response.message || 'Could not fetch QR code', 'QR Code Error'));
        setShowQRModal(false);
      }
    } catch (error: any) {
       showError(error);
       setShowQRModal(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#10B981';
      case 'REJECTED': return '#EF4444';
      case 'PENDING_HOD': return '#3B82F6';
      default: return '#F59E0B';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Requests</Text>
      </View>
      <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={20} color={theme.textTertiary} />
        <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search requests..." placeholderTextColor={theme.textTertiary} value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>No requests found</Text>
          </View>
        ) : (
          filteredRequests.map((request) => (
            <TouchableOpacity key={request.id} style={[styles.requestCard, { backgroundColor: theme.cardBackground }]} onPress={() => {
                setSelectedRequest(request);
                setSelectedRequestId(request.id);
                if (request.requestType === 'BULK') setShowBulkModal(true);
                else setShowDetailModal(true);
            }}>
              <View style={styles.requestHeader}>
                <Text style={[styles.requestTitle, { color: theme.text }]} numberOfLines={1}>{request.purpose || 'Gate Pass Request'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>{getStatusLabel(request.status)}</Text>
                </View>
              </View>
              <Text style={[styles.requestDate, { color: theme.textTertiary }]}>{formatDate(request.requestDate)}</Text>
              {request.status === 'APPROVED' && (
                <TouchableOpacity style={[styles.quickQrButton, { backgroundColor: theme.success + '20' }]} onPress={(e) => { e.stopPropagation(); handleViewQR(request); }}>
                    <Ionicons name="qr-code-outline" size={16} color={theme.success} />
                    <Text style={[styles.quickQrText, { color: theme.success }]}>View QR Code</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
       <View style={[styles.bottomNav, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('HOME')}>
          <Ionicons name="home-outline" size={24} color={theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('REQUESTS')}>
          <Ionicons name="document-text" size={24} color={theme.primary} />
          <Text style={[styles.navLabelActive, { color: theme.primary }]}>Requests</Text>
          <View style={{ position: 'absolute', bottom: 0, width: 32, height: 3, borderRadius: 2, backgroundColor: theme.primary }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('HISTORY')}>
          <Ionicons name="time-outline" size={24} color={theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onTabChange('PROFILE')}>
          <Ionicons name="person-outline" size={24} color={theme.textTertiary} />
          <Text style={[styles.navLabel, { color: theme.textTertiary }]}>Profile</Text>
        </TouchableOpacity>
      </View>
      <GatePassQRModal visible={showQRModal} onClose={() => setShowQRModal(false)} personName={`${student.firstName} ${student.lastName || ''}`} personId={student.regNo} qrCodeData={qrCodeData} manualCode={manualEntryCode} reason={selectedRequest?.reason || selectedRequest?.purpose}/>
      <ErrorModal visible={isErrorVisible} type={errorInfo?.type || 'general'} title={errorInfo?.title} message={errorInfo?.message || ''} onClose={hideError} onRetry={errorInfo?.canRetry ? handleRetry : undefined} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  emptyState: { paddingVertical: 80, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  requestCard: { borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  requestDate: { fontSize: 13, marginTop: 4 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, elevation: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  navLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  navLabelActive: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  quickQrButton: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickQrText: { fontSize: 12, fontWeight: '700' },
});

export default StudentRequestsScreen;
