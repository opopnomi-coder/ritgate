import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  StatusBar,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SecurityPersonnel, ScreenName } from '../../types';
import { apiService } from '../../services/api';
import SecurityBottomNav from '../../components/SecurityBottomNav';
import { formatDateTime } from '../../utils/dateUtils';

interface ModernScanHistoryScreenProps {
  security: SecurityPersonnel;
  onBack: () => void;
  onNavigate: (screen: ScreenName) => void;
}

interface ScanRecord {
  id: number;
  name: string;
  type: string;
  purpose: string;
  inTime?: string;
  outTime?: string;
  entryTime?: string;
  exitTime?: string;
  status: string;
  isBulkPass?: boolean;
  incharge?: string;
  subtype?: string;
  participantCount?: string;
  reason?: string;
  participants?: Array<{
    id: string;
    name: string;
    type: string;
    department: string;
  }>;
  regNo?: string;
  department?: string;
}

const ModernScanHistoryScreen: React.FC<ModernScanHistoryScreenProps> = ({
  security,
  onBack,
  onNavigate,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'SCANS' | 'VEHICLES'>('SCANS');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ENTRY' | 'EXIT'>('ALL');
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'SCANS') {
      loadScanHistory();
    } else {
      loadVehicleHistory();
    }
  }, [activeTab]);

  const loadScanHistory = async () => {
    try {
      setLoading(true);
      const response = await apiService.getScanHistory(security.securityId);
      if (response.success && response.data) {
        const mappedData = response.data.map((scan: any) => {
          const inTime = scan.entryTime || scan.inTime;
          const outTime = scan.exitTime || scan.outTime;
          // For exit-only records (RailwayExitLog), backend sets both entryTime and exitTime
          // to the same value with status="EXITED". Distinguish using status field.
          const isExitOnly = scan.status === 'EXITED' && inTime === outTime;
          return {
            ...scan,
            inTime: isExitOnly ? undefined : inTime,
            outTime,
          };
        });
        setScans(mappedData);
      }
    } catch (error) {
      console.error('Error loading scan history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadVehicleHistory = async () => {
    try {
      setLoading(true);
      const response = await apiService.getVehicles();
      if (response.success && response.data) {
        setVehicles(response.data);
      }
    } catch (error) {
      console.error('Error loading vehicle history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'SCANS') {
      loadScanHistory();
    } else {
      loadVehicleHistory();
    }
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = searchQuery === '' ||
      vehicle.ownerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.licensePlate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vehicleType?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredScans = scans.filter(scan => {
    const matchesSearch = searchQuery === '' ||
      scan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.type?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesFilter = true;
    if (activeFilter === 'ENTRY') {
      // Show records that are entries (person is inside / has entered)
      matchesFilter = scan.status === 'ENTERED' || (!scan.outTime && !!scan.inTime);
    } else if (activeFilter === 'EXIT') {
      matchesFilter = scan.status === 'EXITED' || !!scan.outTime;
    }

    return matchesSearch && matchesFilter;
  });

  const getInitials = (name: string) => {
    if (!name) return 'NA';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    try {
      return formatDateTime(timeString);
    } catch (error) {
      return timeString;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Main Tab Switcher */}
      <View style={styles.mainTabContainer}>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'SCANS' && styles.mainTabActive]}
          onPress={() => {
            setActiveTab('SCANS');
            setSearchQuery('');
            setActiveFilter('ALL');
          }}
        >
          <Ionicons 
            name="qr-code" 
            size={20} 
            color={activeTab === 'SCANS' ? '#00BCD4' : '#9CA3AF'} 
          />
          <Text style={[styles.mainTabText, activeTab === 'SCANS' && styles.mainTabTextActive]}>
            Scan History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'VEHICLES' && styles.mainTabActive]}
          onPress={() => {
            setActiveTab('VEHICLES');
            setSearchQuery('');
          }}
        >
          <Ionicons 
            name="car" 
            size={20} 
            color={activeTab === 'VEHICLES' ? '#00BCD4' : '#9CA3AF'} 
          />
          <Text style={[styles.mainTabText, activeTab === 'VEHICLES' && styles.mainTabTextActive]}>
            Vehicle History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'SCANS' ? "Search by name or type..." : "Search by owner, plate, or type..."}
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs - Only for Scan History */}
      {activeTab === 'SCANS' && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'ALL' && styles.filterTabActive]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'ENTRY' && styles.filterTabActive]}
            onPress={() => setActiveFilter('ENTRY')}
          >
            <Text style={[styles.filterText, activeFilter === 'ENTRY' && styles.filterTextActive]}>
              Entry
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'EXIT' && styles.filterTabActive]}
            onPress={() => setActiveFilter('EXIT')}
          >
            <Text style={[styles.filterText, activeFilter === 'EXIT' && styles.filterTextActive]}>
              Exit
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content - Scan List or Vehicle List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>Loading {activeTab === 'SCANS' ? 'scan' : 'vehicle'} history...</Text>
        </View>
      ) : (
        <View style={styles.scrollContent}>
          {activeTab === 'SCANS' ? (
            // Scan History List
            filteredScans.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No scan records found</Text>
              </View>
            ) : (
              filteredScans.map((scan, index) => (
                <TouchableOpacity
                  key={`${scan.id}-${index}`}
                  style={styles.scanCard}
                  onPress={() => {
                    setSelectedScan(scan);
                    setShowDetailModal(true);
                  }}
                >
                  <View style={styles.scanAvatar}>
                    <Text style={styles.scanAvatarText}>
                      {scan.isBulkPass ? 'GP' : getInitials(scan.name)}
                    </Text>
                  </View>
                  <View style={styles.scanInfo}>
                    {scan.isBulkPass ? (
                      <>
                        <Text style={styles.scanName}>Bulk Pass - {scan.incharge}</Text>
                        <Text style={styles.scanType}>
                          {scan.subtype} • {scan.participantCount} participants
                        </Text>
                        <Text style={styles.scanPurpose} numberOfLines={1}>
                          {scan.purpose || scan.reason}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.scanName}>{scan.name}</Text>
                        <Text style={styles.scanType}>{scan.type}</Text>
                        <Text style={styles.scanPurpose} numberOfLines={1}>
                          {scan.purpose}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={styles.scanRight}>
                    <View style={[
                      styles.scanStatusBadge,
                      scan.status === 'EXITED' || scan.outTime ? styles.scanStatusExit : styles.scanStatusEntry
                    ]}>
                      <Ionicons
                        name={scan.status === 'EXITED' || scan.outTime ? 'log-out' : 'log-in'}
                        size={12}
                        color={scan.status === 'EXITED' || scan.outTime ? '#EF4444' : '#10B981'}
                      />
                      <Text style={[
                        styles.scanStatusText,
                        scan.status === 'EXITED' || scan.outTime ? styles.scanStatusTextExit : styles.scanStatusTextEntry
                      ]}>
                        {scan.status === 'EXITED' || scan.outTime ? 'EXIT' : 'ENTRY'}
                      </Text>
                    </View>
                    <Text style={styles.scanTime}>{formatTime(scan.outTime || scan.inTime)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : (
            // Vehicle History List
            filteredVehicles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="car-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No vehicle records found</Text>
              </View>
            ) : (
              filteredVehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={styles.scanCard}
                  onPress={() => {
                    setSelectedVehicle(vehicle);
                    setShowVehicleModal(true);
                  }}
                >
                  <View style={[styles.scanAvatar, { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name="car" size={24} color="#FFF" />
                  </View>
                  <View style={styles.scanInfo}>
                    <Text style={styles.scanName}>{vehicle.licensePlate || 'N/A'}</Text>
                    <Text style={styles.scanType}>{vehicle.vehicleType || 'Unknown Type'}</Text>
                    <Text style={styles.scanPurpose} numberOfLines={1}>
                      Owner: {vehicle.ownerName || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.scanRight}>
                    <View style={[
                      styles.scanStatusBadge,
                      styles.scanStatusEntry
                    ]}>
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color="#10B981"
                      />
                      <Text style={[styles.scanStatusText, styles.scanStatusTextEntry]}>
                        REGISTERED
                      </Text>
                    </View>
                    <Text style={styles.scanTime}>{formatTime(vehicle.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )
          )}
        </View>
      )}
      </ScrollView>

      {/* Scan Detail — full-screen modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.fsScreen} edges={['top', 'bottom']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {/* Header */}
          {selectedScan && (() => {
            const isExited = selectedScan.status === 'EXITED' || !!selectedScan.outTime;
            const statusColor = isExited ? '#EF4444' : '#10B981';
            const statusLabel = isExited ? 'EXITED' : 'ACTIVE';
            return (
              <>
                <View style={styles.fsHeader}>
                  <TouchableOpacity style={styles.fsBackBtn} onPress={() => setShowDetailModal(false)}>
                    <Ionicons name="arrow-back" size={22} color="#1F2937" />
                  </TouchableOpacity>
                  <Text style={styles.fsHeaderTitle}>Scan Details</Text>
                  <View style={[styles.fsStatusPill, { backgroundColor: statusColor + '22' }]}>
                    <Text style={[styles.fsStatusPillText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                <ScrollView style={styles.fsScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.fsScrollContent}>
                  {selectedScan.isBulkPass ? (
                    <>
                      {/* Bulk pass profile row */}
                      <View style={styles.fsProfileRow}>
                        <View style={[styles.fsAvatar, { backgroundColor: '#F59E0B' }]}>
                          <Text style={styles.fsAvatarText}>GP</Text>
                        </View>
                        <View style={styles.fsProfileInfo}>
                          <Text style={styles.fsProfileName}>Bulk Pass</Text>
                          <Text style={styles.fsProfileSub}>
                            {selectedScan.incharge} • {selectedScan.subtype}
                          </Text>
                        </View>
                      </View>

                      {/* Info grid */}
                      <View style={styles.fsInfoGrid}>
                        <View style={styles.fsInfoCell}>
                          <Text style={styles.fsInfoLabel}>PURPOSE</Text>
                          <Text style={styles.fsInfoValue} numberOfLines={2}>{selectedScan.purpose || 'N/A'}</Text>
                        </View>
                        <View style={styles.fsInfoDivider} />
                        <View style={styles.fsInfoCell}>
                          <Text style={styles.fsInfoLabel}>PARTICIPANTS</Text>
                          <Text style={styles.fsInfoValue}>{selectedScan.participantCount || '—'}</Text>
                        </View>
                      </View>

                      {/* Reason */}
                      {!!selectedScan.reason && (
                        <View style={styles.fsBlock}>
                          <Text style={styles.fsBlockLabel}>REASON</Text>
                          <Text style={styles.fsReasonText}>{selectedScan.reason}</Text>
                        </View>
                      )}

                      {/* Time info */}
                      <View style={styles.fsBlock}>
                        <Text style={styles.fsBlockLabel}>TIME INFORMATION</Text>
                        <View style={styles.fsTlItem}>
                          <View style={[styles.fsTlDot, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="log-out" size={14} color="#FFF" />
                          </View>
                          <View style={styles.fsTlBody}>
                            <Text style={styles.fsTlTitle}>Exit Time</Text>
                            <Text style={styles.fsTlSub}>{formatTime(selectedScan.inTime || selectedScan.outTime)}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Participants */}
                      {selectedScan.participants && selectedScan.participants.length > 0 && (
                        <View style={styles.fsBlock}>
                          <Text style={styles.fsBlockLabel}>PARTICIPANTS</Text>
                          {selectedScan.participants.map((p, i) => (
                            <View key={i} style={styles.participantCard}>
                              <View style={styles.participantAvatar}>
                                <Text style={styles.participantAvatarText}>{getInitials(p.name)}</Text>
                              </View>
                              <View style={styles.participantInfo}>
                                <Text style={styles.participantName}>{p.name}</Text>
                                <Text style={styles.participantDetails}>{p.id} • {p.type}</Text>
                                {p.department && <Text style={styles.participantDept}>{p.department}</Text>}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Single pass profile row */}
                      <View style={styles.fsProfileRow}>
                        <View style={[styles.fsAvatar, { backgroundColor: statusColor }]}>
                          <Text style={styles.fsAvatarText}>{getInitials(selectedScan.name)}</Text>
                        </View>
                        <View style={styles.fsProfileInfo}>
                          <Text style={styles.fsProfileName}>{selectedScan.name}</Text>
                          <Text style={styles.fsProfileSub}>
                            {selectedScan.regNo ? `${selectedScan.regNo} • ` : ''}{selectedScan.type}
                            {selectedScan.department ? ` • ${selectedScan.department}` : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Info grid */}
                      <View style={styles.fsInfoGrid}>
                        <View style={styles.fsInfoCell}>
                          <Text style={styles.fsInfoLabel}>{selectedScan.type === 'VISITOR' ? 'PURPOSE OF VISIT' : 'PURPOSE'}</Text>
                          <Text style={styles.fsInfoValue} numberOfLines={2}>{selectedScan.purpose || 'N/A'}</Text>
                        </View>
                        <View style={styles.fsInfoDivider} />
                        <View style={styles.fsInfoCell}>
                          <Text style={styles.fsInfoLabel}>TYPE</Text>
                          <Text style={styles.fsInfoValue}>{selectedScan.type || 'N/A'}</Text>
                        </View>
                      </View>

                      {/* Reason — only for non-visitor types */}
                      {!!selectedScan.reason && selectedScan.type !== 'VISITOR' && (
                        <View style={styles.fsBlock}>
                          <Text style={styles.fsBlockLabel}>REASON</Text>
                          <Text style={styles.fsReasonText}>{selectedScan.reason}</Text>
                        </View>
                      )}

                      {/* Timeline */}
                      <View style={styles.fsBlock}>
                        <Text style={styles.fsBlockLabel}>TIME INFORMATION</Text>
                        {selectedScan.inTime && (
                          <View style={styles.fsTlItem}>
                            <View style={[styles.fsTlDot, { backgroundColor: '#10B981' }]}>
                              <Ionicons name="log-in" size={14} color="#FFF" />
                            </View>
                            <View style={styles.fsTlBody}>
                              <Text style={styles.fsTlTitle}>Entry Time</Text>
                              <Text style={styles.fsTlSub}>{formatTime(selectedScan.inTime)}</Text>
                            </View>
                          </View>
                        )}
                        {selectedScan.inTime && selectedScan.outTime && (
                          <View style={styles.fsTlConnector} />
                        )}
                        {selectedScan.outTime && (
                          <View style={styles.fsTlItem}>
                            <View style={[styles.fsTlDot, { backgroundColor: '#EF4444' }]}>
                              <Ionicons name="log-out" size={14} color="#FFF" />
                            </View>
                            <View style={styles.fsTlBody}>
                              <Text style={styles.fsTlTitle}>Exit Time</Text>
                              <Text style={styles.fsTlSub}>{formatTime(selectedScan.outTime)}</Text>
                            </View>
                          </View>
                        )}
                        {!selectedScan.inTime && !selectedScan.outTime && (
                          <Text style={styles.noDataText}>No time data available</Text>
                        )}
                      </View>
                    </>
                  )}
                  <View style={{ height: 16 }} />
                </ScrollView>

                {/* Footer close button */}
                <View style={styles.fsFooter}>
                  <TouchableOpacity style={styles.fsCloseBtn} onPress={() => setShowDetailModal(false)}>
                    <Text style={styles.fsCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Vehicle Detail — full-screen modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <SafeAreaView style={styles.fsScreen} edges={['top', 'bottom']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {selectedVehicle && (() => {
            const statusColor = '#10B981';
            return (
              <>
                <View style={styles.fsHeader}>
                  <TouchableOpacity style={styles.fsBackBtn} onPress={() => setShowVehicleModal(false)}>
                    <Ionicons name="arrow-back" size={22} color="#1F2937" />
                  </TouchableOpacity>
                  <Text style={styles.fsHeaderTitle}>Vehicle Details</Text>
                  <View style={[styles.fsStatusPill, { backgroundColor: statusColor + '22' }]}>
                    <Text style={[styles.fsStatusPillText, { color: statusColor }]}>
                      REGISTERED
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.fsScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.fsScrollContent}>
                  {/* Profile row */}
                  <View style={styles.fsProfileRow}>
                    <View style={[styles.fsAvatar, { backgroundColor: '#F59E0B' }]}>
                      <Ionicons name="car" size={24} color="#FFF" />
                    </View>
                    <View style={styles.fsProfileInfo}>
                      <Text style={styles.fsProfileName}>{selectedVehicle.licensePlate || 'N/A'}</Text>
                      <Text style={styles.fsProfileSub}>
                        {selectedVehicle.vehicleType || 'Unknown'} • {selectedVehicle.ownerName || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  {/* Info grid */}
                  <View style={styles.fsInfoGrid}>
                    <View style={styles.fsInfoCell}>
                      <Text style={styles.fsInfoLabel}>OWNER TYPE</Text>
                      <Text style={styles.fsInfoValue}>{selectedVehicle.ownerType || 'N/A'}</Text>
                    </View>
                    <View style={styles.fsInfoDivider} />
                    <View style={styles.fsInfoCell}>
                      <Text style={styles.fsInfoLabel}>REGISTERED ON</Text>
                      <Text style={styles.fsInfoValue} numberOfLines={2}>
                        {formatTime(selectedVehicle.createdAt || selectedVehicle.registeredAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Vehicle info */}
                  <View style={styles.fsBlock}>
                    <Text style={styles.fsBlockLabel}>VEHICLE INFORMATION</Text>
                    {[
                      ['License Plate', selectedVehicle.licensePlate],
                      ['Vehicle Type', selectedVehicle.vehicleType],
                      ['Color', selectedVehicle.vehicleColor || selectedVehicle.color],
                      ['Model', selectedVehicle.vehicleModel || selectedVehicle.model],
                    ].filter(([, v]) => !!v).map(([label, value]) => (
                      <View key={label as string} style={styles.fsRow}>
                        <Text style={styles.fsRowLabel}>{label}</Text>
                        <Text style={styles.fsRowValue}>{value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Owner info */}
                  <View style={styles.fsBlock}>
                    <Text style={styles.fsBlockLabel}>OWNER INFORMATION</Text>
                    {[
                      ['Owner Name', selectedVehicle.ownerName],
                      ['Owner Type', selectedVehicle.ownerType],
                      ['Contact', selectedVehicle.ownerPhone || selectedVehicle.contactNumber],
                      ['Registered By', selectedVehicle.registeredBy],
                    ].filter(([, v]) => !!v).map(([label, value]) => (
                      <View key={label as string} style={styles.fsRow}>
                        <Text style={styles.fsRowLabel}>{label}</Text>
                        <Text style={styles.fsRowValue}>{value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ height: 16 }} />
                </ScrollView>

                <View style={styles.fsFooter}>
                  <TouchableOpacity style={styles.fsCloseBtn} onPress={() => setShowVehicleModal(false)}>
                    <Text style={styles.fsCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Bottom Navigation */}
      <SecurityBottomNav activeTab="history" onNavigate={onNavigate} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
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
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
  },
  mainTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    gap: 12,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  mainTabActive: {
    backgroundColor: '#E0F7FA',
    borderColor: '#00BCD4',
  },
  mainTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  mainTabTextActive: {
    color: '#00BCD4',
  },
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
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  scanAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00BCD4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scanAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scanInfo: {
    flex: 1,
  },
  scanName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  scanType: {
    fontSize: 13,
    color: '#00BCD4',
    fontWeight: '600',
    marginBottom: 2,
  },
  scanPurpose: {
    fontSize: 13,
    color: '#6B7280',
  },
  scanRight: {
    alignItems: 'flex-end',
  },
  scanStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    gap: 4,
  },
  scanStatusEntry: {
    backgroundColor: '#D1FAE5',
  },
  scanStatusExit: {
    backgroundColor: '#FEE2E2',
  },
  scanStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scanStatusTextEntry: {
    color: '#10B981',
  },
  scanStatusTextExit: {
    color: '#EF4444',
  },
  scanTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00BCD4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  participantDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  participantDept: {
    fontSize: 12,
    color: '#00BCD4',
    fontWeight: '500',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  // ── Full-screen detail styles ──────────────────────────────────────
  fsScreen: { flex: 1, backgroundColor: '#F9FAFB' },
  fsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  fsBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsHeaderTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#1F2937' },
  fsStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  fsStatusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  fsScroll: { flex: 1 },
  fsScrollContent: { paddingBottom: 8 },
  fsProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  fsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fsAvatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  fsProfileInfo: { flex: 1 },
  fsProfileName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  fsProfileSub: { fontSize: 12, marginTop: 2, color: '#6B7280' },
  fsInfoGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  fsInfoCell: { flex: 1, padding: 12 },
  fsInfoDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  fsInfoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, color: '#9CA3AF' },
  fsInfoValue: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: '#1F2937' },
  fsBlock: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  fsBlockLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, color: '#9CA3AF' },
  fsReasonText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: '#6B7280' },
  fsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fsRowLabel: { fontSize: 13, color: '#6B7280' },
  fsRowValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  // Timeline
  fsTlItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fsTlDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  fsTlBody: { flex: 1, paddingTop: 4, paddingBottom: 4 },
  fsTlTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  fsTlSub: { fontSize: 12, color: '#6B7280' },
  fsTlConnector: { width: 2, height: 20, marginLeft: 15, marginVertical: 2, backgroundColor: '#E5E7EB' },
  // Footer
  fsFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  fsCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#00BCD4',
  },
  fsCloseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default ModernScanHistoryScreen;
