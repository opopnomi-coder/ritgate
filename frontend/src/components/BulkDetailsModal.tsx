import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator,
  Image, TextInput, ScrollView, Platform, Dimensions, StatusBar,
  KeyboardAvoidingView, Keyboard, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { formatDateTime, formatDateShort } from '../utils/dateUtils';
import ParticipantsScreen from '../screens/shared/ParticipantsScreen';
import GatePassQRModal from './GatePassQRModal';

const { width: SCREEN_W } = Dimensions.get('window');

interface BulkDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  requestId: number;
  requesterInfo?: { name: string; role: string; department: string };
  onApprove?: (id: number, remark: string) => void;
  onReject?: (id: number, remark: string) => void;
  showActions?: boolean;
  currentUserId?: string;
  processing?: boolean;
}

const BulkDetailsModal: React.FC<BulkDetailsModalProps> = ({
  visible, onClose, requestId, requesterInfo,
  onApprove, onReject, showActions = false, currentUserId, processing = false,
}) => {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);
  const [requester, setRequester] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [showQRDetailed, setShowQRDetailed] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showFullscreenAttachment, setShowFullscreenAttachment] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (visible && requestId) {
      loadDetails();
      setShowQRDetailed(false);
      setRemark('');
    }
  }, [visible, requestId]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getBulkGatePassDetails(requestId) as any;
      if (response.success) {
        const requestData = response.request || response.data || response;
        setDetails(requestData);
        const incomingParticipants =
          (response.request?.participants) || response.participants ||
          (response.request?.students) || response.students || [];
        setParticipants(incomingParticipants);
        setRequester(response.requester || response.request?.requester || requesterInfo);
      } else {
        setError(response.message || 'Failed to load details');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const students = participants.filter(p => p.type === 'student' || !p.type);
  const staffParticipants = participants.filter(p => p.type === 'staff' || p.type === 'hod');

  const isReceiver = (participant: any) => {
    if (!details?.qrOwnerId) return false;
    return String(details.qrOwnerId).trim() === String(participant.id || participant.regNo || participant.staffCode).trim();
  };

  const isApproved = details?.status === 'APPROVED' || details?.hrApproval === 'APPROVED' || !!details?.qrCode;
  const isRejected = details?.status === 'REJECTED';
  const statusColor = isRejected ? '#EF4444' : isApproved ? '#10B981' : '#F59E0B';
  const statusLabel = isRejected ? 'REJECTED' : isApproved ? 'APPROVED' : 'PENDING';

  const showStaffRemark = !!details?.staffRemark;
  const showHodRemark = !!details?.hodRemark;
  const attachmentUri: string | undefined = details?.attachmentUri || details?.attachmentUrl || details?.fileUrl;
  const attachmentName: string = String(details?.attachmentName || details?.fileName || '');
  const attachmentMime: string = String(details?.attachmentMimeType || details?.mimeType || '').toLowerCase();
  const isPdfAttachment =
    attachmentMime.includes('pdf') ||
    attachmentName.toLowerCase().endsWith('.pdf') ||
    String(attachmentUri || '').toLowerCase().includes('.pdf');

  const openAttachment = async () => {
    if (!attachmentUri) return;
    if (isPdfAttachment) {
      const canOpen = await Linking.canOpenURL(attachmentUri);
      if (canOpen) await Linking.openURL(attachmentUri);
      return;
    }
    setShowFullscreenAttachment(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={() => !processing && onClose()}>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: theme.inputBackground }]} disabled={processing}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Bulk Pass Details</Text>
          {!loading && !error && (
            <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {/* Body */}
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
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Profile Row */}
            <View style={[styles.profileRow, { backgroundColor: theme.surface }]}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>
                  {((requester?.name || requesterInfo?.name || 'U').charAt(0)).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
                  {requester?.name || requesterInfo?.name || details?.requestedByStaffName || 'N/A'}
                </Text>
                <Text style={[styles.profileSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  {requester?.role || requesterInfo?.role || 'Staff'} · {requester?.department || requesterInfo?.department || details?.department || 'N/A'}
                </Text>
              </View>
              {participants.length > 0 && (
                <View style={[styles.countPill, { backgroundColor: theme.primary + '22' }]}>
                  <Ionicons name="people" size={14} color={theme.primary} />
                  <Text style={[styles.countPillText, { color: theme.primary }]}>{participants.length}</Text>
                </View>
              )}
            </View>

            {/* Info Grid */}
            <View style={[styles.infoGrid, { backgroundColor: theme.surface }]}>
              <View style={styles.infoCell}>
                <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>PURPOSE</Text>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>{details?.purpose || 'N/A'}</Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
              <View style={styles.infoCell}>
                <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>DATE</Text>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                  {formatDateShort(details?.exitDateTime || details?.requestDate || '')}
                </Text>
              </View>
            </View>

            {/* Reason */}
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>REASON</Text>
              <Text style={[styles.reasonText, { color: theme.textSecondary }]}>{details?.reason || 'No reason provided.'}</Text>
            </View>

            {/* Attachment */}
            {!!attachmentUri && (
              <View style={[styles.block, { backgroundColor: theme.surface }]}>
                <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>PREVIEW</Text>
                <TouchableOpacity style={styles.previewBox} onPress={openAttachment} activeOpacity={0.85}>
                  {isPdfAttachment ? (
                    <View style={styles.pdfPreview}>
                      <Ionicons name="document-text-outline" size={26} color="#FFFFFF" />
                      <Text style={styles.previewOverlayText}>Open PDF</Text>
                    </View>
                  ) : (
                    <>
                      <Image source={{ uri: attachmentUri }} style={styles.previewImage} resizeMode="cover" />
                      <View style={styles.previewOverlay}>
                        <Ionicons name="expand-outline" size={16} color="#FFF" />
                        <Text style={styles.previewOverlayText}>Tap to expand</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Remarks */}
            {(showStaffRemark || showHodRemark) && (
              <View style={[styles.block, { backgroundColor: theme.surface }]}>
                <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>REMARKS</Text>
                {showStaffRemark && (
                  <View style={[styles.remarkChip, { backgroundColor: theme.warning + '15', borderLeftColor: theme.warning }]}>
                    <Text style={[styles.remarkChipRole, { color: theme.warning }]}>Staff</Text>
                    <Text style={[styles.remarkChipText, { color: theme.text }]}>{details.staffRemark}</Text>
                  </View>
                )}
                {showHodRemark && (
                  <View style={[styles.remarkChip, showStaffRemark && { marginTop: 8 }, { backgroundColor: theme.primary + '15', borderLeftColor: theme.primary }]}>
                    <Text style={[styles.remarkChipRole, { color: theme.primary }]}>HOD</Text>
                    <Text style={[styles.remarkChipText, { color: theme.text }]}>{details.hodRemark}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Participants button */}
            {participants.length > 0 && (
              <TouchableOpacity
                style={[styles.participantsBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowParticipants(true)}
                disabled={processing}
              >
                <Ionicons name="people" size={20} color="#FFF" />
                <Text style={styles.participantsBtnText}>View Participants</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{participants.length}</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        )}

        {/* Footer */}
        {!loading && !error && showActions && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.remarkInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Add review notes (optional)..."
                placeholderTextColor={theme.textTertiary}
                value={remark}
                onChangeText={setRemark}
                multiline
                numberOfLines={2}
                editable={!processing}
              />
              <View style={styles.actionRow}>
                {onReject && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.error }, processing && { opacity: 0.5 }]}
                    onPress={() => { Keyboard.dismiss(); onReject(requestId, remark); }}
                    disabled={processing}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFF" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                )}
                {onApprove && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.success }, processing && { opacity: 0.5 }]}
                    onPress={() => { Keyboard.dismiss(); onApprove(requestId, remark); }}
                    disabled={processing}
                  >
                    {processing
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
                    <Text style={styles.actionBtnText}>{processing ? 'Processing...' : 'Approve'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Processing overlay — freezes entire modal */}
        {processing && (
          <View style={styles.processingOverlay} pointerEvents="box-only">
            <View style={[styles.processingBox, { backgroundColor: theme.surface }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.processingText, { color: theme.text }]}>Processing...</Text>
            </View>
          </View>
        )}

        {/* Sub-screens */}
        <GatePassQRModal
          visible={showQRDetailed}
          onClose={() => setShowQRDetailed(false)}
          personName={requester?.name || details?.requestedByStaffName || 'N/A'}
          personId={String(details?.qrOwnerId || '')}
          qrCodeData={details?.qrCode || details?.qrData?.qrString || null}
          manualCode={details?.manualCode || details?.qrData?.manualEntryCode}
          reason={details?.purpose}
        />

        <Modal visible={showParticipants} animationType="slide" transparent={false} onRequestClose={() => setShowParticipants(false)}>
          <ParticipantsScreen
            participants={[
              ...students.map(s => ({ id: s.id || s.regNo || '', name: s.name || s.studentName || s.fullName || 'N/A', type: 'student' as const, department: s.department, isReceiver: isReceiver(s) })),
              ...staffParticipants.map(s => ({ id: s.id || s.staffCode || '', name: s.name || s.fullName || 'N/A', type: 'staff' as const, department: s.department, isReceiver: isReceiver(s) })),
            ]}
            onBack={() => setShowParticipants(false)}
            title="Participants"
          />
        </Modal>

        <Modal visible={showFullscreenAttachment} animationType="fade" transparent={true} onRequestClose={() => !processing && setShowFullscreenAttachment(false)}>
          <View style={styles.fsOverlay}>
            <TouchableOpacity style={styles.fsCloseBtn} onPress={() => !processing && setShowFullscreenAttachment(false)} disabled={processing}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            {attachmentUri && !isPdfAttachment && (
              <Image source={{ uri: attachmentUri }} style={styles.fsImage} resizeMode="contain" />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorText: { marginTop: 12, fontSize: 15, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 14, gap: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileSub: { fontSize: 13, marginTop: 3 },
  countPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
  countPillText: { fontSize: 14, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  infoCell: { flex: 1, padding: 14 },
  infoDivider: { width: 1, marginVertical: 10 },
  infoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 },
  infoValue: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  block: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  blockLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  reasonText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  previewBox: { width: SCREEN_W * 0.42, height: 90, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  previewImage: { width: '100%', height: '100%' },
  pdfPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937', gap: 6 },
  previewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  previewOverlayText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  remarkChip: { borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  remarkChipRole: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  remarkChipText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  participantsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 12, paddingVertical: 16, borderRadius: 16, gap: 8 },
  participantsBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  countBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  footer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 10 : 16, borderTopWidth: 1 },
  remarkInput: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, textAlignVertical: 'top', marginBottom: 12, minHeight: 72, maxHeight: 100 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  processingBox: { borderRadius: 16, padding: 28, alignItems: 'center', gap: 14, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  processingText: { fontSize: 15, fontWeight: '600' },
  fsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  fsCloseBtn: { position: 'absolute', top: 52, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  fsImage: { width: '95%', height: '80%', borderRadius: 12 },
});

export default BulkDetailsModal;
