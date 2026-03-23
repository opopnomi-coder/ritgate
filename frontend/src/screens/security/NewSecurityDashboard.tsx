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
  TextInput,
  Platform,
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
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';
import { formatTime as fmtTime, getRelativeTimeShort } from '../../utils/dateUtils';

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [stats, setStats] = useState({
    active: 0,
    exited: 0,
    total: 0,
  });

  useEffect(() => {
    loadDashboardData();
    loadEscalatedVisitors();
    loadNotifications(user.securityId, 'security');

    // Poll for new escalated visitors every 30 seconds
    const pollInterval = setInterval(() => {
      loadEscalatedVisitors();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const personsResponse = await apiService.getActivePersons();

      if (personsResponse.success && personsResponse.data) {
        const validPersons = personsResponse.data.filter((person: ActivePerson) => 
          person.name && 
          !person.name.startsWith('QR Not Found') && 
          !person.name.includes('Unknown')
        );
        setActivePersons(validPersons);

        // Active count comes directly from the active-persons list
        const activeCount = validPersons.length;

        // For exited + total, fetch scan history and count today's records
        try {
          const historyResponse = await apiService.getScanHistory(user.securityId);
          if (historyResponse.success && historyResponse.data) {
            const today = new Date().toDateString();
            const todayRecords = historyResponse.data.filter((r: any) => {
              const t = r.exitTime || r.entryTime || r.inTime || r.outTime;
              return t && new Date(t).toDateString() === today;
            });
            const exitedCount = todayRecords.filter((r: any) => r.status === 'EXITED' || !!r.exitTime).length;
            const totalCount = activeCount + exitedCount;
            setStats({ active: activeCount, exited: exitedCount, total: totalCount });
          } else {
            setStats({ active: activeCount, exited: 0, total: activeCount });
          }
        } catch {
          setStats({ active: activeCount, exited: 0, total: activeCount });
        }
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
      return fmtTime(timeString);
    } catch (error) {
      return timeString;
    }
  };

  const handleManualExit = async (person: ActivePerson) => {
    try {
      const response = await apiService.manualExit(person.name, user.securityId);
      if (response.success) {
        setSuccessMessage(`${person.name} has been marked as exited`);
        setShowSuccessModal(true);
        setShowDetailModal(false);
        loadDashboardData();
      } else {
        setErrorMessage(response.message || 'Failed to mark exit');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Manual exit error:', error);
      setErrorMessage('Failed to process manual exit');
      setShowErrorModal(true);
    }
  };

  const handleApproveVisitor = async (visitor: EscalatedVisitor) => {
    try {
      const securityId = user.securityId || user.id?.toString() || 'SEC001';
      const response = await apiService.approveEscalatedVisitor(visitor.id, securityId);
      if (response.success) {
        setSuccessMessage('Visitor approved successfully');
        setShowSuccessModal(true);
        setShowVisitorModal(false);
        loadEscalatedVisitors();
      } else {
        setErrorMessage(response.message || 'Failed to approve visitor');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Approve visitor error:', error);
      setErrorMessage('Failed to approve visitor');
      setShowErrorModal(true);
    }
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
        user.securityId || user.id?.toString() || 'SEC001',
        rejectionReason || 'Rejected by security'
      );
      if (response.success) {
        setSuccessMessage('Visitor rejected');
        setShowSuccessModal(true);
        setShowRejectModal(false);
        setShowVisitorModal(false);
        setRejectionReason('');
        loadEscalatedVisitors();
      } else {
        setErrorMessage(response.message || 'Failed to reject visitor');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Reject visitor error:', error);
      setErrorMessage('Failed to reject visitor');
      setShowErrorModal(true);
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
      <ScrollView
        style={styles.outerScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.outerScrollContent}
      >
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

      {/* Visitor Requests Section — escalated after 5 min of no staff response */}
      {escalatedVisitors.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="alert-circle" size={18} color={theme.error} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Visitor Requests</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.error + '22' }]}>
              <Text style={[styles.badgeText, { color: theme.error }]}>{escalatedVisitors.length}</Text>
            </View>
          </View>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Staff did not respond within 5 min — your action required
          </Text>

          {escalatedVisitors.map((visitor) => (
            <TouchableOpacity
              key={visitor.id}
              style={[styles.requestCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => { setSelectedVisitor(visitor); setShowVisitorModal(true); }}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarContainer, { backgroundColor: theme.error + '22' }]}>
                  <Text style={[styles.requestAvatarText, { color: theme.error }]}>
                    {getInitials(visitor.name)}
                  </Text>
                </View>
                <View style={styles.headerMainInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.requestStudentName, { color: theme.text }]} numberOfLines={1}>
                      {visitor.name}
                    </Text>
                    <View style={[styles.passTypePill, { backgroundColor: theme.error + '15', borderColor: theme.error + '44' }]}>
                      <Text style={[styles.passTypePillText, { color: theme.error }]}>Visitor</Text>
                    </View>
                  </View>
                  <Text style={[styles.studentIdSub, { color: theme.textSecondary }]}>
                    To meet: {visitor.personToMeet} • {visitor.department}
                  </Text>
                </View>
                <View style={styles.timeAgoContainer}>
                  <Ionicons name="time-outline" size={12} color={theme.error} />
                  <Text style={[styles.timeAgoText, { color: theme.error }]}>
                    {getRelativeTimeShort(visitor.escalationTime || visitor.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailsBlock, { backgroundColor: theme.inputBackground }]}>
                <View style={styles.detailItem}>
                  <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.text }]} numberOfLines={1}>{visitor.purpose}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.text }]}>{visitor.numberOfPeople} {visitor.numberOfPeople === 1 ? 'person' : 'people'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.text }]}>{visitor.phone}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.success }]}
                  onPress={(e) => { e.stopPropagation(); handleApproveVisitor(visitor); }}
                >
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.error }]}
                  onPress={(e) => { e.stopPropagation(); handleRejectVisitor(visitor); }}
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

        {/* Active Persons List */}
        <View style={[styles.sectionHeader, { paddingBottom: 12 }]}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Persons</Text>
          </View>
          <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>{stats.active} active</Text>
        </View>

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
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <SecurityBottomNav activeTab="home" onNavigate={onNavigate} />

      {/* Person Detail — Full Screen */}
      <Modal visible={showDetailModal} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={() => setShowDetailModal(false)}>
        <SafeAreaView style={[detailStyles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
          <StatusBar barStyle={theme.type === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />

          {/* Header */}
          <View style={[detailStyles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={[detailStyles.backBtn, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={[detailStyles.headerTitle, { color: theme.text }]}>Person Details</Text>
            {selectedPerson && (
              <View style={[detailStyles.statusPill, { backgroundColor: (selectedPerson.status === 'PENDING' ? theme.success : theme.error) + '22' }]}>
                <Text style={[detailStyles.statusPillText, { color: selectedPerson.status === 'PENDING' ? theme.success : theme.error }]}>
                  {selectedPerson.status === 'PENDING' ? 'ON CAMPUS' : 'EXITED'}
                </Text>
              </View>
            )}
          </View>

          {selectedPerson && (
            <ScrollView style={detailStyles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.scrollContent}>
              {/* Profile Row */}
              <View style={[detailStyles.profileRow, { backgroundColor: theme.surface }]}>
                <View style={[detailStyles.avatar, { backgroundColor: theme.primary }]}>
                  <Text style={detailStyles.avatarText}>{getInitials(selectedPerson.name)}</Text>
                </View>
                <View style={detailStyles.profileInfo}>
                  <View style={[detailStyles.typePill, { backgroundColor: theme.primary + '22' }]}>
                    <Text style={[detailStyles.typePillText, { color: theme.primary }]}>{selectedPerson.type}</Text>
                  </View>
                  <Text style={[detailStyles.profileName, { color: theme.text }]} numberOfLines={1}>{selectedPerson.name}</Text>
                </View>
              </View>

              {/* Info Grid */}
              <View style={[detailStyles.infoGrid, { backgroundColor: theme.surface }]}>
                <View style={detailStyles.infoCell}>
                  <Text style={[detailStyles.infoLabel, { color: theme.textTertiary }]}>PURPOSE</Text>
                  <Text style={[detailStyles.infoValue, { color: theme.text }]} numberOfLines={2}>{selectedPerson.purpose || 'N/A'}</Text>
                </View>
                <View style={[detailStyles.infoDivider, { backgroundColor: theme.border }]} />
                <View style={detailStyles.infoCell}>
                  <Text style={[detailStyles.infoLabel, { color: theme.textTertiary }]}>ENTRY TIME</Text>
                  <Text style={[detailStyles.infoValue, { color: theme.text }]}>{formatTime(selectedPerson.inTime)}</Text>
                </View>
              </View>

              {/* Time Block */}
              <View style={[detailStyles.block, { backgroundColor: theme.surface }]}>
                <Text style={[detailStyles.blockLabel, { color: theme.textTertiary }]}>TIME DETAILS</Text>
                <View style={detailStyles.timeRow}>
                  <View style={[detailStyles.timeBox, { backgroundColor: theme.success + '15' }]}>
                    <Ionicons name="enter-outline" size={18} color={theme.success} />
                    <Text style={[detailStyles.timeBoxLabel, { color: theme.textSecondary }]}>Entry</Text>
                    <Text style={[detailStyles.timeBoxValue, { color: theme.text }]}>{formatTime(selectedPerson.inTime)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={theme.textTertiary} />
                  <View style={[detailStyles.timeBox, { backgroundColor: (selectedPerson.outTime ? theme.error : theme.inputBackground) + '33' }]}>
                    <Ionicons name="exit-outline" size={18} color={selectedPerson.outTime ? theme.error : theme.textTertiary} />
                    <Text style={[detailStyles.timeBoxLabel, { color: theme.textSecondary }]}>Exit</Text>
                    <Text style={[detailStyles.timeBoxValue, { color: theme.text }]}>{selectedPerson.outTime ? formatTime(selectedPerson.outTime) : '—'}</Text>
                  </View>
                </View>
              </View>

              {/* Status Timeline */}
              <View style={[detailStyles.block, { backgroundColor: theme.surface }]}>
                <Text style={[detailStyles.blockLabel, { color: theme.textTertiary }]}>STATUS TIMELINE</Text>
                {/* Step 1: Entry */}
                <View style={detailStyles.tlItem}>
                  <View style={[detailStyles.tlDot, { backgroundColor: theme.success }]}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  </View>
                  <View style={detailStyles.tlBody}>
                    <Text style={[detailStyles.tlTitle, { color: theme.text }]}>Entry Recorded</Text>
                    <Text style={[detailStyles.tlStatus, { color: theme.success }]}>✓ Completed — {formatTime(selectedPerson.inTime)}</Text>
                  </View>
                </View>
                <View style={[detailStyles.tlConnector, { backgroundColor: selectedPerson.status === 'EXITED' ? theme.success : theme.border }]} />
                {/* Step 2: Exit */}
                <View style={detailStyles.tlItem}>
                  <View style={[detailStyles.tlDot, {
                    backgroundColor: selectedPerson.status === 'EXITED' ? theme.error : theme.inputBackground,
                    borderWidth: selectedPerson.status !== 'EXITED' ? 2 : 0,
                    borderColor: theme.border,
                  }]}>
                    {selectedPerson.status === 'EXITED'
                      ? <Ionicons name="checkmark" size={14} color="#FFF" />
                      : <View style={[detailStyles.tlDotInner, { backgroundColor: theme.textTertiary }]} />}
                  </View>
                  <View style={detailStyles.tlBody}>
                    <Text style={[detailStyles.tlTitle, { color: theme.text }]}>Exit</Text>
                    <Text style={[detailStyles.tlStatus, { color: selectedPerson.status === 'EXITED' ? theme.error : theme.textSecondary }]}>
                      {selectedPerson.status === 'EXITED'
                        ? `✓ Exited — ${selectedPerson.outTime ? formatTime(selectedPerson.outTime) : ''}`
                        : 'Still on campus'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>
          )}

          {/* Footer */}
          {selectedPerson && selectedPerson.status === 'PENDING' && (
            <View style={[detailStyles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[detailStyles.exitBtn, { backgroundColor: theme.error }]}
                onPress={() => { setShowDetailModal(false); handleManualExit(selectedPerson); }}
              >
                <Ionicons name="log-out-outline" size={20} color="#FFF" />
                <Text style={detailStyles.exitBtnText}>Mark as Exited</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
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
                  <View style={styles.modalRow}><Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Purpose of Visit</Text><Text style={[styles.modalValue, { color: theme.text, flex: 1, textAlign: 'right' }]}>{selectedVisitor.purpose}</Text></View>
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
      <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.rejectModalOverlay}>
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
  container: { flex: 1 },
  outerScroll: { flex: 1 },
  outerScrollContent: { paddingBottom: 20 },
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { fontSize: 12, paddingHorizontal: 20, marginBottom: 12 },
  sectionCount: { fontSize: 14 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyState: { paddingVertical: 80, alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  /* Visitor request cards — same style as staff dashboard */
  requestCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  requestAvatarText: { fontSize: 16, fontWeight: '700' },
  headerMainInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  requestStudentName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  passTypePill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  passTypePillText: { fontSize: 10, fontWeight: '700' },
  studentIdSub: { fontSize: 12, marginTop: 2 },
  timeAgoContainer: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  timeAgoText: { fontSize: 12 },
  detailsBlock: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 5 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, flex: 1 },
  cardFooter: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  personCard: { borderRadius: 12, padding: 16, marginBottom: 12, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
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
  urgentBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  urgentBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalApproveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  modalRejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  rejectModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  rejectModalContent: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
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

const detailStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 12, gap: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 4 },
  typePillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  profileName: { fontSize: 16, fontWeight: '700' },
  profileSub: { fontSize: 12, marginTop: 2 },
  infoGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, borderRadius: 14, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  infoCell: { flex: 1, padding: 12 },
  infoDivider: { width: 1, marginVertical: 8 },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  infoValue: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  block: { marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  blockLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  timeBox: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, gap: 4 },
  timeBoxLabel: { fontSize: 11, fontWeight: '600' },
  timeBoxValue: { fontSize: 14, fontWeight: '700' },
  tlItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tlDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  tlDotInner: { width: 10, height: 10, borderRadius: 5 },
  tlBody: { flex: 1, paddingTop: 4, paddingBottom: 4 },
  tlTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  tlStatus: { fontSize: 12 },
  tlConnector: { width: 2, height: 20, marginLeft: 15, marginVertical: 2 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 8 : 14, borderTopWidth: 1 },
  exitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  exitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default NewSecurityDashboard;
