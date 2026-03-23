import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, RefreshControl, StatusBar, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { SecurityPersonnel, ScreenName } from '../../types';
import { API_CONFIG } from '../../config/api.config';
import SecurityBottomNav from '../../components/SecurityBottomNav';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface VisitorRequest {
  id: number;
  name: string;
  phone: string;
  purpose: string;
  personToMeet: string;
  department?: string;
  numberOfPeople?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  qrCode?: string;
  manualCode?: string;
  createdAt: string;
}

interface Props {
  security: SecurityPersonnel;
  onBack: () => void;
  onNavigate: (screen: ScreenName) => void;
}

const SecurityVisitorQRScreen: React.FC<Props> = ({ security, onBack, onNavigate }) => {
  const [visitors, setVisitors] = useState<VisitorRequest[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<VisitorRequest[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRequest | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => { fetchVisitors(); }, []);
  useEffect(() => { applyFilter(); }, [selectedFilter, visitors]);

  const resolvedSecurityId = security.securityId || (security as any).userId || '';

  const fetchVisitors = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/security/my-visitor-requests?securityId=${resolvedSecurityId}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        setVisitors(Array.isArray(data) ? data : []);
      } else {
        setVisitors([]);
      }
    } catch (error) {
      console.error('Error fetching visitors:', error);
      setVisitors([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVisitors();
    setRefreshing(false);
  };

  const applyFilter = () => {
    if (!visitors || !Array.isArray(visitors)) { setFilteredVisitors([]); return; }
    setFilteredVisitors(selectedFilter === 'ALL' ? visitors : visitors.filter(v => v.status === selectedFilter));
  };

  const openQRModal = (visitor: VisitorRequest) => {
    if (visitor.status !== 'APPROVED') {
      setErrorMessage('This visitor request has not been approved yet.');
      setShowErrorModal(true);
      return;
    }
    setSelectedVisitor(visitor);
    setShowQRModal(true);
  };

  const copyManualCode = (code: string) => {
    try {
      Clipboard.setString(code);
      setSuccessMessage('Manual code copied to clipboard');
      setShowSuccessModal(true);
    } catch {
      setErrorMessage('Failed to copy code');
      setShowErrorModal(true);
    }
  };

  const getStatusColor = (s: string) =>
    s === 'APPROVED' ? '#10B981' : s === 'PENDING' ? '#F59E0B' : '#EF4444';

  const getStatusBg = (s: string) =>
    s === 'APPROVED' ? '#D1FAE5' : s === 'PENDING' ? '#FEF3C7' : '#FEE2E2';

  const getInitials = (name: string) =>
    (name || 'VR').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('VISITOR_REGISTRATION')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visitor QR Codes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, selectedFilter === f && styles.filterTabActive]}
            onPress={() => setSelectedFilter(f)}
          >
            <Text style={[styles.filterText, selectedFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00BCD4']} />}
      >
        {filteredVisitors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No visitor requests found</Text>
            <Text style={styles.emptySubtext}>
              {selectedFilter === 'ALL' ? 'Visitor requests will appear here' : `No ${selectedFilter.toLowerCase()} requests`}
            </Text>
          </View>
        ) : (
          filteredVisitors.map(visitor => (
            <TouchableOpacity
              key={visitor.id}
              style={styles.card}
              onPress={() => openQRModal(visitor)}
              disabled={visitor.status !== 'APPROVED'}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: '#E0F7FA' }]}>
                  <Text style={styles.avatarText}>{getInitials(visitor.name)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.visitorName}>{visitor.name}</Text>
                  <Text style={styles.visitorPhone}>{visitor.phone}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(visitor.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(visitor.status) }]}>{visitor.status}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{visitor.purpose}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>Meeting: {visitor.personToMeet}</Text>
                </View>
                {visitor.status === 'APPROVED' && (
                  <View style={styles.qrHint}>
                    <Ionicons name="qr-code" size={14} color="#00BCD4" />
                    <Text style={styles.qrHintText}>Tap to view QR code</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* QR Modal — floating card style */}
      <Modal visible={showQRModal} animationType="fade" transparent={true} statusBarTranslucent onRequestClose={() => setShowQRModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowQRModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.passCard}>
              {/* Close button */}
              <TouchableOpacity style={styles.passCloseBtn} onPress={() => setShowQRModal(false)}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>

              {selectedVisitor && (
                <>
                  {/* Name + ID */}
                  <Text style={styles.passName}>{selectedVisitor.name}</Text>
                  <Text style={styles.passId}>Visitor Pass</Text>

                  {/* QR Code centered */}
                  <View style={styles.passQrWrapper}>
                    {selectedVisitor.qrCode ? (
                      <QRCode value={selectedVisitor.qrCode} size={180} backgroundColor="white" color="black" />
                    ) : (
                      <>
                        <Ionicons name="qr-code-outline" size={64} color="#D1D5DB" />
                        <Text style={{ color: '#9CA3AF', marginTop: 8, fontSize: 13 }}>QR not available</Text>
                      </>
                    )}
                  </View>

                  {/* Manual code — dashed border box */}
                  {selectedVisitor.manualCode && (
                    <>
                      <TouchableOpacity style={styles.passManualBox} onPress={() => copyManualCode(selectedVisitor.manualCode!)}>
                        <Text style={styles.passManualDigits}>{selectedVisitor.manualCode}</Text>
                      </TouchableOpacity>
                      <Text style={styles.passScanLabel}>SCAN AT MAIN GATE EXIT</Text>
                    </>
                  )}

                  <View style={styles.passDivider} />

                  {/* Reason + Meeting rows */}
                  <View style={styles.passInfoRow}>
                    <Text style={styles.passInfoLabel}>Reason</Text>
                    <Text style={styles.passInfoValue}>{selectedVisitor.purpose}</Text>
                  </View>
                  <View style={styles.passInfoRow}>
                    <Text style={styles.passInfoLabel}>Meeting</Text>
                    <Text style={styles.passInfoValue}>{selectedVisitor.personToMeet}</Text>
                  </View>
                  {(selectedVisitor.numberOfPeople || 1) > 1 && (
                    <View style={styles.passInfoRow}>
                      <Text style={styles.passInfoLabel}>Visitors</Text>
                      <Text style={styles.passInfoValue}>{selectedVisitor.numberOfPeople} people</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <SecurityBottomNav activeTab="visitor" onNavigate={onNavigate} />

      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />
      <ErrorModal
        visible={showErrorModal}
        type="general"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, marginBottom: 12, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  filterTabActive: { backgroundColor: '#E0F7FA', borderColor: '#00BCD4' },
  filterText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#00BCD4' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#9CA3AF', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#D1D5DB', marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#00BCD4' },
  cardInfo: { flex: 1 },
  visitorName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  visitorPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  cardBody: { padding: 16, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#374151', flex: 1 },
  qrHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 8, backgroundColor: '#E0F7FA', borderRadius: 8 },
  qrHintText: { fontSize: 13, fontWeight: '600', color: '#00BCD4' },

  // Modal — floating overlay
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalScreen: { flex: 1, backgroundColor: '#F3F4F6' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  modalStatusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  modalStatusText: { fontSize: 12, fontWeight: '700' },
  modalScroll: { padding: 20, paddingBottom: 40 },

  // Profile row
  profileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, gap: 14 },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  visitorBadge: { backgroundColor: '#E0F7FA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  visitorBadgeText: { fontSize: 10, fontWeight: '700', color: '#00BCD4' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  profileSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  // Info grid
  infoGrid: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  infoCell: { flex: 1 },
  infoCellLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginBottom: 4 },
  infoCellValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  infoDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 12 },

  // QR block
  qrBlock: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center' },
  qrBlockLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 16, letterSpacing: 1 },
  qrWrapper: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB' },
  qrScanNote: { fontSize: 13, color: '#6B7280', marginTop: 14 },

  // Manual code block — matches student/staff style
  manualBlock: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  manualBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  manualBlockLabel: { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 1 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDE68A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  manualCode: { fontSize: 36, fontWeight: '800', color: '#92400E', letterSpacing: 8, textAlign: 'center' },
  manualCodeNote: { fontSize: 12, color: '#B45309', textAlign: 'center', marginTop: 8 },

  // Info block
  infoBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 10, marginBottom: 12 },
  infoBlockText: { fontSize: 14, color: '#374151', fontWeight: '500' },

  // Pass card — floating white card
  passCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 10, position: 'relative' },
  passCloseBtn: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  passName: { fontSize: 22, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 4 },
  passId: { fontSize: 13, color: '#6B7280', marginBottom: 24 },
  passQrWrapper: { padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  passManualBox: { borderWidth: 2, borderColor: '#00BCD4', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 10, alignItems: 'center' },
  passManualDigits: { fontSize: 34, fontWeight: '800', color: '#00BCD4', letterSpacing: 10 },
  passScanLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1.5, marginBottom: 20 },
  passDivider: { width: '100%', height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },
  passInfoRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  passInfoLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  passInfoValue: { fontSize: 13, color: '#1F2937', fontWeight: '600', flex: 1, textAlign: 'right' },
});

export default SecurityVisitorQRScreen;
