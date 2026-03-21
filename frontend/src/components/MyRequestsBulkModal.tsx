import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, StatusBar, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ParticipantsScreen from '../screens/shared/ParticipantsScreen';
import GatePassQRModal from './GatePassQRModal';

const { width: SCREEN_W } = Dimensions.get('window');

interface MyRequestsBulkModalProps {
  visible: boolean;
  onClose: () => void;
  requestId: number;
  userRole?: 'STAFF' | 'HOD';
  viewerRole?: 'STUDENT' | 'STAFF' | 'HOD';
  currentUserId?: string;
  requesterInfo?: { name: string; role: string; department: string };
}

const MyRequestsBulkModal: React.FC<MyRequestsBulkModalProps> = ({
  visible, onClose, requestId, userRole = 'STAFF', viewerRole, currentUserId, requesterInfo,
}) => {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);
  const [requester, setRequester] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (visible && requestId) { loadDetails(); setShowQR(false); }
  }, [visible, requestId]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = userRole === 'HOD'
        ? await (apiService as any).getHODBulkGatePassDetails(requestId)
        : await apiService.getBulkGatePassDetails(requestId) as any;
      if (response.success) {
        const data = response.request || response.data || response;
        setDetails(data);
        setParticipants(
          (response.request?.participants) || response.participants ||
          (response.request?.students) || response.students || []
        );
        setRequester(response.requester || response.request?.requester || requesterInfo);
      } else {
        setError(response.message || 'Failed to load details');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const getInitials = (name: string) =>
    (name || 'BK').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const students = participants.filter(p => p.type === 'student' || !p.type);
  const staffParticipants = participants.filter(p => p.type === 'staff' || p.type === 'hod');

  const isReceiver = (p: any) =>
    details?.qrOwnerId
      ? String(details.qrOwnerId).trim() === String(p.id || p.regNo || p.staffCode).trim()
      : false;

  const statusStr = details?.status != null ? String(details.status) : null;
  const hodApprovalStr = details?.hodApproval != null ? String(details.hodApproval) : null;
  const hrApprovalStr = details?.hrApproval != null ? String(details.hrApproval) : null;

  const isApproved = statusStr === 'APPROVED' || !!(details?.qrCode);
  const isRejected = statusStr === 'REJECTED';
  const hasQR = !!(details?.qrCode || details?.qrData?.qrString);
  const isQROwner = currentUserId
    ? String(currentUserId).trim() === String(details?.qrOwnerId || '').trim()
    : true;

  // "Applied by" — shown when the viewer is a receiver but someone else created the pass
  // e.g. class incharge created it and assigned a student/staff as receiver
  const appliedByName = details?.requestedByStaffName || requester?.name || null;
  const viewerIsReceiver = currentUserId
    ? String(currentUserId).trim() === String(details?.qrOwnerId || '').trim()
    : false;
  // Show "Applied by" only when viewer is the receiver AND the requester is someone else
  const showAppliedBy = viewerIsReceiver && appliedByName &&
    appliedByName !== (requesterInfo?.name || '') &&
    String(currentUserId || '').trim() !== String(details?.requestedByStaffCode || details?.staffCode || '').trim();

  const statusColor = isRejected ? theme.error : isApproved ? theme.success : theme.warning;
  const statusLabel = isRejected ? 'REJECTED' : isApproved ? 'APPROVED' : (statusStr || 'PENDING');

  const superiorApprovalLabel = userRole === 'HOD' ? 'HR Approval' : 'HOD Approval';
  const superiorRemark = userRole === 'HOD' ? details?.hrRemark : details?.hodRemark;
  const superiorApproved = userRole === 'HOD'
    ? (hrApprovalStr === 'APPROVED' || statusStr === 'APPROVED')
    : (hodApprovalStr === 'APPROVED' || statusStr === 'APPROVED');
  const superiorRejected = userRole === 'HOD'
    ? (hrApprovalStr === 'REJECTED' || statusStr === 'REJECTED')
    : hodApprovalStr === 'REJECTED';

  const tlSteps = [
    { label: 'Request Submitted', status: 'done' as const, remark: undefined },
    {
      label: superiorApprovalLabel,
      status: superiorApproved ? 'done' as const : superiorRejected ? 'rejected' as const : 'pending' as const,
      remark: superiorRemark,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Bulk Pass Details</Text>
          {!loading && !error && (
            <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={48} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={loadDetails}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* Profile row */}
            <View style={[styles.profileRow, { backgroundColor: theme.surface }]}>
              <View style={[styles.avatar, { backgroundColor: statusColor }]}>
                <Text style={styles.avatarText}>
                  {getInitials(requester?.name || details?.requestedByStaffName || 'BK')}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
                  {requester?.name || details?.requestedByStaffName || 'N/A'}
                </Text>
                <Text style={[styles.profileSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  {requester?.role || userRole} • {requester?.department || details?.department || 'N/A'}
                </Text>
              </View>
              {participants.length > 0 && (
                <View style={[styles.countChip, { backgroundColor: theme.primary + '22' }]}>
                  <Ionicons name="people" size={13} color={theme.primary} />
                  <Text style={[styles.countChipText, { color: theme.primary }]}>{participants.length}</Text>
                </View>
              )}
            </View>

            {/* Applied by — shown when viewer is the receiver and someone else created the pass */}
            {showAppliedBy && (
              <View style={[styles.block, { backgroundColor: theme.surface }]}>
                <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>APPLIED BY</Text>
                <View style={styles.appliedByRow}>
                  <View style={[styles.appliedByAvatar, { backgroundColor: theme.primary + '22' }]}>
                    <Text style={[styles.appliedByAvatarText, { color: theme.primary }]}>
                      {(appliedByName || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.appliedByInfo}>
                    <Text style={[styles.appliedByName, { color: theme.text }]}>{appliedByName}</Text>
                    <Text style={[styles.appliedBySub, { color: theme.textSecondary }]}>
                      {details?.requestedByRole || (viewerRole === 'STUDENT' ? 'Class Incharge' : 'HOD')}
                    </Text>
                  </View>
                  <View style={[styles.appliedByBadge, { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name="person-circle-outline" size={14} color={theme.primary} />
                    <Text style={[styles.appliedByBadgeText, { color: theme.primary }]}>Organiser</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Info grid */}
            <View style={[styles.infoGrid, { backgroundColor: theme.surface }]}>
              <View style={styles.infoCell}>
                <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>PURPOSE</Text>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                  {details?.purpose || 'N/A'}
                </Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
              <View style={styles.infoCell}>
                <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>DATE</Text>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                  {formatDate(details?.exitDateTime || details?.requestDate)}
                </Text>
              </View>
            </View>

            {/* Reason */}
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>REASON</Text>
              <Text style={[styles.reasonText, { color: theme.textSecondary }]}>
                {details?.reason || 'No reason provided.'}
              </Text>
            </View>

            {/* Attachment */}
            {!!details?.attachmentUri && (
              <View style={[styles.block, { backgroundColor: theme.surface }]}>
                <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>PREVIEW</Text>
                <TouchableOpacity style={styles.previewBox} onPress={() => setShowFullscreen(true)} activeOpacity={0.85}>
                  <Image source={{ uri: details.attachmentUri }} style={styles.previewImage} resizeMode="cover" />
                  <View style={styles.previewOverlay}>
                    <Ionicons name="expand-outline" size={16} color="#FFF" />
                    <Text style={styles.previewOverlayText}>Tap to expand</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Approval timeline */}
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>APPROVAL TIMELINE</Text>
              {tlSteps.map((step, idx) => {
                const dotColor = step.status === 'done' ? theme.success
                  : step.status === 'rejected' ? theme.error
                  : theme.inputBackground;
                const statusTxt = step.status === 'done' ? '✓ Completed'
                  : step.status === 'rejected' ? '✗ Rejected'
                  : 'Pending';
                const statusTxtColor = step.status === 'done' ? theme.success
                  : step.status === 'rejected' ? theme.error
                  : theme.textSecondary;
                return (
                  <View key={idx}>
                    <View style={styles.tlItem}>
                      <View style={[styles.tlDot, { backgroundColor: dotColor, borderWidth: step.status === 'pending' ? 2 : 0, borderColor: theme.border }]}>
                        {step.status === 'done' && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        {step.status === 'rejected' && <Ionicons name="close" size={14} color="#FFF" />}
                        {step.status === 'pending' && <View style={[styles.tlDotInner, { backgroundColor: theme.textTertiary }]} />}
                      </View>
                      <View style={styles.tlBody}>
                        <Text style={[styles.tlTitle, { color: theme.text }]}>{step.label}</Text>
                        <Text style={[styles.tlStatus, { color: statusTxtColor }]}>{statusTxt}</Text>
                        {step.remark ? (
                          <View style={[styles.tlRemark, { backgroundColor: theme.background, borderLeftColor: theme.warning }]}>
                            <Text style={[styles.tlRemarkLabel, { color: theme.textSecondary }]}>Remark:</Text>
                            <Text style={[styles.tlRemarkText, { color: theme.text }]}>{step.remark}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {idx < tlSteps.length - 1 && (
                      <View style={[styles.tlConnector, { backgroundColor: step.status === 'done' ? theme.success : theme.border }]} />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>
        )}

        {/* Footer */}
        {!loading && !error && (
          <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {participants.length > 0 && (
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: theme.primary, marginBottom: 10 }]}
                onPress={() => setShowParticipants(true)}
              >
                <Ionicons name="people" size={20} color="#FFF" />
                <Text style={styles.footerBtnText}>View Participants ({participants.length})</Text>
              </TouchableOpacity>
            )}
            {isApproved && hasQR && isQROwner && viewerRole !== 'STUDENT' ? (
              <TouchableOpacity style={[styles.footerBtn, { backgroundColor: theme.success }]} onPress={() => setShowQR(true)}>
                <Ionicons name="qr-code" size={20} color="#FFF" />
                <Text style={styles.footerBtnText}>View QR & Manual Code</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.footerBtn, { backgroundColor: theme.primary }]} onPress={onClose}>
                <Text style={styles.footerBtnText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <GatePassQRModal
          visible={showQR}
          onClose={() => setShowQR(false)}
          personName={requester?.name || details?.requestedByStaffName || 'N/A'}
          personId={String(details?.qrOwnerId || '')}
          qrCodeData={details?.qrCode || details?.qrData?.qrString || null}
          manualCode={details?.manualCode || details?.qrData?.manualEntryCode}
          reason={details?.purpose}
        />

        <Modal visible={showParticipants} animationType="slide" transparent={false} onRequestClose={() => setShowParticipants(false)}>
          <ParticipantsScreen
            participants={[
              ...students.map(s => ({
                id: s.id || s.regNo || '',
                name: s.name || s.studentName || s.fullName || 'N/A',
                type: 'student' as const,
                department: s.department,
                isReceiver: isReceiver(s),
              })),
              ...staffParticipants.map(s => ({
                id: s.id || s.staffCode || '',
                name: s.name || s.fullName || 'N/A',
                type: 'staff' as const,
                department: s.department,
                isReceiver: isReceiver(s),
              })),
            ]}
            onBack={() => setShowParticipants(false)}
            title="Participants"
          />
        </Modal>

        <Modal visible={showFullscreen} animationType="fade" transparent={true} onRequestClose={() => setShowFullscreen(false)}>
          <View style={styles.fullscreenOverlay}>
            <TouchableOpacity style={styles.fullscreenCloseBtn} onPress={() => setShowFullscreen(false)}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            {details?.attachmentUri && (
              <Image source={{ uri: details.attachmentUri }} style={styles.fullscreenImage} resizeMode="contain" />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16 },
  errorText: { marginTop: 12, fontSize: 16, textAlign: 'center' },
  retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 8 },

  // Profile row — matches SinglePassDetailsModal
  profileRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 12, gap: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700' },
  profileSub: { fontSize: 12, marginTop: 2 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countChipText: { fontSize: 13, fontWeight: '700' },

  // Info grid — matches SinglePassDetailsModal
  infoGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, borderRadius: 14, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  infoCell: { flex: 1, padding: 12 },
  infoDivider: { width: 1, marginVertical: 8 },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  infoValue: { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Block — matches SinglePassDetailsModal
  block: { marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  blockLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  reasonText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },

  // Attachment preview — matches SinglePassDetailsModal
  previewBox: { width: SCREEN_W * 0.38, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  previewImage: { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  previewOverlayText: { color: '#FFF', fontSize: 11, fontWeight: '600' },

  // Timeline — matches SinglePassDetailsModal
  tlItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tlDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  tlDotInner: { width: 10, height: 10, borderRadius: 5 },
  tlBody: { flex: 1, paddingTop: 4, paddingBottom: 4 },
  tlTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  tlStatus: { fontSize: 12 },
  tlConnector: { width: 2, height: 20, marginLeft: 15, marginVertical: 2 },
  tlRemark: { marginTop: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3 },
  tlRemarkLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  tlRemarkText: { fontSize: 12, lineHeight: 16 },

  // Footer — matches SinglePassDetailsModal
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 8 : 14, borderTopWidth: 1 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  footerBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Applied by
  appliedByRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appliedByAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  appliedByAvatarText: { fontSize: 14, fontWeight: '800' },
  appliedByInfo: { flex: 1 },
  appliedByName: { fontSize: 14, fontWeight: '700' },
  appliedBySub: { fontSize: 12, marginTop: 1 },
  appliedByBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  appliedByBadgeText: { fontSize: 11, fontWeight: '700' },

  // Fullscreen
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseBtn: { position: 'absolute', top: 52, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  fullscreenImage: { width: '95%', height: '80%', borderRadius: 12 },
});

export default MyRequestsBulkModal;
