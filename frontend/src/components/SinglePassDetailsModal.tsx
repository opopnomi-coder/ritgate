import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image,
  TextInput, StatusBar, Platform, Dimensions, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Keyboard, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { formatDateTime } from '../utils/dateUtils';

const { width: SCREEN_W } = Dimensions.get('window');

interface TimelineStep {
  label: string;
  status: 'done' | 'rejected' | 'pending';
  remark?: string;
}

interface SinglePassDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  request: any;
  onApprove?: (id: number, remark: string) => void;
  onReject?: (id: number, remark: string) => void;
  showActions?: boolean;
  viewerRole?: 'staff' | 'hod' | 'hr' | 'student';
  processing?: boolean;
  /** Called when user taps "View QR Code" in read-only mode */
  onViewQR?: (request: any) => void;
  /** Timeline steps for read-only my-requests view */
  timelineSteps?: TimelineStep[];
}

const SinglePassDetailsModal: React.FC<SinglePassDetailsModalProps> = ({
  visible, onClose, request, onApprove, onReject,
  showActions = false, viewerRole = 'hr', processing = false,
  onViewQR, timelineSteps,
}) => {
  const { theme, isDark } = useTheme();
  const [remark, setRemark] = useState('');
  const [showFullscreen, setShowFullscreen] = useState(false);

  useEffect(() => { if (visible) setRemark(''); }, [visible, request?.id]);

  if (!request) return null;

  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    return formatDateTime(d);
  };

  const getInitials = (name: string) =>
    (name || 'ST').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const getStatusColor = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'APPROVED': return theme.success;
      case 'REJECTED': return theme.error;
      default: return theme.warning;
    }
  };

  const statusColor = getStatusColor(request.status || request.hrApproval);
  const statusLabel = (request.hrApproval || request.status || 'PENDING').toUpperCase();
  const showStaffRemark = (viewerRole === 'hod' || viewerRole === 'hr') && !!request.staffRemark;
  const showHodRemark = viewerRole === 'hr' && !!request.hodRemark;
  const hasAnyRemark = showStaffRemark || showHodRemark;

  const isReadOnly = !showActions;
  const isApproved = request.status === 'APPROVED';
  const attachmentUri: string | undefined = request?.attachmentUri || request?.attachmentUrl || request?.fileUrl;
  const attachmentName: string = String(request?.attachmentName || request?.fileName || '');
  const attachmentMime: string = String(request?.attachmentMimeType || request?.mimeType || '').toLowerCase();
  const isPdfAttachment =
    attachmentMime.includes('pdf') ||
    attachmentName.toLowerCase().endsWith('.pdf') ||
    String(attachmentUri || '').toLowerCase().includes('.pdf');

  const handleOpenAttachment = async () => {
    if (!attachmentUri) return;
    if (isPdfAttachment) {
      const canOpen = await Linking.canOpenURL(attachmentUri);
      if (canOpen) await Linking.openURL(attachmentUri);
      return;
    }
    setShowFullscreen(true);
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {isReadOnly ? 'Request Details' : 'Pass Verification'}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Profile Row */}
          <View style={[styles.profileRow, { backgroundColor: theme.surface }]}>
            <View style={[styles.avatar, { backgroundColor: statusColor }]}>
              <Text style={styles.avatarText}>{getInitials(request.studentName || request.staffName || request.regNo || 'ST')}</Text>
            </View>
            <View style={styles.profileInfo}>
              {request.requestType === 'VISITOR' && (
                <View style={[styles.visitorBadge, { backgroundColor: theme.primary + '22' }]}>
                  <Text style={[styles.visitorBadgeText, { color: theme.primary }]}>VISITOR</Text>
                </View>
              )}
              <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
                {request.studentName || request.staffName || request.regNo}
              </Text>
              <Text style={[styles.profileSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {request.regNo || request.staffCode} • {request.department || 'N/A'}
              </Text>
            </View>
          </View>

          {/* Info Grid */}
          <View style={[styles.infoGrid, { backgroundColor: theme.surface }]}>
            <View style={styles.infoCell}>
              <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>
                {request.requestType === 'VISITOR' ? 'PURPOSE OF VISIT' : 'PURPOSE'}
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>{request.purpose || 'General'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoCell}>
              <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>
                {request.requestType === 'VISITOR' ? 'ENTRY DATE' : 'DATE'}
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                {formatDate(request.visitDate || request.exitDateTime || request.requestDate)}
              </Text>
            </View>
          </View>

          {/* Reason — hidden for visitor requests */}
          {request.requestType !== 'VISITOR' && (
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>REASON</Text>
              <Text style={[styles.reasonText, { color: theme.textSecondary }]}>
                {request.reason || 'No reason provided.'}
              </Text>
            </View>
          )}

          {/* Attachment — only shown when present */}
          {!!attachmentUri && (
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>PREVIEW</Text>
              <TouchableOpacity style={styles.previewBox} onPress={handleOpenAttachment} activeOpacity={0.85}>
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

          {/* Remarks (for reviewer roles) */}
          {hasAnyRemark && (
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>REMARKS</Text>
              {showStaffRemark && (
                <View style={[styles.remarkChip, { backgroundColor: theme.warning + '15', borderLeftColor: theme.warning }]}>
                  <Text style={[styles.remarkChipRole, { color: theme.warning }]}>Staff</Text>
                  <Text style={[styles.remarkChipText, { color: theme.text }]} numberOfLines={3}>{request.staffRemark}</Text>
                </View>
              )}
              {showHodRemark && (
                <View style={[styles.remarkChip, showStaffRemark && { marginTop: 8 }, { backgroundColor: theme.primary + '15', borderLeftColor: theme.primary }]}>
                  <Text style={[styles.remarkChipRole, { color: theme.primary }]}>HOD</Text>
                  <Text style={[styles.remarkChipText, { color: theme.text }]} numberOfLines={3}>{request.hodRemark}</Text>
                </View>
              )}
            </View>
          )}

          {/* Timeline (read-only my-requests view) */}
          {isReadOnly && timelineSteps && timelineSteps.length > 0 && (
            <View style={[styles.block, { backgroundColor: theme.surface }]}>
              <Text style={[styles.blockLabel, { color: theme.textTertiary }]}>APPROVAL TIMELINE</Text>
              {timelineSteps.map((step, idx) => {
                const dotColor = step.status === 'done' ? theme.success
                  : step.status === 'rejected' ? theme.error
                  : theme.inputBackground;
                const dotBorder = step.status === 'pending' ? 2 : 0;
                const statusText = step.status === 'done' ? '✓ Completed'
                  : step.status === 'rejected' ? '✗ Rejected'
                  : 'Pending';
                const statusTxtColor = step.status === 'done' ? theme.success
                  : step.status === 'rejected' ? theme.error
                  : theme.textSecondary;
                return (
                  <View key={idx}>
                    <View style={styles.tlItem}>
                      <View style={[styles.tlDot, { backgroundColor: dotColor, borderWidth: dotBorder, borderColor: theme.border }]}>
                        {step.status === 'done' && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        {step.status === 'rejected' && <Ionicons name="close" size={14} color="#FFF" />}
                        {step.status === 'pending' && <View style={[styles.tlDotInner, { backgroundColor: theme.textTertiary }]} />}
                      </View>
                      <View style={styles.tlBody}>
                        <Text style={[styles.tlTitle, { color: theme.text }]}>{step.label}</Text>
                        <Text style={[styles.tlStatus, { color: statusTxtColor }]}>{statusText}</Text>
                        {step.remark ? (
                          <View style={[styles.tlRemark, { backgroundColor: theme.background, borderLeftColor: theme.warning }]}>
                            <Text style={[styles.tlRemarkLabel, { color: theme.textSecondary }]}>Remark:</Text>
                            <Text style={[styles.tlRemarkText, { color: theme.text }]}>{step.remark}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {idx < timelineSteps.length - 1 && (
                      <View style={[styles.tlConnector, { backgroundColor: step.status === 'done' ? theme.success : theme.border }]} />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Footer */}
        {showActions ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.remarkInput, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
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
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.error }, processing && { opacity: 0.5 }]} onPress={() => { Keyboard.dismiss(); onReject(request.id, remark); }} disabled={processing}>
                    <Ionicons name="close-circle" size={20} color="#FFF" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                )}
                {onApprove && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.success }, processing && { opacity: 0.5 }]} onPress={() => { Keyboard.dismiss(); onApprove(request.id, remark); }} disabled={processing}>
                    {processing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
                    <Text style={styles.actionBtnText}>{processing ? 'Processing...' : 'Approve'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {isApproved && onViewQR ? (
              <TouchableOpacity style={[styles.qrBtn, { backgroundColor: theme.success }]} onPress={() => { onClose(); onViewQR(request); }}>
                <Ionicons name="qr-code" size={20} color="#FFF" />
                <Text style={styles.actionBtnText}>View QR Code</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.primary }]} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Fullscreen */}
      <Modal visible={showFullscreen} animationType="fade" transparent={true} onRequestClose={() => !processing && setShowFullscreen(false)}>
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity style={styles.fullscreenCloseBtn} onPress={() => !processing && setShowFullscreen(false)} disabled={processing}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {attachmentUri && !isPdfAttachment && <Image source={{ uri: attachmentUri }} style={styles.fullscreenImage} resizeMode="contain" />}
        </View>
      </Modal>
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
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 14, gap: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  visitorBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, alignSelf: 'flex-start', marginBottom: 3 },
  visitorBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileSub: { fontSize: 13, marginTop: 3 },
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
  noPreview: { width: SCREEN_W * 0.42, height: 90, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  noPreviewText: { fontSize: 11, fontWeight: '500' },
  remarkChip: { borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  remarkChipRole: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  remarkChipText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  // Timeline
  tlItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tlDot: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  tlDotInner: { width: 10, height: 10, borderRadius: 5 },
  tlBody: { flex: 1, paddingTop: 4, paddingBottom: 4 },
  tlTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  tlStatus: { fontSize: 13 },
  tlConnector: { width: 2, height: 22, marginLeft: 16, marginVertical: 2 },
  tlRemark: { marginTop: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3 },
  tlRemarkLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  tlRemarkText: { fontSize: 13, lineHeight: 18 },
  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 10 : 16, borderTopWidth: 1 },
  remarkInput: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, textAlignVertical: 'top', marginBottom: 12, minHeight: 72, maxHeight: 100 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
  actionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  qrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
  closeBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  closeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseBtn: { position: 'absolute', top: 52, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  fullscreenImage: { width: '95%', height: '80%', borderRadius: 12 },
});

export default SinglePassDetailsModal;
