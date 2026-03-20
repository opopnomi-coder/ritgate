import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { Staff } from '../../types';
import { THEME } from '../../config/api.config';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface HRApprovalScreenProps {
  user: Staff;
  request: any;
  onBack: () => void;
}

const HRApprovalScreen: React.FC<HRApprovalScreenProps> = ({ user, request, onBack }) => {

  const [loading, setLoading] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewAttachmentUri, setPreviewAttachmentUri] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackTitle, setFeedbackTitle] = useState('');

  const handleApprove = async () => {
    setLoading(true);
    try {
      const result = await apiService.approveRequestAsHR(request.id, user.staffCode);
      if (result.success) {
        setFeedbackTitle('Approved');
        setFeedbackMessage('Gate pass request approved successfully.');
        setShowSuccessModal(true);
      } else {
        setFeedbackTitle('Error');
        setFeedbackMessage(result.message || 'Failed to approve request.');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setFeedbackTitle('Error');
      setFeedbackMessage(error.message || 'Failed to approve request.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setFeedbackTitle('Reason Required');
      setFeedbackMessage('Please provide a reason for rejection.');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    setRejectModalVisible(false);

    try {
      const result = await apiService.rejectRequestAsHR(
        request.id,
        user.staffCode,
        rejectReason.trim()
      );
      if (result.success) {
        setFeedbackTitle('Rejected');
        setFeedbackMessage('Gate pass request has been rejected.');
        setShowSuccessModal(true);
      } else {
        setFeedbackTitle('Error');
        setFeedbackMessage(result.message || 'Failed to reject request.');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setFeedbackTitle('Error');
      setFeedbackMessage(error.message || 'Failed to reject request.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
      setRejectReason('');
    }
  };

  if (!request) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Request not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Request Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color="#F59E0B" />
            <Text style={styles.cardTitle}>Request Information</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Request ID:</Text>
            <Text style={styles.infoValue}>#{request.id}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purpose:</Text>
            <Text style={styles.infoValue}>{request.purpose}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reason:</Text>
            <Text style={styles.infoValue}>{request.reason}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Exit Schedule:</Text>
            <Text style={styles.infoValue}>
              {new Date(request.requestDate).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* HOD Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={24} color="#3B82F6" />
            <Text style={styles.cardTitle}>HOD Information</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>HOD Code:</Text>
            <Text style={styles.infoValue}>{request.regNo}</Text>
          </View>

          {request.studentName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{request.studentName}</Text>
            </View>
          )}

          {request.department && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Department:</Text>
              <Text style={styles.infoValue}>{request.department}</Text>
            </View>
          )}
        </View>

        {/* Attachment Section */}
        {request.attachmentUri && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="attach-outline" size={24} color="#6B7280" />
              <Text style={styles.cardTitle}>Attachment</Text>
            </View>
            <TouchableOpacity 
              style={styles.vAttachmentCard}
              onPress={() => {
                setPreviewAttachmentUri(request.attachmentUri);
                setShowAttachmentPreview(true);
              }}
            >
              <Image
                source={{ uri: request.attachmentUri }}
                style={styles.vAttachmentImage}
                resizeMode="cover"
              />
              <View style={styles.vPreviewButton}>
                <Ionicons name="expand-outline" size={20} color="#1F2937" />
                <Text style={styles.vPreviewText}>Preview Attachment</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        {request.status === 'PENDING_HR' && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Approve Request</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => setRejectModalVisible(true)}
              disabled={loading}
            >
              <Ionicons name="close-circle" size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>Reject Request</Text>
            </TouchableOpacity>
          </View>
        )}

        {request.status !== 'PENDING_HR' && (
          <View style={styles.statusCard}>
            <Ionicons
              name={request.status === 'APPROVED' ? 'checkmark-circle' : 'close-circle'}
              size={48}
              color={request.status === 'APPROVED' ? '#10B981' : '#EF4444'}
            />
            <Text style={styles.statusText}>
              This request has been {request.status.toLowerCase()}
            </Text>
          </View>
        )}
      </ScrollView>

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

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Request</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Ionicons name="close" size={24} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Reason for Rejection *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Provide a detailed reason for rejection..."
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{rejectReason.length}/500</Text>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleReject}
                disabled={!rejectReason.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirm Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title={feedbackTitle}
        message={feedbackMessage}
        onClose={() => {
          setShowSuccessModal(false);
          onBack();
        }}
        autoClose={false}
      />

      <ErrorModal
        visible={showErrorModal}
        type="api"
        title={feedbackTitle}
        message={feedbackMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: THEME.colors.text,
    fontWeight: '500',
  },
  actionContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 120,
  },
  charCount: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  vAttachmentCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    height: 300,
    position: 'relative',
    marginTop: 8,
  },
  vAttachmentImage: {
    width: '100%',
    height: '100%',
  },
  vPreviewButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -25 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    width: 200,
    justifyContent: 'center',
  },
  vPreviewText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  attachmentPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentPreviewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  attachmentPreviewImage: {
    width: '90%',
    height: '80%',
  },
});

export default HRApprovalScreen;
