import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Staff } from '../../types';
import { apiService } from '../../services/api';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';
import { formatDateGB, formatTime } from '../../utils/dateUtils';

interface ModernBulkGatePassScreenProps {
  user: Staff;
  navigation?: any;
  onBack?: () => void;
}

interface Student {
  id: number;
  regNo: string;
  fullName: string;
  department: string;
  section?: string;
  year?: string;
}

const ModernBulkGatePassScreen: React.FC<ModernBulkGatePassScreenProps> = ({ user, navigation, onBack }) => {
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [requestDateTime] = useState(new Date());
  const [includeStaff, setIncludeStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [attachment, setAttachment] = useState<{ name: string; base64Uri: string } | null>(null);
  // Track which sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const handleGoBack = () => {
    if (navigation?.goBack) navigation.goBack();
    else if (onBack) onBack();
  };

  useEffect(() => { loadStudents(); }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getStudentsByStaffDepartment(user.staffCode);
      if (response.success && response.students) {
        setAvailableStudents(response.students);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      setErrorMessage('Failed to load students');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Group students by section (fall back to year, then "General")
  const getSectionKey = (s: Student) => {
    const sec = s.section?.trim();
    const yr = s.year?.trim();
    if (sec && sec !== '') return sec;
    if (yr && yr !== '') return yr;
    return 'General';
  };

  const getGroupedStudents = (): { key: string; students: Student[] }[] => {
    const filtered = getFilteredStudents();
    const map = new Map<string, Student[]>();
    for (const s of filtered) {
      const key = getSectionKey(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Sort sections alphabetically
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, students]) => ({ key, students }));
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleStudentSelection = (regNo: string) => {
    const next = new Set(selectedStudents);
    if (next.has(regNo)) {
      next.delete(regNo);
      if (receiverId === regNo) setReceiverId(null);
    } else {
      next.add(regNo);
    }
    setSelectedStudents(next);
  };

  const toggleSectionSelection = (students: Student[]) => {
    const regNos = students.map(s => s.regNo);
    const allSelected = regNos.every(r => selectedStudents.has(r));
    const next = new Set(selectedStudents);
    if (allSelected) {
      regNos.forEach(r => {
        next.delete(r);
        if (receiverId === r) setReceiverId(null);
      });
    } else {
      regNos.forEach(r => next.add(r));
    }
    setSelectedStudents(next);
  };

  const selectAllStudents = () => {
    const filtered = getFilteredStudents();
    if (selectedStudents.size === filtered.length) {
      setSelectedStudents(new Set());
      setReceiverId(null);
    } else {
      setSelectedStudents(new Set(filtered.map(s => s.regNo)));
    }
  };

  const getFilteredStudents = () => {
    if (!searchQuery.trim()) return availableStudents;
    const q = searchQuery.toLowerCase();
    return availableStudents.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.regNo.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q)
    );
  };

  const pickAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      setAttachment({ name: asset.fileName || 'attachment.jpg', base64Uri: `data:${mimeType};base64,${asset.base64}` });
    }
  };

  const handleSubmit = async () => {
    if (!purpose.trim()) { setErrorMessage('Please enter a purpose'); setShowErrorModal(true); return; }
    if (!reason.trim()) { setErrorMessage('Please describe the reason'); setShowErrorModal(true); return; }
    if (selectedStudents.size === 0) { setErrorMessage('Please select at least one student'); setShowErrorModal(true); return; }
    if (!includeStaff && !receiverId) { setErrorMessage('Please select a receiver (student who will hold the QR code)'); setShowErrorModal(true); return; }

    setIsSubmitting(true);
    try {
      const response = await apiService.createBulkGatePass({
        staffCode: user.staffCode,
        purpose: purpose.trim(),
        reason: reason.trim(),
        exitDateTime: new Date().toISOString(),
        returnDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        students: Array.from(selectedStudents),
        includeStaff,
        receiverId: includeStaff ? undefined : (receiverId || undefined),
        attachmentUri: attachment?.base64Uri,
      } as any);
      if (response.success) {
        setShowSuccessModal(true);
      } else {
        setErrorMessage(response.message || 'Failed to submit bulk gate pass');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groups = getGroupedStudents();
  const filteredCount = getFilteredStudents().length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulk Gate Pass</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3B82F6" />
        <Text style={styles.infoBannerText}>Create a gate pass for multiple students at once</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Include Staff toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => { setIncludeStaff(v => { if (!v) setReceiverId(null); return !v; }); }}
            disabled={isSubmitting}
          >
            <Ionicons name={includeStaff ? 'checkbox' : 'square-outline'} size={24} color="#8B5CF6" />
            <View style={styles.checkboxContent}>
              <Text style={styles.checkboxLabel}>Include Staff in this Pass</Text>
              <Text style={styles.checkboxSubtext}>
                {includeStaff
                  ? 'Staff will hold the QR code for the group'
                  : 'One student will be selected as receiver to hold the QR code'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Student Selection — grouped by section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Selected: {selectedStudents.size} / {availableStudents.length}
            </Text>
            <TouchableOpacity onPress={selectAllStudents} style={styles.selectAllButton}>
              <Text style={styles.selectAllText}>
                {selectedStudents.size === filteredCount && filteredCount > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          ) : groups.length === 0 ? (
            <Text style={styles.emptyText}>No students found</Text>
          ) : (
            groups.map(({ key, students }) => {
              const isCollapsed = collapsedSections.has(key);
              const sectionSelected = students.filter(s => selectedStudents.has(s.regNo)).length;
              const allSectionSelected = sectionSelected === students.length;
              const someSectionSelected = sectionSelected > 0 && !allSectionSelected;

              return (
                <View key={key} style={styles.sectionGroup}>
                  {/* Section header row */}
                  <View style={styles.sectionGroupHeader}>
                    {/* Checkbox for whole section */}
                    <TouchableOpacity
                      onPress={() => toggleSectionSelection(students)}
                      style={styles.sectionCheckbox}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={allSectionSelected ? 'checkbox' : someSectionSelected ? 'checkbox-outline' : 'square-outline'}
                        size={22}
                        color={allSectionSelected || someSectionSelected ? '#8B5CF6' : '#9CA3AF'}
                      />
                    </TouchableOpacity>

                    {/* Section label — tap to collapse */}
                    <TouchableOpacity style={styles.sectionGroupLabelRow} onPress={() => toggleSection(key)}>
                      <View style={styles.sectionGroupLabelInner}>
                        <Text style={styles.sectionGroupLabel}>Section {key}</Text>
                        <View style={styles.sectionCountBadge}>
                          <Text style={styles.sectionCountText}>
                            {sectionSelected}/{students.length}
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Students in section */}
                  {!isCollapsed && (
                    <View style={styles.studentList}>
                      {students.map(student => {
                        const isSelected = selectedStudents.has(student.regNo);
                        return (
                          <TouchableOpacity
                            key={student.regNo}
                            style={[styles.studentItem, isSelected && styles.studentItemSelected]}
                            onPress={() => toggleStudentSelection(student.regNo)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={isSelected ? '#8B5CF6' : '#9CA3AF'}
                            />
                            <View style={styles.studentInfo}>
                              <Text style={[styles.studentName, isSelected && styles.studentNameSelected]}>
                                {student.fullName}
                              </Text>
                              <Text style={styles.studentDetails}>{student.regNo}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Receiver Selection — only when staff NOT included */}
        {!includeStaff && selectedStudents.size > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Receiver (QR Code Holder)</Text>
            <View style={styles.receiverInfo}>
              <Ionicons name="information-circle" size={16} color="#8B5CF6" />
              <Text style={styles.receiverInfoText}>
                The receiver will hold the QR code for the entire group
              </Text>
            </View>
            <View style={styles.receiverList}>
              {Array.from(selectedStudents).map(regNo => {
                const student = availableStudents.find(s => s.regNo === regNo);
                if (!student) return null;
                const isRcv = receiverId === regNo;
                return (
                  <TouchableOpacity
                    key={regNo}
                    style={[styles.receiverItem, isRcv && styles.receiverItemActive]}
                    onPress={() => setReceiverId(regNo)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isRcv ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={isRcv ? '#8B5CF6' : '#9CA3AF'}
                    />
                    <View style={styles.receiverStudentInfo}>
                      <View style={styles.receiverNameRow}>
                        <Text style={[styles.receiverStudentName, isRcv && styles.receiverStudentNameActive]}>
                          {student.fullName}
                        </Text>
                        {isRcv && (
                          <View style={styles.receiverActiveBadge}>
                            <Ionicons name="qr-code" size={12} color="#FFF" />
                            <Text style={styles.receiverActiveBadgeText}>RECEIVER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.receiverStudentDetails}>
                        {student.regNo} • {getSectionKey(student)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Gate Pass Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gate Pass Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>REQUEST DATE & TIME</Text>
            <View style={styles.requestDateTimeRow}>
              <View style={styles.requestDateTimeBox}>
                <Ionicons name="calendar-outline" size={18} color="#4B5563" />
                <Text style={styles.requestDateTimeText}>
                  {formatDateGB(requestDateTime)}
                </Text>
              </View>
              <View style={styles.requestDateTimeBox}>
                <Ionicons name="time-outline" size={18} color="#4B5563" />
                <Text style={styles.requestDateTimeText}>
                  {formatTime(requestDateTime)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Purpose *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter purpose for gate pass"
              placeholderTextColor="#9CA3AF"
              value={purpose}
              onChangeText={setPurpose}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Reason *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the reason for gate pass..."
              placeholderTextColor="#9CA3AF"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Attachment (Optional)</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={pickAttachment}>
              <Ionicons name="attach-outline" size={24} color="#9CA3AF" />
              <Text style={styles.uploadText}>
                {attachment ? attachment.name : 'Tap to upload image'}
              </Text>
              {attachment && (
                <TouchableOpacity onPress={() => setAttachment(null)}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {attachment && (
              <Image source={{ uri: attachment.base64Uri }} style={styles.attachmentPreview} resizeMode="cover" />
            )}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || selectedStudents.size === 0) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || selectedStudents.size === 0}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>
                Submit for {selectedStudents.size} Student{selectedStudents.size !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <SuccessModal
        visible={showSuccessModal}
        title="Bulk Pass Submitted"
        message={`Gate pass request submitted for ${selectedStudents.size} student${selectedStudents.size !== 1 ? 's' : ''}. Awaiting HOD approval.`}
        onClose={() => { setShowSuccessModal(false); handleGoBack(); }}
        autoClose={true}
        autoCloseDelay={2500}
      />
      <ErrorModal
        visible={showErrorModal}
        type="api"
        title="Submission Failed"
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
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  infoBannerText: { flex: 1, fontSize: 14, color: '#1E40AF' },
  content: { flex: 1 },
  section: { backgroundColor: '#FFFFFF', marginTop: 12, paddingHorizontal: 20, paddingVertical: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  selectAllButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 6 },
  selectAllText: { fontSize: 14, fontWeight: '600', color: '#8B5CF6' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, gap: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1F2937' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 24 },
  // Section group
  sectionGroup: { marginBottom: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  sectionGroupHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  sectionCheckbox: { width: 28, alignItems: 'center' },
  sectionGroupLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionGroupLabelInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionGroupLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  sectionCountBadge: { backgroundColor: '#8B5CF6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionCountText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  // Student items
  studentList: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  studentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, gap: 10 },
  studentItemSelected: { backgroundColor: '#EDE9FE' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  studentNameSelected: { color: '#6B21A8' },
  studentDetails: { fontSize: 12, color: '#6B7280' },
  // Receiver
  receiverInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  receiverInfoText: { flex: 1, fontSize: 13, color: '#6B21A8', fontWeight: '600' },
  receiverList: { gap: 10 },
  receiverItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, gap: 12, borderWidth: 2, borderColor: 'transparent' },
  receiverItemActive: { backgroundColor: '#EDE9FE', borderColor: '#8B5CF6' },
  receiverStudentInfo: { flex: 1 },
  receiverNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  receiverStudentName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  receiverStudentNameActive: { color: '#6B21A8' },
  receiverActiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 },
  receiverActiveBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  receiverStudentDetails: { fontSize: 13, color: '#6B7280' },
  // Form
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#1F2937' },
  textArea: { height: 100, paddingTop: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, gap: 12, marginBottom: 20 },
  checkboxContent: { flex: 1 },
  checkboxLabel: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  checkboxSubtext: { fontSize: 13, color: '#6B7280' },
  requestDateTimeRow: { flexDirection: 'row', gap: 12 },
  requestDateTimeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  requestDateTimeText: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  uploadText: { flex: 1, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  attachmentPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 10 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', marginHorizontal: 20, marginTop: 20, paddingVertical: 16, borderRadius: 12, gap: 8, elevation: 3 },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default ModernBulkGatePassScreen;
