import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Student, GatePassRequest, ScreenName } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import QRCodeModal from '../../components/QRCodeModal';
import RequestTimeline from '../../components/RequestTimeline';
import Modal from 'react-native-modal';
import ErrorModal from '../../components/ErrorModal';

const TypedModal = Modal as any;

interface RequestsScreenProps {
  user: Student;
  onBack: () => void;
  onNavigate: (screen: ScreenName) => void;
}

type FilterTab = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const RequestsScreen: React.FC<RequestsScreenProps> = ({ user, onBack, onNavigate }) => {
  const { theme, isDark } = useTheme();
  const [requests, setRequests] = useState<GatePassRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Removed filter state - showing all requests now
  
  // QR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GatePassRequest | null>(null);
  
  // Tracking Modal State
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingRequest, setTrackingRequest] = useState<GatePassRequest | null>(null);

  // Error Modal State
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRequests();
    
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 800, 
        useNativeDriver: true 
      }),
      Animated.spring(slideAnim, { 
        toValue: 0, 
        tension: 50, 
        friction: 7, 
        useNativeDriver: true 
      }),
    ]).start();

    // Auto-refresh every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      loadRequests();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const loadRequests = async () => {
    if (!user?.regNo) return;
    
    setLoading(true);
    try {
      const response = await apiService.getStudentGatePassRequests(user.regNo);
      if (response.success && response.requests) {
        setRequests(response.requests);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleViewQR = async (request: GatePassRequest) => {
    if (!request.id) return;
    
    console.log('📱 handleViewQR called for request:', {
      id: request.id,
      passType: request.passType,
      status: request.status,
      hasQrCode: !!request.qrCode,
      qrCode: request.qrCode
    });
    
    setSelectedRequest(request);
    setQrCodeData(null);
    setManualCode(null);
    setShowQRModal(true);

    try {
      // Check if QR code is already in the request object (for ALL pass types)
      if (request.qrCode) {
        console.log('✅ Using QR code from request object:', request.qrCode);
        // QR code string is already available, pass it directly to modal
        setQrCodeData(request.qrCode);
        
        // Extract manual code if available (check both field names)
        const manualCodeValue = (request as any).manualCode || (request as any).manualEntryCode || null;
        if (manualCodeValue) {
          console.log('✅ Manual code from request:', manualCodeValue);
          setManualCode(manualCodeValue);
        } else {
          setManualCode(null);
        }
        return;
      }

      // If no QR in object, fetch from API as fallback
      console.log('🔍 Fetching QR code from API for request:', request.id);
      const response = await apiService.getGatePassQRCode(request.id, user.regNo, false);
      
      console.log('📡 API Response:', response);
      
      if (response.success && response.qrCode) {
        if (response.qrCode.startsWith('GP|') || 
            response.qrCode.startsWith('SF|') || 
            response.qrCode.startsWith('ST|') || 
            response.qrCode.startsWith('VG|')) {
          setQrCodeData(response.qrCode);
        } else {
          const qrCodeWithPrefix = response.qrCode.startsWith('data:image')
            ? response.qrCode
            : `data:image/png;base64,${response.qrCode}`;
          setQrCodeData(qrCodeWithPrefix);
        }
        
        const manualCodeValue = (response as any).manualCode || null;
        setManualCode(manualCodeValue);
      } else {
        console.error('❌ Failed to get QR code:', response.message);
        setErrorMessage(response.message || 'Could not fetch QR code');
        setShowErrorModal(true);
        setShowQRModal(false);
      }
    } catch (error) {
      console.error('❌ Error fetching QR code:', error);
      setErrorMessage('Failed to load QR code');
      setShowErrorModal(true);
      setShowQRModal(false);
    }
  };

  const handleCardPress = (request: GatePassRequest) => {
    // Show QR for approved requests (both single and bulk passes)
    if (request.status === 'APPROVED' || request.status === 'APPROVED_BY_HOD' || request.status === 'USED') {
      // For bulk passes, check if QR code exists
      if (request.passType === 'BULK' && request.qrCode) {
        // Only show QR if this student is the owner
        if (request.qrOwnerId === user.regNo) {
          handleViewQR(request);
        } else {
          setTrackingRequest(request);
          setShowTrackingModal(true);
        }
      } else if (request.passType !== 'BULK') {
        // For single passes, always try to fetch QR
        handleViewQR(request);
      } else {
        // Bulk pass without QR (still pending HOD approval)
        setTrackingRequest(request);
        setShowTrackingModal(true);
      }
    } else {
      setTrackingRequest(request);
      setShowTrackingModal(true);
    }
  };

  const getFilteredRequests = () => {
    // Show all requests without filtering
    return requests;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#10B981';
      case 'PENDING': return '#F59E0B';
      case 'REJECTED': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getFilterCount = (filter: FilterTab) => {
    if (filter === 'ALL') return requests.length;
    return requests.filter(req => req.status === filter).length;
  };

  const filteredRequests = getFilteredRequests();

  return (
    <SafeAreaProvider>
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.background }]} 
        edges={['top', 'left', 'right']}
      >
        <StatusBar 
          barStyle={isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.background} 
        />
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity 
            onPress={onBack}
            style={[styles.backButton, { backgroundColor: theme.cardBackground }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            My Requests
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Requests List */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={theme.primary} 
            />
          }
        >
          {loading && requests.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading requests...
              </Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No requests found
              </Text>
            </View>
          ) : (
            <Animated.View 
              style={{ 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }] 
              }}
            >
              {filteredRequests.map((request, index) => (
                <TouchableOpacity
                  key={request.id || index}
                  style={[styles.requestCard, { backgroundColor: theme.cardBackground }]}
                  onPress={() => handleCardPress(request)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {request.purpose || 'Gate Pass Request'}
                      </Text>
                      <Text style={[styles.cardDate, { color: theme.textSecondary }]}>
                        {formatDate(request.requestDate)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { 
                          backgroundColor: (request.status === 'APPROVED_BY_HOD' || request.status === 'USED') ? '#D1FAE5' : 
                                         request.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7'
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { 
                            color: (request.status === 'APPROVED_BY_HOD' || request.status === 'USED') ? '#065F46' : 
                                   request.status === 'REJECTED' ? '#991B1B' : '#92400E'
                          }
                        ]}
                      >
                        {request.status || 'PENDING'}
                      </Text>
                    </View>
                  </View>

                  {/* Removed individual reason display from card to keep it clean, available in tracking modal if needed */}

                  {((request.status === 'APPROVED' || request.status === 'APPROVED_BY_HOD' || request.status === 'USED') && 
                    (request.passType !== 'BULK' || (request.qrCode && request.qrOwnerId === user.regNo))) ? (
                    <TouchableOpacity
                      style={[styles.quickQrButton, { backgroundColor: theme.primary + '15' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleViewQR(request);
                      }}
                    >
                      <View style={styles.cardFooter}>
                        <Ionicons name="qr-code-outline" size={16} color={theme.primary} />
                        <Text style={[styles.cardFooterText, { color: theme.primary }]}>
                          {request.passType === 'BULK' ? 'View Group Pass QR' : 'View QR Code'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.cardFooter}>
                      <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                      <Text style={[styles.cardFooterText, { color: theme.textSecondary }]}>
                        {request.passType === 'BULK' && request.status !== 'REJECTED' ? 'Waiting for HOD approval' : 'Tap to track status'}
                      </Text>
                    </View>
                  )}

                  {request.status === 'REJECTED' && request.rejectionReason && (
                    <View style={[styles.rejectionContainer, { backgroundColor: theme.background }]}>
                      <Ionicons name="close-circle" size={16} color="#EF4444" />
                      <Text style={[styles.rejectionText, { color: theme.text }]} numberOfLines={2}>
                        {request.rejectionReason}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </ScrollView>

        {/* QR Code Modal */}
        <QRCodeModal
          visible={showQRModal}
          onClose={() => setShowQRModal(false)}
          qrCodeData={qrCodeData}
          manualCode={manualCode}
          request={selectedRequest}
        />

        <ErrorModal
          visible={showErrorModal}
          type="general"
          message={errorMessage}
          onClose={() => setShowErrorModal(false)}
        />

        {/* Tracking Modal */}
        <TypedModal
          isVisible={showTrackingModal}
          onBackdropPress={() => setShowTrackingModal(false)}
          onBackButtonPress={() => setShowTrackingModal(false)}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          backdropOpacity={0.5}
          style={styles.trackingModal}
        >
          <View style={[styles.trackingModalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.trackingModalHeader}>
              <Text style={[styles.trackingModalTitle, { color: theme.text }]}>
                Request Status
              </Text>
              <TouchableOpacity onPress={() => setShowTrackingModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {trackingRequest && (
              <RequestTimeline
                status={trackingRequest.status}
                staffApproval={trackingRequest.approvedByStaff || 'PENDING'}
                hodApproval={trackingRequest.approvedByHOD || 'PENDING'}
                requestDate={trackingRequest.requestDate}
              />
            )}

            <TouchableOpacity
              style={[styles.trackingCloseButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowTrackingModal(false)}
            >
              <Text style={styles.trackingCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TypedModal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    marginTop: 50,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  requestCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardReason: {
    fontSize: 14,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rejectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  rejectionText: {
    fontSize: 12,
    flex: 1,
  },
  trackingModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  trackingModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  trackingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  trackingModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  trackingCloseButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  trackingCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  quickQrButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});

export default RequestsScreen;
