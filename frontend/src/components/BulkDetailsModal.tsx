import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ParticipantsScreen from '../screens/shared/ParticipantsScreen';
import GatePassQRModal from './GatePassQRModal';

interface BulkDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  requestId: number;
  requesterInfo?: {
    name: string;
    role: string;
    department: string;
  };
  onApprove?: (id: number, remark: string) => void;
  onReject?: (id: number, remark: string) => void;
  showActions?: boolean;
  currentUserId?: string;
  processing?: boolean;
}

const BulkDetailsModal: React.FC<BulkDetailsModalProps> = ({
  visible,
  onClose,
  requestId,
  requesterInfo,
  onApprove,
  onReject,
  showActions = false,
  currentUserId,
  processing = false,
}) => {
  const { theme } = useTheme();
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
          (response.request && response.request.participants) ||
          response.participants ||
          (response.request && response.request.students) ||
          response.students ||
          [];
        setParticipants(incomingParticipants);
        setRequester(response.requester || (response.request && response.request.requester) || requesterInfo);
      } else {
        setError(response.message || 'Failed to load details');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const students = participants.filter(p => p.type === 'student' || !p.type);
  const staffParticipants = participants.filter(p => p.type === 'staff' || p.type === 'hod');

  const isReceiver = (participant: any) => {
    if (!details?.qrOwnerId) return false;
    return String(details.qrOwnerId).trim() === String(participant.id || participant.regNo || participant.staffCode).trim();
  };

  const isApproved = details?.status === 'APPROVED'
    || details?.hrApproval === 'APPROVED'
    || (details?.qrCode != null && details?.qrCode !== '');

  const statusColor = isApproved ? '#10B981' : '#F59E0B';
  const statusLabel = details?.status === 'REJECTED' ? 'REJECTED'
    : isApproved ? 'APPROVED' : 'PENDING';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: theme.surfaceHighlight }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Bulk Pass Details</Text>
            {participants.length > 0 && (
              <Text style={[styles.headerSub, { color: theme.textTertiary }]}>{participants.length} participants</Text>
            )}
          </View>
          {/* status pill */}
          {!loading && !error && (
            <View style={[styles.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {/* ── Body ── */}
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
          <View style={styles.body}>
            {/* Row 1 — Requester card */}
            {requester && (
              <View style={[styles.requesterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {(requester.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.requesterInfo}>
                  <Text style={[styles.requesterName, { color: theme.text }]}>{requester.name || requester.requestedByStaffName}</Text>
                  <Text style={[styles.requesterSub, { color: theme.textSecondary }]}>{requester.role || 'Staff'} · {requester.department}</Text>
                </View>
                {details?.qrOwnerId && (
                  <View style={[styles.receiverPill, { backgroundColor: theme.surfaceHighlight }]}>
                    <Ionicons name="qr-code-outline" size={12} color={theme.primary} />
                    <Text style={[styles.receiverPillText, { color: theme.primary }]}>QR: {details.qrOwnerId}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Row 2 — Info chips */}
            <View style={styles.chipRow}>
              <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.chipLabel, { color: theme.textTertiary }]}>PURPOSE</Text>
                <Text style={[styles.chipValue, { color: theme.text }]} numberOfLines={1}>{details?.purpose || 'N/A'}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.chipLabel, { color: theme.textTertiary }]}>DATE</Text>
                <Text style={[styles.chipValue, { color: theme.text }]} numberOfLines={1}>
                  {new Date(details?.exitDateTime || details?.requestDate || '').toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })}
                </Text>
              </View>
              <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.chipLabel, { color: theme.textTertiary }]}>PARTICIPANTS</Text>
                <Text style={[styles.chipValue, { color: theme.text }]}>{participants.length}</Text>
              </View>
            </View>

            {/* Row 3 — Reason */}
            <View style={[styles.reasonBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.reasonLabel, { color: theme.textTertiary }]}>REASON</Text>
              <Text style={[styles.reasonText, { color: theme.textSecondary }]} numberOfLines={2}>{details?.reason || 'N/A'}</Text>
            </View>

            {/* Row 4 — Attachment + Remarks side by side (only if content exists) */}
            {(details?.attachmentUri || details?.staffRemark || details?.hodRemark) && (
              <View style={styles.midRow}>
                {details?.attachmentUri ? (
                  <TouchableOpacity
                    style={[styles.attachmentThumb, !details?.staffRemark && !details?.hodRemark && { flex: 1 }]}
                    onPress={() => setShowFullscreenAttachment(true)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: details.attachmentUri }} style={styles.thumbImage} resizeMode="cover" />
                    <View style={styles.thumbOverlay}>
                      <Ionicons name="expand-outline" size={16} color="#FFF" />
                      <Text style={styles.thumbText}>PREVIEW</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {(details?.staffRemark || details?.hodRemark) && (
                  <View style={[styles.remarksBox, { backgroundColor: theme.surface, borderColor: theme.border }, !details?.attachmentUri && { flex: 1 }]}>
                    <Text style={[styles.remarksSectionLabel, { color: theme.textTertiary }]}>REMARKS</Text>
                    {details?.staffRemark && (
                      <View style={[styles.remarkItem, { backgroundColor: theme.inputBackground, borderLeftColor: theme.warning }]}>
                        <Text style={[styles.remarkRole, { color: theme.textSecondary }]}>Staff</Text>
                        <Text style={[styles.remarkText, { color: theme.text }]} numberOfLines={2}>{details.staffRemark}</Text>
                      </View>
                    )}
                    {details?.hodRemark && (
                      <View style={[styles.remarkItem, { backgroundColor: theme.inputBackground, borderLeftColor: theme.warning, marginTop: 6 }]}>
                        <Text style={[styles.remarkRole, { color: theme.textSecondary }]}>HOD</Text>
                        <Text style={[styles.remarkText, { color: theme.text }]} numberOfLines={2}>{details.hodRemark}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Row 5 — View Participants button */}
            {participants.length > 0 && (
              <TouchableOpacity style={[styles.participantsBtn, { backgroundColor: theme.primary }]} onPress={() => setShowParticipants(true)}>
                <Ionicons name="people" size={18} color="#FFF" />
                <Text style={styles.participantsBtnText}>View Participants</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{participants.length}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Footer — remark input + action buttons ── */}
        {!loading && !error && showActions && (
          <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.remarkInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Add a remark (optional)..."
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
                  onPress={() => { onClose(); onReject(requestId, remark); }}
                  disabled={processing}
                >
                  <Ionicons name="close-circle" size={18} color="#FFF" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              )}
              {onApprove && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.success }, processing && { opacity: 0.5 }]}
                  onPress={() => { onClose(); onApprove(requestId, remark); }}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  )}
                  <Text style={styles.actionBtnText}>{processing ? 'Processing...' : 'Approve'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Sub-screens ── */}
        <GatePassQRModal
          visible={showQRDetailed}
          onClose={() => setShowQRDetailed(false)}
          personName={requester?.name || details?.requestedByStaffName || 'N/A'}
          personId={String(details?.qrOwnerId || '')}
          qrCodeData={details?.qrCode || details?.qrData?.qrString || null}
          manualCode={details?.manualCode || details?.qrData?.manualEntryCode}
          reason={details?.purpose}
        />

        <Modal
          visible={showParticipants}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowParticipants(false)}
        >
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

        <Modal
          visible={showFullscreenAttachment}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowFullscreenAttachment(false)}
        >
          <View style={styles.fsOverlay}>
            <TouchableOpacity style={styles.fsCloseBtn} onPress={() => setShowFullscreenAttachment(false)}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            {details?.attachmentUri && (
              <Image source={{ uri: details.attachmentUri }} style={styles.fsImage} resizeMode="contain" />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Center states */
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },

  /* Body */
  body: {
    flex: 1,
    padding: 14,
    gap: 10,
  },

  /* Requester card */
  requesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
  },
  requesterInfo: {
    flex: 1,
  },
  requesterName: {
    fontSize: 15,
    fontWeight: '700',
  },
  requesterSub: {
    fontSize: 12,
    marginTop: 2,
  },
  receiverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  receiverPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Chips row */
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  chipValue: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Reason */
  reasonBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  /* Mid row */
  midRow: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    minHeight: 0,
  },
  attachmentThumb: {
    width: 120,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#000',
  },
  thumbImage: {
    width: '100%',
    flex: 1,
  },
  thumbOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  thumbText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  remarksBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  remarksSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  remarkItem: {
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
  },
  remarkRole: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  remarkText: {
    fontSize: 12,
    lineHeight: 16,
  },

  /* Participants button */
  participantsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  participantsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  /* Footer */
  footer: {
    padding: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  remarkInput: {
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    textAlignVertical: 'top',
    maxHeight: 70,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 6,
  },
  rejectBtn: {},
  approveBtn: {},
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Fullscreen attachment */
  fsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fsImage: {
    width: '92%',
    height: '80%',
  },
});

export default BulkDetailsModal;
