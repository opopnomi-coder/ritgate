import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { HOD } from '../../types';
import { apiService } from '../../services/api';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';

interface HODBulkGatePassScreenProps {
  user: HOD;
  navigation?: any;
  onBack?: () => void;
}

interface Student {
  id: number;
  regNo: string;
  fullName: string;
  department: string;
  year: string;
  section: string;
}

interface StaffMember {
  id: number;
  staffCode: string;
  fullName: string;
  department: string;
}

type ViewMode = 'students' | 'staff';

// Simple dropdown component
const Dropdown = ({ label, value, options, onSelect, placeholder }: {
  label: string; value: string; options: string[];
  onSelect: (v: string) => void; placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={dd.wrap}>
      <Text style={dd.label}>{label}</Text>
      <TouchableOpacity style={dd.btn} onPress={() => setOpen(true)}>
        <Text style={[dd.btnText, !value && dd.placeholder]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <Text style={dd.sheetTitle}>{label}</Text>
            <ScrollView>
              <TouchableOpacity style={dd.option} onPress={() => { onSelect(''); setOpen(false); }}>
                <Text style={dd.optionText}>All</Text>
              </TouchableOpacity>
              {options.map(o => (
                <TouchableOpacity key={o} style={[dd.option, value === o && dd.optionActive]}
                  onPress={() => { onSelect(o); setOpen(false); }}>
                  <Text style={[dd.optionText, value === o && dd.optionTextActive]}>{o}</Text>
                  {value === o && <Ionicons name="checkmark" size={18} color="#F59E0B" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const HODBulkGatePassScreen: React.FC<HODBulkGatePassScreenProps> = ({ user, navigation, onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('students');
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [includeHOD, setIncludeHOD] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [attachment, setAttachment] = useState<{ name: string; base64Uri: string } | null>(null);

  // All data
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  // Selection
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [receiverType, setReceiverType] = useState<'student' | 'staff' | null>(null);

  const handleGoBack = () => navigation?.goBack ? navigation.goBack() : onBack?.();

  useEffect(() => { loadParticipants(); }, []);

  const loadParticipants = async () => {
    setIsLoading(true);
    try {
      const [sr, stR] = await Promise.all([
        apiService.getHODDepartmentStudents(user.hodCode),
        apiService.getHODDepartmentStaff(user.hodCode),
      ]);
      if (sr.success) setAllStudents(sr.students || []);
      if (stR.success) setAllStaff(stR.staff || []);
    } catch (e) {
      console.error('Error loading participants:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Derive filter options from data
  const yearOptions = useMemo(() =>
    [...new Set(allStudents.map(s => s.year).filter(Boolean))].sort(), [allStudents]);

  const deptOptions = useMemo(() => {
    let src = allStudents;
    if (filterYear) src = src.filter(s => s.year === filterYear);
    return [...new Set(src.map(s => s.department).filter(Boolean))].sort();
  }, [allStudents, filterYear]);

  const sectionOptions = useMemo(() => {
    let src = allStudents;
    if (filterYear) src = src.filter(s => s.year === filterYear);
    if (filterDept) src = src.filter(s => s.department === filterDept);
    return [...new Set(src.map(s => s.section).filter(Boolean))].sort();
  }, [allStudents, filterYear, filterDept]);

  // Reset downstream filters when upstream changes
  const handleYearChange = (v: string) => { setFilterYear(v); setFilterDept(''); setFilterSection(''); };
  const handleDeptChange = (v: string) => { setFilterDept(v); setFilterSection(''); };

  const filteredStudents = useMemo(() => {
    let s = allStudents;
    if (filterYear) s = s.filter(x => x.year === filterYear);
    if (filterDept) s = s.filter(x => x.department === filterDept);
    if (filterSection) s = s.filter(x => x.section === filterSection);
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      s = s.filter(x => x.fullName.toLowerCase().includes(q) || x.regNo.toLowerCase().includes(q));
    }
    return s;
  }, [allStudents, filterYear, filterDept, filterSection, studentSearch]);

  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return allStaff;
    const q = staffSearch.toLowerCase();
    return allStaff.filter(s => s.fullName.toLowerCase().includes(q) || s.staffCode.toLowerCase().includes(q));
  }, [allStaff, staffSearch]);

  const toggleStudent = (regNo: string) => {
    const s = new Set(selectedStudents);
    if (s.has(regNo)) { s.delete(regNo); if (receiverId === regNo) { setReceiverId(null); setReceiverType(null); } }
    else s.add(regNo);
    setSelectedStudents(s);
  };

  const toggleStaff = (code: string) => {
    const s = new Set(selectedStaff);
    if (s.has(code)) { s.delete(code); if (receiverId === code) { setReceiverId(null); setReceiverType(null); } }
    else s.add(code);
    setSelectedStaff(s);
  };

  const selectAll = () => {
    if (viewMode === 'students') {
      if (selectedStudents.size === filteredStudents.length && filteredStudents.length > 0) {
        setSelectedStudents(new Set());
      } else {
        setSelectedStudents(new Set(filteredStudents.map(s => s.regNo)));
      }
    } else {
      if (selectedStaff.size === filteredStaff.length && filteredStaff.length > 0) {
        setSelectedStaff(new Set());
      } else {
        setSelectedStaff(new Set(filteredStaff.map(s => s.staffCode)));
      }
    }
  };

  const totalSelected = selectedStudents.size + selectedStaff.size;

  const pickAttachment = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7 });
    if (!r.canceled && r.assets?.[0]) {
      const a = r.assets[0];
      setAttachment({ name: a.fileName || 'attachment.jpg', base64Uri: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` });
    }
  };

  const handleSubmit = async () => {
    if (!purpose.trim()) { setErrorMessage('Please enter a purpose'); setShowErrorModal(true); return; }
    if (!reason.trim()) { setErrorMessage('Please enter a reason'); setShowErrorModal(true); return; }
    if (totalSelected === 0) { setErrorMessage('Please select at least one participant'); setShowErrorModal(true); return; }
    if (!includeHOD && !receiverId) { setErrorMessage('Please select a receiver for the QR code'); setShowErrorModal(true); return; }

    setIsSubmitting(true);
    try {
      const participants = [
        ...Array.from(selectedStudents).map(id => ({ id, type: 'student' })),
        ...Array.from(selectedStaff).map(id => ({ id, type: 'staff' })),
      ];
      const response = await apiService.submitBulkGatePass({
        hodCode: user.hodCode,
        purpose: purpose.trim(),
        reason: reason.trim(),
        exitDateTime: new Date().toISOString(),
        returnDateTime: new Date(Date.now() + 86400000).toISOString(),
        participantDetails: participants,
        participants: participants.map(p => p.id),
        includeHOD,
        receiverId: includeHOD ? undefined : (receiverId || undefined),
        attachmentUri: attachment?.base64Uri,
      } as any);
      if (response.success !== false) {
        setShowSuccessModal(true);
      } else {
        setErrorMessage(response.message || 'Failed to submit bulk gate pass');
        setShowErrorModal(true);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'An error occurred');
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleGoBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>HOD Bulk Gate Pass</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.infoBanner}>
        <Ionicons name="information-circle" size={18} color="#3B82F6" />
        <Text style={s.infoBannerText}>Bulk passes — no HR approval required</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={s.card}>
          <View style={s.summaryRow}>
            {[['school', '#3B82F6', 'Students', selectedStudents.size],
              ['briefcase', '#10B981', 'Staff', selectedStaff.size],
              ['people', '#F59E0B', 'Total', totalSelected]].map(([icon, color, lbl, val]) => (
              <View key={lbl as string} style={s.summaryItem}>
                <Ionicons name={icon as any} size={22} color={color as string} />
                <View>
                  <Text style={s.summaryLabel}>{lbl as string}</Text>
                  <Text style={s.summaryVal}>{val as number}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Include HOD toggle */}
        <View style={s.card}>
          <TouchableOpacity style={s.checkRow} onPress={() => { setIncludeHOD(!includeHOD); if (!includeHOD) { setReceiverId(null); setReceiverType(null); } }}>
            <Ionicons name={includeHOD ? 'checkbox' : 'square-outline'} size={24} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={s.checkLabel}>Include HOD in this Pass</Text>
              <Text style={s.checkSub}>{includeHOD ? 'HOD holds the QR code' : 'Select a receiver to hold the QR code'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.card}>
          <View style={s.tabs}>
            {(['students', 'staff'] as ViewMode[]).map(mode => (
              <TouchableOpacity key={mode} style={[s.tab, viewMode === mode && s.tabActive]} onPress={() => setViewMode(mode)}>
                <Ionicons name={mode === 'students' ? 'school' : 'briefcase'} size={18} color={viewMode === mode ? '#FFF' : '#6B7280'} />
                <Text style={[s.tabText, viewMode === mode && s.tabTextActive]}>{mode === 'students' ? 'Students' : 'Staff'}</Text>
                {(mode === 'students' ? selectedStudents.size : selectedStaff.size) > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{mode === 'students' ? selectedStudents.size : selectedStaff.size}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Student view */}
        {viewMode === 'students' && (
          <View style={s.card}>
            {/* Cascading dropdowns */}
            <Dropdown label="Year" value={filterYear} options={yearOptions} onSelect={handleYearChange} placeholder="All Years" />
            <Dropdown label="Department" value={filterDept} options={deptOptions} onSelect={handleDeptChange} placeholder="All Departments" />
            <Dropdown label="Section" value={filterSection} options={sectionOptions} onSelect={setFilterSection} placeholder="All Sections" />

            <View style={s.rowBetween}>
              <Text style={s.countText}>Selected: {selectedStudents.size} / {filteredStudents.length}</Text>
              <TouchableOpacity onPress={selectAll} style={s.selectAllBtn}>
                <Text style={s.selectAllText}>{selectedStudents.size === filteredStudents.length && filteredStudents.length > 0 ? 'Deselect All' : 'Select All'}</Text>
              </TouchableOpacity>
            </View>

            <View style={s.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput style={s.searchInput} placeholder="Search students..." placeholderTextColor="#9CA3AF" value={studentSearch} onChangeText={setStudentSearch} />
            </View>

            {isLoading ? <ActivityIndicator size="large" color="#F59E0B" style={{ marginVertical: 30 }} /> : (
              filteredStudents.length === 0
                ? <View style={s.empty}><Ionicons name="people-outline" size={40} color="#D1D5DB" /><Text style={s.emptyText}>No students found</Text></View>
                : filteredStudents.map(st => (
                  <TouchableOpacity key={st.regNo} style={s.item} onPress={() => toggleStudent(st.regNo)}>
                    <Ionicons name={selectedStudents.has(st.regNo) ? 'checkbox' : 'square-outline'} size={24} color={selectedStudents.has(st.regNo) ? '#F59E0B' : '#9CA3AF'} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{st.fullName}</Text>
                      <Text style={s.itemSub}>{st.regNo} • {st.year} • {st.department} • Sec {st.section}</Text>
                    </View>
                  </TouchableOpacity>
                ))
            )}
          </View>
        )}

        {/* Staff view */}
        {viewMode === 'staff' && (
          <View style={s.card}>
            <View style={s.rowBetween}>
              <Text style={s.countText}>Selected: {selectedStaff.size} / {filteredStaff.length}</Text>
              <TouchableOpacity onPress={selectAll} style={s.selectAllBtn}>
                <Text style={s.selectAllText}>{selectedStaff.size === filteredStaff.length && filteredStaff.length > 0 ? 'Deselect All' : 'Select All'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput style={s.searchInput} placeholder="Search staff..." placeholderTextColor="#9CA3AF" value={staffSearch} onChangeText={setStaffSearch} />
            </View>
            {isLoading ? <ActivityIndicator size="large" color="#F59E0B" style={{ marginVertical: 30 }} /> : (
              filteredStaff.length === 0
                ? <View style={s.empty}><Ionicons name="briefcase-outline" size={40} color="#D1D5DB" /><Text style={s.emptyText}>No staff found</Text></View>
                : filteredStaff.map(st => (
                  <TouchableOpacity key={st.staffCode} style={s.item} onPress={() => toggleStaff(st.staffCode)}>
                    <Ionicons name={selectedStaff.has(st.staffCode) ? 'checkbox' : 'square-outline'} size={24} color={selectedStaff.has(st.staffCode) ? '#F59E0B' : '#9CA3AF'} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{st.fullName}</Text>
                      <Text style={s.itemSub}>{st.staffCode} • {st.department}</Text>
                    </View>
                  </TouchableOpacity>
                ))
            )}
          </View>
        )}

        {/* Receiver selection */}
        {!includeHOD && totalSelected > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Select QR Code Receiver</Text>
            <View style={s.receiverInfo}>
              <Ionicons name="information-circle" size={16} color="#F59E0B" />
              <Text style={s.receiverInfoText}>This person will hold the QR code for the group</Text>
            </View>
            {selectedStudents.size > 0 && <Text style={s.catTitle}>STUDENTS</Text>}
            {Array.from(selectedStudents).map(rn => {
              const st = allStudents.find(x => x.regNo === rn); if (!st) return null;
              const active = receiverId === rn;
              return (
                <TouchableOpacity key={rn} style={[s.receiverItem, active && s.receiverItemActive]} onPress={() => { setReceiverId(rn); setReceiverType('student'); }}>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? '#F59E0B' : '#9CA3AF'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, active && { color: '#92400E' }]}>{st.fullName}</Text>
                    <Text style={s.itemSub}>{st.regNo}</Text>
                  </View>
                  {active && <View style={s.receiverBadge}><Text style={s.receiverBadgeText}>RECEIVER</Text></View>}
                </TouchableOpacity>
              );
            })}
            {selectedStaff.size > 0 && <Text style={s.catTitle}>STAFF</Text>}
            {Array.from(selectedStaff).map(code => {
              const st = allStaff.find(x => x.staffCode === code); if (!st) return null;
              const active = receiverId === code;
              return (
                <TouchableOpacity key={code} style={[s.receiverItem, active && s.receiverItemActive]} onPress={() => { setReceiverId(code); setReceiverType('staff'); }}>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? '#F59E0B' : '#9CA3AF'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, active && { color: '#92400E' }]}>{st.fullName}</Text>
                    <Text style={s.itemSub}>{st.staffCode}</Text>
                  </View>
                  {active && <View style={s.receiverBadge}><Text style={s.receiverBadgeText}>RECEIVER</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Gate pass details */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Gate Pass Details</Text>
          <Text style={s.fieldLabel}>Purpose *</Text>
          <TextInput style={s.input} placeholder="Enter purpose" placeholderTextColor="#9CA3AF" value={purpose} onChangeText={setPurpose} />
          <Text style={s.fieldLabel}>Reason *</Text>
          <TextInput style={[s.input, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Describe the reason..." placeholderTextColor="#9CA3AF" value={reason} onChangeText={setReason} multiline />
          <Text style={s.fieldLabel}>Attachment (Optional)</Text>
          <TouchableOpacity style={s.uploadBtn} onPress={pickAttachment}>
            <Ionicons name="attach-outline" size={22} color="#9CA3AF" />
            <Text style={s.uploadText}>{attachment ? attachment.name : 'Tap to upload image'}</Text>
            {attachment && <TouchableOpacity onPress={() => setAttachment(null)}><Ionicons name="close-circle" size={20} color="#EF4444" /></TouchableOpacity>}
          </TouchableOpacity>
          {attachment && <Image source={{ uri: attachment.base64Uri }} style={s.attachPreview} resizeMode="cover" />}
        </View>

        {/* Submit */}
        <TouchableOpacity style={[s.submitBtn, totalSelected === 0 && s.submitBtnDisabled]} onPress={handleSubmit} disabled={totalSelected === 0 || isSubmitting}>
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={s.submitBtnText}>Submit for {totalSelected} Participant{totalSelected !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <SuccessModal
        visible={showSuccessModal}
        title="Bulk Pass Submitted"
        message={`Gate pass request submitted for ${totalSelected} participant${totalSelected !== 1 ? 's' : ''}. Awaiting HR approval.`}
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

const dd = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  btnText: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  placeholder: { color: '#9CA3AF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: 20 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionActive: { backgroundColor: '#FEF3C7', marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 8 },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextActive: { color: '#F59E0B', fontWeight: '700' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  infoBannerText: { flex: 1, fontSize: 13, color: '#1E40AF' },
  card: { backgroundColor: '#FFF', marginTop: 10, paddingHorizontal: 16, paddingVertical: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  summaryVal: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FEF3C7', padding: 14, borderRadius: 12 },
  checkLabel: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  checkSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  tabActive: { backgroundColor: '#F59E0B' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#FFF' },
  badge: { backgroundColor: '#FFF', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  countText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  selectAllBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 6 },
  selectAllText: { fontSize: 13, fontWeight: '600', color: '#F59E0B' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1F2937' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  itemSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  receiverInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12, gap: 8 },
  receiverInfoText: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' },
  catTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginTop: 10, marginBottom: 6, letterSpacing: 0.5 },
  receiverItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 10, paddingHorizontal: 8, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 6 },
  receiverItemActive: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  receiverBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  receiverBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F2937' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginTop: 4 },
  uploadText: { flex: 1, fontSize: 14, color: '#6B7280' },
  attachPreview: { width: '100%', height: 150, borderRadius: 10, marginTop: 10 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', marginHorizontal: 16, marginTop: 16, paddingVertical: 16, borderRadius: 12, gap: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

export default HODBulkGatePassScreen;
