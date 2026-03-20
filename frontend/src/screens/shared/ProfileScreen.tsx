import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  StatusBar,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useProfile } from '../../context/ProfileContext';
import { apiService } from '../../services/api';
import ThemePresetSelector from '../../components/ThemePresetSelector';

interface ProfileScreenProps {
  user: any;
  userType: 'STUDENT' | 'STAFF' | 'HOD' | 'HR' | 'SECURITY' | 'student' | 'staff' | 'hod' | 'hr' | 'security';
  onBack: () => void;
  onLogout: () => void;
  showBottomNav?: boolean;
  onTabChange?: (tab: 'HOME' | 'REQUESTS' | 'HISTORY' | 'PROFILE') => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  user, 
  userType, 
  onBack, 
  onLogout,
  showBottomNav = false,
  onTabChange,
}) => {
  const { theme, isDark, toggleTheme, resetTheme } = useTheme();
  const { profileImage, captureImage } = useProfile();

  // Local Profile Data State
  const [profileData, setProfileData] = useState({
    email: user.email || '',
    phone: user.contactNo || user.phone || '',
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ 
    stat1: 0, // approved or active
    stat2: 0, // rejected or exited
    stat3: 0  // pending or total
  });

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (isEditing) {
      setEditPhone(profileData.phone);
      setEditEmail(profileData.email);
    }
  }, [isEditing, profileData]);

  const fetchStats = async () => {
    if (!refreshing) setLoadingStats(true);
    try {
      // Fetch stats based on user type
      if (userType.toUpperCase() === 'SECURITY') {
        const response = await apiService.getActivePersons();
        if (response.success && response.data) {
          const validPersons = response.data.filter((person: any) => 
            person.name && 
            !person.name.startsWith('QR Not Found') && 
            !person.name.includes('Unknown')
          );
          const active = validPersons.filter((p: any) => p.status === 'PENDING').length;
          const exited = validPersons.filter((p: any) => p.status === 'EXITED').length;
          setStats({
            stat1: active,
            stat2: exited,
            stat3: validPersons.length
          });
        }
      } else {
        // Placeholder for other types
        setStats({ stat1: 0, stat2: 0, stat3: 0 });
      }
    } catch (error) {
      console.log('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const pickAvatar = () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => captureImage('camera') },
        { text: 'Choose from Gallery', onPress: () => captureImage('gallery') },
      ]
    );
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(prev => !prev);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setTimeout(() => {
      setSavingProfile(false);
      setProfileData(prev => ({
        ...prev,
        email: editEmail,
        phone: editPhone
      }));
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    }, 1200);
  };

  const getName = () => {
    if ('firstName' in user) return `${user.firstName} ${user.lastName}`;
    if ('staffName' in user) return user.staffName;
    if ('hodName' in user) return user.hodName;
    if ('securityName' in user) return user.securityName;
    if ('name' in user) return user.name;
    return 'User';
  };

  const getRole = () => {
    return userType;
  };

  const getDept = () => {
    if (userType.toUpperCase() === 'SECURITY') {
      return user.gateAssignment || user.gateAssigned || user.shift || 'Main Gate';
    }
    return user.department || 'General';
  };

  const getID = () => {
    return user.regNo || user.staffCode || user.hodCode || user.securityId || '';
  };

  const getInitials = () => {
    const name = getName();
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Back Button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarRing, { borderColor: theme.accent }]}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.avatarText, { color: theme.accent }]}>{getInitials()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.cameraBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}
              onPress={pickAvatar}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.userName, { color: theme.primary }]}>{getName().toUpperCase()}</Text>
          <Text style={[styles.userRole, { color: theme.secondary }]}>
            {getRole()} | Dept: {getDept()}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
          <View style={styles.statItem}>
            {loadingStats ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.stat1}</Text>
            )}
            <Text style={[styles.statLabel, { color: theme.accent }]}>
              {userType.toUpperCase() === 'SECURITY' ? 'ACTIVE' : 'APPROVED'}
            </Text>
          </View>
          <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            {loadingStats ? (
              <ActivityIndicator size="small" color={theme.error} />
            ) : (
              <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.stat2}</Text>
            )}
            <Text style={[styles.statLabel, { color: theme.error }]}>
              {userType.toUpperCase() === 'SECURITY' ? 'EXITED' : 'REJECTED'}
            </Text>
          </View>
          <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            {loadingStats ? (
              <ActivityIndicator size="small" color={theme.warning} />
            ) : (
              <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.stat3}</Text>
            )}
            <Text style={[styles.statLabel, { color: theme.warning }]}>
              {userType.toUpperCase() === 'SECURITY' ? 'TOTAL' : 'PENDING'}
            </Text>
          </View>
        </View>

        {/* Interface Theme Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: theme.text }]}>INTERFACE THEME</Text>
          <TouchableOpacity onPress={resetTheme}>
            <Text style={[styles.resetText, { color: theme.textSecondary }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ThemePresetSelector />

        {/* Personal Information */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: theme.text }]}>PERSONAL INFORMATION</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={[styles.editButton, { color: theme.accent }]}>{isEditing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="card-outline" size={20} color={theme.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>ID</Text>
              <Text style={[styles.infoValue, { color: theme.primary }]}>{getID()}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="mail-outline" size={20} color={theme.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>EMAIL</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.editInput, { color: theme.primary, borderColor: theme.accent, backgroundColor: theme.inputBackground }]}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Enter email"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={[styles.infoValue, { color: theme.primary }]}>{profileData.email || 'N/A'}</Text>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>PHONE</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.editInput, { color: theme.primary, borderColor: theme.accent, backgroundColor: theme.inputBackground }]}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Enter phone"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={[styles.infoValue, { color: theme.primary }]}>{profileData.phone || 'N/A'}</Text>
              )}
            </View>
          </View>

          {isEditing && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.accent }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* App Preferences */}
        <Text style={[styles.sectionHeader, { color: theme.text }]}>APP PREFERENCES</Text>
        <View style={[styles.preferencesCard, { backgroundColor: theme.surface }]}>
          <View style={styles.prefRow}>
            <View style={[styles.prefIconBox, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.accent} />
            </View>
            <Text style={[styles.prefLabel, { color: theme.primary, flex: 1 }]}>Allow Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={'#FFFFFF'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.prefRow}>
            <View style={[styles.prefIconBox, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="moon-outline" size={20} color={theme.accent} />
            </View>
            <Text style={[styles.prefLabel, { color: theme.primary, flex: 1 }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.surface, borderColor: theme.error }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error} style={{ marginRight: 8 }} />
          <Text style={[styles.logoutText, { color: theme.error }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: showBottomNav ? 100 : 40 }} />
      </ScrollView>

      {/* Bottom Navigation for Student */}
      {showBottomNav && onTabChange && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => onTabChange('HOME')}
          >
            <Ionicons name="home-outline" size={24} color="#9CA3AF" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => onTabChange('REQUESTS')}
          >
            <Ionicons name="document-text-outline" size={24} color="#9CA3AF" />
            <Text style={styles.navLabel}>Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => onTabChange('HISTORY')}
          >
            <Ionicons name="time-outline" size={24} color="#9CA3AF" />
            <Text style={styles.navLabel}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => onTabChange('PROFILE')}
          >
            <Ionicons name="person" size={24} color="#1F2937" />
            <Text style={styles.navLabelActive}>Profile</Text>
            <View style={styles.activeIndicator} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: -20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    elevation: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 10,
    marginBottom: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verticalDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  editInput: {
    borderBottomWidth: 1,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 8,
    borderRadius: 4,
    width: '100%',
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
    opacity: 0.5,
  },
  preferencesCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  prefIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  prefLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 30,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  navLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  navLabelActive: {
    fontSize: 12,
    color: '#1F2937',
    marginTop: 4,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 3,
    backgroundColor: '#1F2937',
    borderRadius: 2,
  },
});

export default ProfileScreen;
