import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Platform,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { HODContact, SecurityPersonnel, ScreenName } from '../../types';
import SecurityBottomNav from '../../components/SecurityBottomNav';
import ErrorModal from '../../components/ErrorModal';

interface HODContactsScreenProps {
  security: SecurityPersonnel;
  onBack: () => void;
  onNavigate: (screen: ScreenName) => void;
}

export default function HODContactsScreen({ security, onBack, onNavigate }: HODContactsScreenProps) {
  const [hods, setHods] = useState<HODContact[]>([]);
  const [filteredHods, setFilteredHods] = useState<HODContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const departments = ['ALL', 'CSE', 'ECE', 'IT', 'AIDS', 'AIML', 'MECH', 'EEE', 'CCE', 'CSBS', 'VLSI', 'ADMIN'];

  useEffect(() => {
    fetchHODs();
  }, []);

  useEffect(() => {
    filterHODs();
  }, [searchQuery, selectedDepartment, hods]);

  const fetchHODs = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getHODContacts();
      if (response.success && response.data) {
        setHods(response.data);
        setFilteredHods(response.data);
      } else {
        setErrorMessage('Failed to fetch HOD contacts');
        setShowErrorModal(true);
      }
    } catch (error) {
      setErrorMessage('Could not connect to server');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHODs();
    setRefreshing(false);
  };

  const filterHODs = () => {
    let filtered = [...hods];

    // Filter by department
    if (selectedDepartment !== 'ALL') {
      filtered = filtered.filter(hod => {
        const deptName = hod.department ? hod.department.toUpperCase() : '';
        return deptName === selectedDepartment.toUpperCase() || 
               deptName.includes(selectedDepartment.toUpperCase());
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        hod =>
          hod.name.toLowerCase().includes(query) ||
          (hod.department && hod.department.toLowerCase().includes(query))
      );
    }

    setFilteredHods(filtered);
  };

  const handleCall = async (phone: string) => {
    try {
      const phoneUrl = Platform.OS === 'ios' ? `telprompt://${phone}` : `tel:${phone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        await Linking.openURL(`tel:${phone}`);
      }
    } catch (error) {
      console.error('Error opening phone dialer:', error);
      setErrorMessage('Failed to open phone dialer');
      setShowErrorModal(true);
    }
  };

  const handleMessage = async (phone: string) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const whatsappUrl = `whatsapp://send?phone=91${cleanPhone}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        setErrorMessage('Please install WhatsApp to send messages to HODs.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      setErrorMessage('Failed to open WhatsApp');
      setShowErrorModal(true);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return 'HD';
    const trimmedName = name.trim();
    const parts = trimmedName.split(' ').filter(part => part.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return 'HD';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HOD CONTACT{'\n'}DIRECTORY</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by HOD name or department"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Department Filter */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {departments.map(dept => (
            <TouchableOpacity
              key={dept}
              style={[
                styles.filterChip,
                selectedDepartment === dept && styles.filterChipActive,
              ]}
              onPress={() => setSelectedDepartment(dept)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedDepartment === dept && styles.filterChipTextActive,
                ]}
              >
                {dept}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* HOD List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#00BCD4']}
            tintColor="#00BCD4"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00BCD4" />
            <Text style={styles.loadingText}>Loading HOD contacts...</Text>
          </View>
        ) : filteredHods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No HOD contact records found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery || selectedDepartment !== 'ALL'
                ? 'Try adjusting your search or filter'
                : 'No HOD contacts available'}
            </Text>
          </View>
        ) : (
          filteredHods.map(hod => (
            <View key={hod.id} style={styles.hodCard}>
              {/* Avatar and Info */}
              <View style={styles.hodHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(hod.name)}</Text>
                </View>
                <View style={styles.hodInfo}>
                  <Text style={styles.hodName}>{hod.name || 'Unknown HOD'}</Text>
                  <Text style={styles.hodDepartment}>
                    {hod.department || 'N/A'} • {hod.department || 'N/A'}
                  </Text>
                  <View style={styles.designationBadge}>
                    <Text style={styles.designationText}>Head of Department</Text>
                  </View>
                </View>
                <View style={styles.statusIndicator}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>

              {/* Contact Info */}
              <View style={styles.contactSection}>
                <View style={styles.contactRow}>
                  <Ionicons name="call-outline" size={16} color="#6B7280" />
                  <Text style={styles.contactText}>{hod.phone || 'N/A'}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={16} color="#6B7280" />
                  <Text style={styles.contactEmail}>{hod.email || 'N/A'}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(hod.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => handleMessage(hod.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <SecurityBottomNav activeTab="contacts" onNavigate={onNavigate} />

      <ErrorModal
        visible={showErrorModal}
        type="general"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20,
    paddingHorizontal: 20,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 22,
  },
  headerRight: {
    width: 40,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },

  // Department Filter
  filterContainer: {
    marginBottom: 0,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // HOD Card
  hodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  hodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00BCD4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hodInfo: {
    flex: 1,
  },
  hodName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  hodDepartment: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  designationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  designationText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  statusIndicator: {
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },

  // Contact Section
  contactSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 10,
    flex: 1,
  },
  contactEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 10,
    flex: 1,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BCD4',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Bottom Navigation Bar
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingVertical: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  bottomTabLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  activeBottomTabLabel: {
    color: '#00BCD4',
    fontWeight: '600',
  },
});
