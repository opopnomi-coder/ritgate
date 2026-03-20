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
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SecurityPersonnel, ActivePerson, ScreenName } from '../../types';
import { apiService } from '../../services/api';
import SecurityBottomNav from '../../components/SecurityBottomNav';
import { useProfile } from '../../context/ProfileContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationDropdown from '../../components/NotificationDropdown';
import ConfirmationModal from '../../components/ConfirmationModal';

interface NewSecurityDashboardProps {
  user: SecurityPersonnel;
  onLogout: () => void;
  onNavigate: (screen: ScreenName) => void;
}

interface EscalatedVisitor {
  id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  personToMeet: string;
  purpose: string;
  numberOfPeople: number;
  status: string;
  escalatedToSecurity: boolean;
  escalationTime: string;
  notificationSentAt: string;
  createdAt: string;
}

const NewSecurityDashboard: React.FC<NewSecurityDashboardProps> = ({
  user,
  onLogout,
  onNavigate,
}) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activePersons, setActivePersons] = useState<ActivePerson[]>([]);
  const { profileImage } = useProfile();
  const [selectedPerson, setSelectedPerson] = useState<ActivePerson | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { unreadCount, loadNotifications } = useNotifications();
  const [escalatedVisitors, setEscalatedVisitors] = useState<EscalatedVisitor[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<EscalatedVisitor | null>(null);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [stats, setStats] = useState({
    active: 0,
    exited: 0,
    total: 0,
  });

  useEffect(() => {
    loadDashboardData();
    loadEscalatedVisitors();
    loadNotifications(user.securityId, 'security');
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await apiService.getActivePersons();
      if (response.success && response.data) {
        const validPersons = response.data.filter((person: ActivePerson) => 
          person.name && 
          !person.name.startsWith('QR Not Found') && 
          !person.name.includes('Unknown')
        );
        setActivePersons(validPersons);

        // Calculate stats
        const active = validPersons.filter((p: ActivePerson) => p.status === 'PENDING').length;
        const exited = validPersons.filter((p: ActivePerson) => p.status === 'EXITED').length;
        
        setStats({
          active,
          exited,
          total: validPersons.length,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadEscalatedVisitors = async () => {
    try {
      const response = await apiService.getEscalatedVisitors();
      if (response.success && response.data) {
        setEscalatedVisitors(response.data);
      }
    } catch (error) {
      console.error('Error loading escalated visitors:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
    loadEscalatedVisitors();
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'SG';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${formattedHours}:${formattedMinutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  };

  const handleManualExit = async (person: ActivePerson) => {
    Alert.alert(
      'Manual Exit',
      `Mark ${person.name} as exited?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.manualExit(person.id);
              if (response.success) {
                Alert.alert('Success', `${person.name} has been marked as exited`);
                loadDashboardData();
              } else {
                Alert.alert('Error', response.message || 'Failed to mark exit');
              }
            } catch (error) {
              console.error('Manual exit error:', error);
              Alert.alert('Error', 'Failed to process manual exit');
            }
          }
        }
      ]
    );
  };

  const handleApproveVisitor = async (visitor: EscalatedVisitor) => {
    Alert.alert(
      'Approve Visitor',
      `Approve ${visitor.name} to visit ${visitor.personToMeet}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const securityId = user.securityId || user.id?.toString() || 'SEC001';
              const response = await apiService.approveEscalatedVisitor(visitor.id, securityId);
              if (response.success) {
                Alert.alert('Success', 'Visitor approved successfully');
                setShowVisitorModal(false);
                loadEscalatedVisitors();
              } else {
                Alert.alert('Error', response.message || 'Failed to approve visitor');
              }
            } catch (error) {
              console.error('Approve visitor error:', error);
              Alert.alert('Error', 'Failed to approve visitor');
            }
          }
        }
      ]
    );
  };

  const handleRejectVisitor = async (visitor: EscalatedVisitor) => {
    setSelectedVisitor(visitor);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const confirmRejectVisitor = async () => {
    if (!selectedVisitor) return;

    try {
      const response = await apiService.rejectEscalatedVisitor(
        selectedVisitor.id,
        rejectionReason || 'Rejected by security'
      );
      if (response.success) {
        Alert.alert('Success', 'Visitor rejected');
        setShowRejectModal(false);
        setShowVisitorModal(false);
        setRejectionReason('');
        loadEscalatedVisitors();
      } else {
        Alert.alert('Error', response.message || 'Failed to reject visitor');
      }
    } catch (error) {
      console.error('Reject visitor error:', error);
      Alert.alert('Error', 'Failed to reject visitor');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.type === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={[styles.avatar, { backgroundColor: theme.primary }]} onPress={() => onNavigate('PROFILE')}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user.name || user.securityName || 'SG')}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>Good Morning,</Text>
            <Text style={[styles.userName, { color: theme.text }]}>{(user.name || user.securityName || 'SECURITY').toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surfaceHighlight }]} onPress={() => setShowNotificationDropdown(true)}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && <View style={[styles.notificationIndicator, { backgroundColor: theme.error }]} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surfaceHighlight }]} onPress={() => setShowLogoutModal(true)}>
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: theme.success + '22' }]}>
            <Ionicons name="enter-outline" size={20} color={theme.success} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>{stats.active}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: theme.error + '22' }]}>
            <Ionicons name="exit-outline" size={20} color={theme.error} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>{stats.exited}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Exited</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: theme.info + '22' }]}>
            <Ionicons name="people-outline" size={20} color={theme.info} />
          </View>
          <Text style={[styles.statValue, { color: theme.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
        </View>
      </View>

      {/* Visitor Requests Section */}
      {escalatedVisitors.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Visitor Requests</Text>
            <View style={[styles.badge, { backgroundColor: theme.error + '22' }]}>
              <Text style={[styles.badgeText, { color: theme.error }]}>{escalatedVisitors.length}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.visitorRequestsContainer} contentContainerStyle={styles.visitorRequestsContent}>
            {escalatedVisitors.map((visitor) => (
              <TouchableOpacity key={visitor.id} style={[styles.visitorRequestCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} onPress={() => { setSelectedVisitor(visitor); setShowVisitorModal(true); }}>
                <View style={styles.visitorCardHeader}>
                  <View style={[styles.visitorAvatar, { backgroundColor: theme.surfaceHighlight }]}>
                    <Ionicons name="person" size={20} color={theme.warning} />
                  </View>
                  <View style={[styles.urgentBadge, { backgroundColor: theme.error + '22' }]}>
                    <Ionicons name="time" size={12} color={theme.error} />
                    <Text style={[styles.urgentText, { color: theme.error }]}>URGENT</Text>
                  </View>
                </View>
                <Text style={[styles.visitorName, { color: theme.text }]} numberOfLines={1}>{visitor.name}</Text>
                <Text style={[styles.visitorMeet, { color: theme.textSecondary }]} numberOfLines={1}>To meet: {visitor.personToMeet}</Text>
                <Text style={[styles.visitorDept, { color: theme.textTertiary }]} numberOfLines={1}>{visitor.department}</Text>
                <View style={styles.visitorActions}>
                  <TouchableOpacity style={[styles.approveBtn, { backgroundColor: theme.success }]} onPress={(e) => { e.stopPropagation(); handleApproveVisitor(visitor); }}>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: theme.error }]} onPress={(e) => { e.stopPropagation(); handleRejectVisitor(visitor); }}>
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Active Persons List */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Persons</Text>
        <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>{stats.active} active</Text>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.scrollContent}>
        {activePersons.filter(p => p.status === 'PENDING').length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No active persons</Text>
          </View>
        ) : (
          activePersons.filter(p => p.status === 'PENDING').map((person, index) => (
            <TouchableOpacity key={`${person.id}-${index}`} style={[styles.personCard, { backgroundColor: theme.cardBackground }]} onPress={() => { setSelectedPerson(person); setShowDetailModal(true); }}>
              <View style={[styles.personAvatar, { backgroundColor: theme.primary }]}>
                <Text style={styles.personAvatarText}>{getInitials(person.name)}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={[styles.personName, { color: theme.text }]}>{person.name}</Text>
                <Text style={[styles.personType, { color: theme.primary }]}>{person.type}</Text>
                <Text style={[styles.personPurpose, { color: theme.textSecondary }]} numberOfLines={1}>{person.purpose}</Text>
              </View>
              <View style={styles.personRight}>
                <View style={[styles.statusBadge, { backgroundColor: theme.success + '22' }]}>
                  <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                  <Text style={[styles.statusText, { color: theme.success }]}>ACTIVE</Text>
                </View>
                <Text style={[styles.personTime, { color: theme.textTertiary }]}>{formatTime(person.inTime)}</Text>
                <TouchableOpacity style={[styles.exitButton, { backgroundColor: theme.error }]} onPress={(e) => { e.stopPropagation(); handleManualExit(person); }}>
                  <Ionicons name="log-out-outline" size={16} color="#FFF" />
                  <Text style={styles.exitButtonText}>Exit</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <SecurityBottomNav activeTab="home" onNavigate={onNavigate} />

      {/* Person Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent={true} onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Person Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={[styles.closeButton, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedPerson && (
              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={true}>
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Person Information</Text>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Name</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedPerson.name}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Type</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedPerson.type}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Purpose</Text><Text style={[styles.modalValue, { color: theme.text, flex: 1, textAlign: 'right' }]}>{selectedPerson.purpose}</Text></View>
                </View>
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Time Information</Text>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Entry Time</Text><Text style={[styles.modalValue, { color: theme.text }]}>{formatTime(selectedPerson.inTime)}</Text></View>
                  {selectedPerson.outTime && <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Exit Time</Text><Text style={[styles.modalValue, { color: theme.text }]}>{formatTime(selectedPerson.outTime)}</Text></View>}
                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Status</Text>
                    <View style={[styles.statusBadge, { backgroundColor: theme.success + '22' }]}>
                      <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                      <Text style={[styles.statusText, { color: theme.success }]}>{selectedPerson.status}</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Visitor Detail Modal */}
      <Modal visible={showVisitorModal} animationType="slide" transparent={true} onRequestClose={() => setShowVisitorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Visitor Request</Text>
              <TouchableOpacity onPress={() => setShowVisitorModal(false)} style={[styles.closeButton, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedVisitor && (
              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
                <View style={[styles.urgentBanner, { backgroundColor: theme.error + '22' }]}>
                  <Ionicons name="alert-circle" size={20} color={theme.error} />
                  <Text style={[styles.urgentBannerText, { color: theme.error }]}>Request escalated - No response from {selectedVisitor.personToMeet}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Visitor Information</Text>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Name</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedVisitor.name}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Email</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedVisitor.email}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Phone</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedVisitor.phone}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>People</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedVisitor.numberOfPeople}</Text></View>
                </View>
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Visit Details</Text>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Person to Meet</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedVisitor.personToMeet}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Department</Text><Text style={[styles.modalValue, { color: theme.text }]}>{selectedVisitor.department}</Text></View>
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Purpose</Text><Text style={[styles.modalValue, { color: theme.text, flex: 1, textAlign: 'right' }]}>{selectedVisitor.purpose}</Text></View>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalApproveBtn, { backgroundColor: theme.success }]} onPress={() => handleApproveVisitor(selectedVisitor)}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.modalBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalRejectBtn, { backgroundColor: theme.error }]} onPress={() => handleRejectVisitor(selectedVisitor)}>
                    <Ionicons name="close-circle" size={20} color="#FFF" />
                    <Text style={styles.modalBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal visible={showRejectModal} transparent animationType="slide" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.rejectModalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.rejectModalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.rejectModalTitle, { color: theme.text }]}>Reject Visitor</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedVisitor && <Text style={[styles.rejectModalSubtitle, { color: theme.textSecondary }]}>Provide reason for rejecting {selectedVisitor.name}</Text>}
            <TextInput
              style={[styles.rejectReasonInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter rejection reason..."
              placeholderTextColor={theme.textTertiary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.rejectModalButtons}>
              <TouchableOpacity style={[styles.rejectModalCancelBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]} onPress={() => setShowRejectModal(false)}>
                <Text style={[styles.rejectModalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectModalConfirmBtn, { backgroundColor: theme.error }]} onPress={confirmRejectVisitor}>
                <Ionicons name="close-circle" size={20} color="#FFF" />
                <Text style={styles.rejectModalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification Dropdown */}
      <NotificationDropdown
        visible={showNotificationDropdown}
        onClose={() => setShowNotificationDropdown(false)}
        userId={user.securityId}
        userType="security"
      />
      <ConfirmationModal
        visible={showLogoutModal}
        title="Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        onConfirm={onLogout}
        onCancel={() => setShowLogoutModal(false)}
        icon="log-out-outline"
        confirmColor={theme.error}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerInfo: { gap: 2 },
  greeting: { fontSize: 13 },
  userName: { fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notificationIndicator: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, minHeight: 80 },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 14, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionCount: { fontSize: 14 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyState: { paddingVertical: 80, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  personCard: { borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  personAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  personAvatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  personInfo: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  personType: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  personPurpose: { fontSize: 13 },
  personRight: { alignItems: 'flex-end' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  personTime: { fontSize: 12, marginBottom: 6 },
  exitButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  exitButtonText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, maxHeight: '100%' },
  modalScrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  modalSection: { marginBottom: 20 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalLabel: { fontSize: 14 },
  modalValue: { fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  visitorRequestsContainer: { marginTop: 8, marginBottom: 16 },
  visitorRequestsContent: { paddingHorizontal: 20, gap: 12 },
  visitorRequestCard: { width: 200, borderRadius: 12, padding: 16, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  visitorCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  visitorAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  urgentText: { fontSize: 10, fontWeight: '700' },
  visitorName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  visitorMeet: { fontSize: 13, marginBottom: 2 },
  visitorDept: { fontSize: 12, marginBottom: 12 },
  visitorActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  urgentBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  urgentBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalApproveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  modalRejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  rejectModalContent: { borderRadius: 20, padding: 24, width: '90%', maxWidth: 400 },
  rejectModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 0 },
  rejectModalTitle: { fontSize: 20, fontWeight: '700' },
  rejectModalSubtitle: { fontSize: 14, marginBottom: 16 },
  rejectReasonInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100, marginBottom: 20 },
  rejectModalButtons: { flexDirection: 'row', gap: 12 },
  rejectModalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rejectModalCancelText: { fontSize: 16, fontWeight: '600' },
  rejectModalConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  rejectModalConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

export default NewSecurityDashboard;
