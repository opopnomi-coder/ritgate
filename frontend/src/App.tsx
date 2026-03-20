// CLEAN VERSION OF APP.TSX - Only SmartGate Screens
// This is the corrected version that should replace the current App.tsx

import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Alert,
  Text,
  BackHandler,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Student, Staff, HOD, HR, SecurityPersonnel, UserType, UserRole, ScreenName } from './types';
import { offlineStorage } from './services/offlineStorage';
import { professionalTheme } from './styles/professionalTheme';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';

// ✅ ONLY SmartGate Screens
import HomeScreen from './screens/HomeScreen';
import LoadingScreen from './screens/LoadingScreen';
import ModernUnifiedLoginScreen from './screens/auth/ModernUnifiedLoginScreen';
import StudentDashboardContainer from './screens/student/StudentDashboardContainer';
import NewStaffDashboard from './screens/staff/NewStaffDashboard';
import NewHODDashboard from './screens/hod/NewHODDashboard';
import NewHRDashboard from './screens/hr/NewHRDashboard';
import HRApprovalScreen from './screens/hr/HRApprovalScreen';
import NewSecurityDashboard from './screens/security/NewSecurityDashboard';
import ModernQRScannerScreen from './screens/security/ModernQRScannerScreen';
import ModernScanHistoryScreen from './screens/security/ModernScanHistoryScreen';
import ModernVisitorRegistrationScreen from './screens/security/ModernVisitorRegistrationScreen';
import SecurityVisitorQRScreen from './screens/security/SecurityVisitorQRScreen';
import ModernVehicleRegistrationScreen from './screens/security/ModernVehicleRegistrationScreen';
import ModernHODContactsScreen from './screens/security/ModernHODContactsScreen';
import ProfileScreen from './screens/shared/ProfileScreen';
import EntryExitHistoryScreen from './screens/student/EntryExitHistoryScreen';
import GatePassRequestScreen from './screens/student/GatePassRequestScreen';
import MyQRCodesScreen from './screens/student/MyQRCodesScreen';
import RequestsScreen from './screens/student/RequestsScreen';
import PendingApprovalsScreen from './screens/staff/PendingApprovalsScreen';
import HODGatePassRequestScreen from './screens/hod/HODGatePassRequestScreen';
import HODMyRequestsScreen from './screens/hod/HODMyRequestsScreen';
import HODBulkGatePassScreen from './screens/hod/HODBulkGatePassScreen';
// ✅ NEW Modern Staff Screens
import ModernBulkGatePassScreen from './screens/staff/ModernBulkGatePassScreen';
import MyRequestsScreen from './screens/staff/MyRequestsScreen';
import NotificationsScreen from './screens/shared/NotificationsScreen';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [student, setStudent] = React.useState<Student | null>(null);
  const [staff, setStaff] = React.useState<Staff | null>(null);
  const [hod, setHod] = React.useState<HOD | null>(null);
  const [hr, setHr] = React.useState<HR | null>(null);
  const [selectedRequest, setSelectedRequest] = React.useState<any>(null);
  const [security, setSecurity] = React.useState<SecurityPersonnel | null>(null);
  const [currentScreen, setCurrentScreen] = React.useState<ScreenName>('HOME');
  const [userType, setUserType] = React.useState<UserType | null>(null);

  React.useEffect(() => {
    console.log('🚀 App mounted - starting initialization');

    const minLoadingTime = setTimeout(() => {
      console.log('⏱️ Minimum loading time reached');
    }, 500);

    const maxTimeout = setTimeout(() => {
      console.log('⚠️ Maximum loading timeout - forcing home screen');
      setIsLoading(false);
      setCurrentScreen('HOME');
    }, 3000);

    checkAuthStatus().finally(() => {
      clearTimeout(minLoadingTime);
      clearTimeout(maxTimeout);
    });

    return () => {
      clearTimeout(minLoadingTime);
      clearTimeout(maxTimeout);
    };
  }, []);

  const checkAuthStatus = async () => {
    console.log('🔍 Starting auth check...');
    try {
      // Check for saved student session
      const savedStudent = await offlineStorage.getCurrentStudent();
      if (savedStudent) {
        console.log('✅ Found saved student session:', savedStudent.regNo);
        setStudent(savedStudent);
        setUserType('STUDENT');
        setCurrentScreen('DASHBOARD');
        setIsLoading(false);
        return;
      }

      // Check for saved staff session
      const savedStaff = await offlineStorage.getCurrentStaff();
      if (savedStaff) {
        console.log('✅ Found saved staff session:', savedStaff.staffCode);
        setStaff(savedStaff);
        setUserType('STAFF');
        setCurrentScreen('STAFF_DASHBOARD');
        setIsLoading(false);
        return;
      }

      // Check for saved HOD session
      const savedHOD = await offlineStorage.getCurrentHOD();
      if (savedHOD) {
        console.log('✅ Found saved HOD session:', savedHOD.hodCode);
        setHod(savedHOD);
        setUserType('HOD');
        setCurrentScreen('HOD_DASHBOARD');
        setIsLoading(false);
        return;
      }

      // Check for saved HR session
      const savedHR = await offlineStorage.getCurrentHR();
      if (savedHR) {
        console.log('✅ Found saved HR session:', savedHR.hrCode);
        setHr(savedHR);
        setUserType('HR');
        setCurrentScreen('HR_DASHBOARD');
        setIsLoading(false);
        return;
      }

      // Check for saved Security session
      const savedSecurity = await offlineStorage.getCurrentSecurity();
      if (savedSecurity) {
        console.log('✅ Found saved Security session:', savedSecurity.securityId);
        setSecurity(savedSecurity);
        setUserType('SECURITY');
        setCurrentScreen('SECURITY_DASHBOARD');
        setIsLoading(false);
        return;
      }

      console.log('ℹ️ No saved user session found - showing home screen');
      setIsLoading(false);
      setCurrentScreen('HOME');
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setIsLoading(false);
      setCurrentScreen('HOME');
    }
  };

  const handleUserTypeSelection = (selectedUserType: UserType) => {
    console.log('🔄 User type selected:', selectedUserType);
    setStudent(null);
    setStaff(null);
    setHod(null);
    setUserType(null);
    setCurrentScreen('HOME');

    setTimeout(() => {
      console.log('🚀 Navigating to UNIFIED_LOGIN');
      setCurrentScreen('UNIFIED_LOGIN');
    }, 50);
  };

  const handleStudentLogin = async (studentData: Student) => {
    console.log('🎓 Student login successful:', studentData.regNo);
    try {
      await offlineStorage.saveCurrentStudent(studentData);
      console.log('✅ Student data saved to storage');
    } catch (error) {
      console.error('❌ Failed to save student data:', error);
    }
    setStudent(studentData);
    setUserType('STUDENT');
    setCurrentScreen('DASHBOARD');
  };

  const handleStaffLogin = async (staffData: Staff) => {
    console.log('👨‍💼 Staff login successful:', staffData.staffCode);
    try {
      await offlineStorage.storeStaffData(staffData);
      console.log('✅ Staff data saved to storage');
    } catch (error) {
      console.error('❌ Failed to save staff data:', error);
    }
    setStaff(staffData);
    setUserType('STAFF');
    setCurrentScreen('STAFF_DASHBOARD');
  };

  const handleHODLogin = async (hodData: HOD) => {
    console.log('🏛️ HOD login successful:', hodData.hodCode);
    try {
      await offlineStorage.saveCurrentHOD(hodData);
      console.log('✅ HOD data saved to storage');
    } catch (error) {
      console.error('❌ Failed to save HOD data:', error);
    }
    setHod(hodData);
    setUserType('HOD');
    setCurrentScreen('HOD_DASHBOARD');
  };

  const handleHRLogin = async (hrData: HR) => {
    console.log('👥 HR login successful:', hrData.hrCode);
    try {
      await offlineStorage.saveCurrentHR(hrData);
      console.log('✅ HR data saved to storage');
    } catch (error) {
      console.error('❌ Failed to save HR data:', error);
    }
    setHr(hrData);
    setUserType('HR');
    setCurrentScreen('HR_DASHBOARD');
  };

  const handleSecurityLogin = async (securityData: SecurityPersonnel) => {
    console.log('🛡️ Security login successful:', securityData.securityId);
    try {
      await offlineStorage.saveCurrentSecurity(securityData);
      console.log('✅ Security data saved to storage');
    } catch (error) {
      console.error('❌ Failed to save Security data:', error);
    }
    setSecurity(securityData);
    setUserType('SECURITY');
    setCurrentScreen('SECURITY_DASHBOARD');
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out user...');
      // Clear all user sessions
      await offlineStorage.clearCurrentStudent();
      await offlineStorage.clearCurrentStaff();
      await offlineStorage.clearCurrentHOD();
      await offlineStorage.clearCurrentHR();
      await offlineStorage.clearCurrentSecurity();
      
      // Reset all state
      setStudent(null);
      setStaff(null);
      setHod(null);
      setHr(null);
      setSecurity(null);
      setUserType(null);
      setCurrentScreen('HOME');
      console.log('✅ Logout completed - all sessions cleared');
    } catch (error) {
      console.log('❌ Error during logout:', error);
    }
  };

  const navigateToScreen = (screen: ScreenName) => {
    console.log(`🚀 Navigating to screen: ${screen}`);
    setCurrentScreen(screen);
  };

  const navigateBack = () => {
    if (userType === 'STUDENT') {
      setCurrentScreen('DASHBOARD');
    } else if (userType === 'STAFF') {
      setCurrentScreen('STAFF_DASHBOARD');
    } else if (userType === 'HOD') {
      setCurrentScreen('HOD_DASHBOARD');
    } else if (userType === 'HR') {
      setCurrentScreen('HR_DASHBOARD');
    } else if (userType === 'SECURITY') {
      setCurrentScreen('SECURITY_DASHBOARD');
    } else {
      setCurrentScreen('HOME');
    }
  };

  // ── Hardware back button / gesture back ──────────────────────────────────
  const ROOT_SCREENS: ScreenName[] = [
    'HOME', 'DASHBOARD', 'STAFF_DASHBOARD', 'HOD_DASHBOARD',
    'HR_DASHBOARD', 'SECURITY_DASHBOARD',
  ];

  React.useEffect(() => {
    const onBackPress = () => {
      if (currentScreen === 'UNIFIED_LOGIN') {
        goBackToHome();
        return true;
      }
      if (ROOT_SCREENS.includes(currentScreen)) {
        return false; // let system handle (exits app)
      }
      navigateBack();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [currentScreen, userType]);

  const goBackToHome = () => {
    setUserType(null);
    setCurrentScreen('HOME');
  };

  const renderCurrentScreen = () => {
    console.log(`📱 RENDER: screen=${currentScreen}, userType=${userType}, isLoading=${isLoading}`);

    try {
      // Show loading screen
      if (isLoading) {
        return <LoadingScreen />;
      }

      // Handle unified login screen
      if (currentScreen === 'UNIFIED_LOGIN') {
        console.log('🔐 Rendering ModernUnifiedLoginScreen');
        return (
          <ModernUnifiedLoginScreen
            onLoginSuccess={(user: any, role: UserRole) => {
              if (role === 'STUDENT') handleStudentLogin(user);
              else if (role === 'STAFF') handleStaffLogin(user);
              else if (role === 'HOD') handleHODLogin(user);
              else if (role === 'HR') handleHRLogin(user);
              else if (role === 'SECURITY') handleSecurityLogin(user);
            }}
            onBack={goBackToHome}
          />
        );
      }

      // Handle authenticated student screens
      if (userType === 'STUDENT' && student) {
        switch (currentScreen) {
          case 'DASHBOARD':
            return (
              <StudentDashboardContainer
                student={student}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
          case 'PROFILE':
            return (
              <ProfileScreen
                user={student}
                userType="STUDENT"
                onBack={navigateBack}
                onLogout={handleLogout}
              />
            );
          case 'HISTORY':
            return (
              <EntryExitHistoryScreen 
                user={student} 
                onBack={() => setCurrentScreen('DASHBOARD')}
              />
            );
          case 'REQUESTS':
            return (
              <RequestsScreen 
                user={student} 
                onBack={() => setCurrentScreen('DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'NEW_PASS_REQUEST':
            if (!student) {
              console.log('⚠️ Student is null in NEW_PASS_REQUEST, redirecting to dashboard');
              setTimeout(() => setCurrentScreen('DASHBOARD'), 0);
              return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                  <Text style={{ color: '#666' }}>Loading...</Text>
                </View>
              );
            }
            console.log('✅ Rendering GatePassRequestScreen with student:', student.regNo);
            return (
              <GatePassRequestScreen 
                user={student} 
                onBack={() => setCurrentScreen('DASHBOARD')}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={student.regNo}
                userType="student"
              />
            );
          default:
            return (
              <StudentDashboardContainer
                student={student}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
        }
      }

      // Handle unauthenticated student - redirect to unified login
      if (userType === 'STUDENT' && !student) {
        console.log('🎓 Student not authenticated - showing UnifiedLoginScreen');
        return (
          <ModernUnifiedLoginScreen
            onLoginSuccess={(user: any, role: UserRole) => {
              if (role === 'STUDENT') handleStudentLogin(user);
              else if (role === 'STAFF') handleStaffLogin(user);
              else if (role === 'HOD') handleHODLogin(user);
              else if (role === 'HR') handleHRLogin(user);
              else if (role === 'SECURITY') handleSecurityLogin(user);
            }}
            onBack={goBackToHome}
          />
        );
      }

      // Handle authenticated staff screens
      if (userType === 'STAFF' && staff) {
        switch (currentScreen) {
          case 'STAFF_DASHBOARD':
            return (
              <NewStaffDashboard
                staff={staff}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
          case 'PROFILE':
            return (
              <ProfileScreen
                user={staff}
                userType="STAFF"
                onBack={navigateBack}
                onLogout={handleLogout}
              />
            );
          case 'HISTORY':
            return (
              <EntryExitHistoryScreen 
                user={staff as any} 
                onBack={() => setCurrentScreen('STAFF_DASHBOARD')}
              />
            );
          case 'REQUESTS':
            return (
              <PendingApprovalsScreen 
                user={staff} 
                onBack={() => setCurrentScreen('STAFF_DASHBOARD')}
              />
            );
          case 'NEW_PASS_REQUEST':
            if (!staff) {
              console.log('⚠️ Staff is null in NEW_PASS_REQUEST, redirecting to dashboard');
              setTimeout(() => setCurrentScreen('STAFF_DASHBOARD'), 0);
              return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                  <Text style={{ color: '#666' }}>Loading...</Text>
                </View>
              );
            }
            console.log('✅ Rendering GatePassRequestScreen with staff:', staff.staffCode);
            return (
              <GatePassRequestScreen 
                user={staff as any} 
                onBack={() => setCurrentScreen('STAFF_DASHBOARD')}
              />
            );
          case 'STAFF_BULK_GATE_PASS':
            return (
              <ModernBulkGatePassScreen 
                user={staff} 
                onBack={() => setCurrentScreen('STAFF_DASHBOARD')}
              />
            );
          case 'MY_REQUESTS':
            return (
              <MyRequestsScreen 
                user={staff} 
                onBack={() => setCurrentScreen('STAFF_DASHBOARD')}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={staff.staffCode}
                userType="staff"
              />
            );
          default:
            return (
              <NewStaffDashboard
                staff={staff}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
        }
      }

      // Handle unauthenticated staff - redirect to unified login
      if (userType === 'STAFF' && !staff) {
        console.log('👨‍💼 Staff not authenticated - showing UnifiedLoginScreen');
        return (
          <ModernUnifiedLoginScreen
            onLoginSuccess={(user: any, role: UserRole) => {
              if (role === 'STUDENT') handleStudentLogin(user);
              else if (role === 'STAFF') handleStaffLogin(user);
              else if (role === 'HOD') handleHODLogin(user);
              else if (role === 'HR') handleHRLogin(user);
              else if (role === 'SECURITY') handleSecurityLogin(user);
            }}
            onBack={goBackToHome}
          />
        );
      }

      // Handle authenticated HOD screens
      if (userType === 'HOD' && hod) {
        switch (currentScreen) {
          case 'HOD_DASHBOARD':
            return (
              <NewHODDashboard
                hod={hod}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
          case 'HOD_GATE_PASS_REQUEST':
            return (
              <HODGatePassRequestScreen
                user={hod}
                onBack={() => navigateToScreen('HOD_DASHBOARD')}
              />
            );
          case 'HOD_BULK_GATE_PASS':
            return (
              <HODBulkGatePassScreen
                user={hod}
                onBack={() => navigateToScreen('HOD_DASHBOARD')}
              />
            );
          case 'HOD_MY_REQUESTS':
            return (
              <HODMyRequestsScreen
                user={hod}
                onBack={() => navigateToScreen('HOD_DASHBOARD')}
              />
            );
          case 'PROFILE':
            return (
              <ProfileScreen
                user={hod}
                userType="HOD"
                onBack={navigateBack}
                onLogout={handleLogout}
              />
            );
          case 'HISTORY':
            return (
              <EntryExitHistoryScreen 
                user={hod as any} 
                onBack={() => setCurrentScreen('DASHBOARD')}
              />
            );
          case 'REQUESTS':
            // Redirect to dashboard - requests are shown there
            return (
              <NewHODDashboard
                hod={hod}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={hod.hodCode}
                userType="hod"
              />
            );
          default:
            return (
              <NewHODDashboard
                hod={hod}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
        }
      }

      // Handle authenticated HR screens
      if (userType === 'HR' && hr) {
        switch (currentScreen) {
          case 'HR_DASHBOARD':
            return (
              <NewHRDashboard
                hr={hr}
                onLogout={handleLogout}
                onNavigate={(screen: ScreenName) => setCurrentScreen(screen)}
              />
            );
          case 'HR_APPROVAL':
            return (
              <HRApprovalScreen
                user={hr as any}
              />
            );
          case 'PROFILE':
            return (
              <ProfileScreen
                user={hr}
                userType="HR"
                onBack={navigateBack}
                onLogout={handleLogout}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={hr.hrCode}
                userType="hr"
              />
            );
          default:
            return (
              <NewHRDashboard
                hr={hr}
                onLogout={handleLogout}
                onNavigate={(screen: ScreenName) => setCurrentScreen(screen)}
              />
            );
        }
      }

      // Handle unauthenticated HOD - redirect to unified login
      if (userType === 'HOD' && !hod) {
        console.log('🏛️ HOD not authenticated - showing UnifiedLoginScreen');
        return (
          <ModernUnifiedLoginScreen
            onLoginSuccess={(user: any, role: UserRole) => {
              if (role === 'STUDENT') handleStudentLogin(user);
              else if (role === 'STAFF') handleStaffLogin(user);
              else if (role === 'HOD') handleHODLogin(user);
              else if (role === 'HR') handleHRLogin(user);
              else if (role === 'SECURITY') handleSecurityLogin(user);
            }}
            onBack={goBackToHome}
          />
        );
      }

      // Handle authenticated Security screens
      if (userType === 'SECURITY' && security) {
        switch (currentScreen) {
          case 'SECURITY_DASHBOARD':
            console.log('🛡️ Rendering NewSecurityDashboard for:', security.securityId);
            return (
              <NewSecurityDashboard
                user={security}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
          case 'QR_SCANNER':
            return (
              <ModernQRScannerScreen
                security={security}
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'VISITOR_REGISTRATION':
            return (
              <ModernVisitorRegistrationScreen
                security={security}
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'VISITOR_QR':
            return (
              <SecurityVisitorQRScreen
                security={security}
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'VEHICLE_REGISTRATION':
            return (
              <ModernVehicleRegistrationScreen
                security={security}
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'SCAN_HISTORY':
            return (
              <ModernScanHistoryScreen
                security={security}
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'HOD_CONTACTS':
            return (
              <ModernHODContactsScreen
                security={security}
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onNavigate={navigateToScreen}
              />
            );
          case 'PROFILE':
            return (
              <ProfileScreen
                user={security}
                userType="SECURITY"
                onBack={() => setCurrentScreen('SECURITY_DASHBOARD')}
                onLogout={handleLogout}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={security.securityId}
                userType="security"
              />
            );
          default:
            return (
              <NewSecurityDashboard
                user={security}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
        }
      }

      // Handle unauthenticated Security - redirect to unified login
      if (userType === 'SECURITY' && !security) {
        console.log('🛡️ Security not authenticated - showing UnifiedLoginScreen');
        return (
          <ModernUnifiedLoginScreen
            onLoginSuccess={(user: any, role: UserRole) => {
              if (role === 'STUDENT') handleStudentLogin(user);
              else if (role === 'STAFF') handleStaffLogin(user);
              else if (role === 'HOD') handleHODLogin(user);
              else if (role === 'HR') handleHRLogin(user);
              else if (role === 'SECURITY') handleSecurityLogin(user);
            }}
            onBack={goBackToHome}
          />
        );
      }

      // Handle home screen
      if (currentScreen === 'HOME' || !userType) {
        console.log('🏠 Rendering HomeScreen');
        return <HomeScreen onSelectUserType={handleUserTypeSelection} />;
      }

      // Default fallback
      console.log('📱 Rendering HomeScreen (default fallback)');
      return <HomeScreen onSelectUserType={handleUserTypeSelection} />;
    } catch (error) {
      console.error('❌ Error in renderCurrentScreen:', error);
      return (
        <View style={styles.errorContainer}>
          <Text style={{ color: 'red', fontSize: 18, marginBottom: 20 }}>
            Error Loading Screen
          </Text>
          <Text style={{ color: '#666', textAlign: 'center' }}>
            {String(error)}
          </Text>
        </View>
      );
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NotificationProvider>
          <ProfileProvider>
            <View style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
              <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent={true}
              />
              {renderCurrentScreen()}
            </View>
          </ProfileProvider>
        </NotificationProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: professionalTheme.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
});

export default App;
