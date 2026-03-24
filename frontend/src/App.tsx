// CLEAN VERSION OF APP.TSX - Only SmartGate Screens
// This is the corrected version that should replace the current App.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Alert,
  Text,
  BackHandler,
  Animated,
  ToastAndroid,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Student, Staff, HOD, HR, SecurityPersonnel, UserType, UserRole, ScreenName } from './types';
import { offlineStorage } from './services/offlineStorage';
import { professionalTheme } from './styles/professionalTheme';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { ActionLockProvider, useActionLock } from './context/ActionLockContext';

// ✅ ONLY SmartGate Screens
import HomeScreen from './screens/HomeScreen';
import LoadingScreen from './screens/LoadingScreen';
import ModernUnifiedLoginScreen from './screens/auth/ModernUnifiedLoginScreen';
import BiometricGateScreen from './screens/auth/BiometricGateScreen';
import StudentDashboardContainer from './screens/student/StudentDashboardContainer';
import StaffDashboardContainer from './screens/staff/StaffDashboardContainer';
import HODDashboardContainer from './screens/hod/HODDashboardContainer';
import HRDashboardContainer from './screens/hr/HRDashboardContainer';
import HRApprovalScreen from './screens/hr/HRApprovalScreen';
import SecurityDashboardContainer from './screens/security/SecurityDashboardContainer';
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
import SwipeBackWrapper from './components/SwipeBackWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import { initPushNotifications, unregisterPushToken, setupNotificationTapHandler, handleInitialNotification } from './services/pushNotification.service';
import { biometricAuthService } from './services/biometricAuth.service';

// Inner component that can access ThemeContext for transition animation
const ThemedApp: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { transitionOpacity, theme } = useTheme();
  return (
    <Animated.View style={[{ flex: 1, opacity: transitionOpacity }, { backgroundColor: theme.background }]}>
      {children}
    </Animated.View>
  );
};

// Reads isLocked from ActionLockContext to block swipe during API calls
const AppNavigator: React.FC<{
  children: React.ReactNode;
  isRootScreen: boolean;
  isLoading: boolean;
  onBack: () => void;
}> = ({ children, isRootScreen, isLoading, onBack }) => {
  const { isLocked, swipeLocked } = useActionLock();
  return (
    <SwipeBackWrapper
      enabled={!isRootScreen && !isLoading}
      locked={isLocked || swipeLocked}
      onBack={onBack}
    >
      {children}
    </SwipeBackWrapper>
  );
};

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
  const [requiresBiometricGate, setRequiresBiometricGate] = React.useState(false);
  const [biometricVerified, setBiometricVerified] = React.useState(false);
  const [biometricLoading, setBiometricLoading] = React.useState(false);
  const [biometricMessage, setBiometricMessage] = React.useState('');
  const [biometricPrompted, setBiometricPrompted] = React.useState(false);

  // Double-back-to-exit tracking
  const lastBackPress = useRef<number>(0);

  // ── Notification tap → screen navigation ────────────────────────────────
  // Maps actionRoute strings (set by backend) to ScreenName values
  const handleNotificationRoute = React.useCallback((route: string) => {
    if (!route) return;
    const r = route.toLowerCase();
    if (r.includes('my-requests') || r.includes('my_requests')) {
      if (userType === 'STUDENT') setCurrentScreen('REQUESTS');
      else if (userType === 'STAFF') setCurrentScreen('MY_REQUESTS');
      else if (userType === 'HOD') setCurrentScreen('HOD_MY_REQUESTS');
    } else if (r.includes('pending-approvals') || r.includes('pending_approvals')) {
      if (userType === 'STAFF') setCurrentScreen('REQUESTS');
      else if (userType === 'HOD') setCurrentScreen('HOD_DASHBOARD');
      else if (userType === 'HR') setCurrentScreen('HR_DASHBOARD');
    } else if (r.includes('hod/pending') || r.includes('hr/pending')) {
      if (userType === 'HOD') setCurrentScreen('HOD_DASHBOARD');
      else if (userType === 'HR') setCurrentScreen('HR_DASHBOARD');
    }
  }, [userType]);

  // Set up notification tap listener (foreground + background tap)
  React.useEffect(() => {
    const cleanup = setupNotificationTapHandler(handleNotificationRoute);
    return cleanup;
  }, [handleNotificationRoute]);

  // Handle app opened from a notification while it was KILLED
  React.useEffect(() => {
    handleInitialNotification(handleNotificationRoute);
  }, []); // run once on mount

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

  const runBiometricAuth = React.useCallback(async () => {
    setBiometricLoading(true);
    setBiometricMessage('');
    try {
      const result = await biometricAuthService.authenticate();
      if (result.success) {
        setBiometricVerified(true);
      } else {
        setBiometricMessage(result.error || 'Authentication failed');
      }
    } catch {
      setBiometricMessage('Unable to authenticate. Please try again.');
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (requiresBiometricGate && !biometricVerified && !biometricPrompted && !isLoading) {
      setBiometricPrompted(true);
      runBiometricAuth();
    }
  }, [requiresBiometricGate, biometricVerified, biometricPrompted, isLoading, runBiometricAuth]);

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
        const hasFlag = await biometricAuthService.hasSessionFlag();
        setRequiresBiometricGate(hasFlag);
        setBiometricVerified(!hasFlag);
        setIsLoading(false);
        initPushNotifications(savedStudent.regNo, 'student');
        return;
      }

      // Check for saved staff session
      const savedStaff = await offlineStorage.getCurrentStaff();
      if (savedStaff) {
        console.log('✅ Found saved staff session:', savedStaff.staffCode);
        setStaff(savedStaff);
        setUserType('STAFF');
        setCurrentScreen('STAFF_DASHBOARD');
        const hasFlag = await biometricAuthService.hasSessionFlag();
        setRequiresBiometricGate(hasFlag);
        setBiometricVerified(!hasFlag);
        setIsLoading(false);
        initPushNotifications(savedStaff.staffCode, 'staff');
        return;
      }

      // Check for saved HOD session
      const savedHOD = await offlineStorage.getCurrentHOD();
      if (savedHOD) {
        console.log('✅ Found saved HOD session:', savedHOD.hodCode);
        setHod(savedHOD);
        setUserType('HOD');
        setCurrentScreen('HOD_DASHBOARD');
        const hasFlag = await biometricAuthService.hasSessionFlag();
        setRequiresBiometricGate(hasFlag);
        setBiometricVerified(!hasFlag);
        setIsLoading(false);
        initPushNotifications(savedHOD.hodCode, 'hod');
        return;
      }

      // Check for saved HR session
      const savedHR = await offlineStorage.getCurrentHR();
      if (savedHR) {
        console.log('✅ Found saved HR session:', savedHR.hrCode);
        setHr(savedHR);
        setUserType('HR');
        setCurrentScreen('HR_DASHBOARD');
        const hasFlag = await biometricAuthService.hasSessionFlag();
        setRequiresBiometricGate(hasFlag);
        setBiometricVerified(!hasFlag);
        setIsLoading(false);
        initPushNotifications(savedHR.hrCode, 'hr');
        return;
      }

      // Check for saved Security session
      const savedSecurity = await offlineStorage.getCurrentSecurity();
      if (savedSecurity) {
        console.log('✅ Found saved Security session:', savedSecurity.securityId);
        setSecurity(savedSecurity);
        setUserType('SECURITY');
        setCurrentScreen('SECURITY_DASHBOARD');
        const hasFlag = await biometricAuthService.hasSessionFlag();
        setRequiresBiometricGate(hasFlag);
        setBiometricVerified(!hasFlag);
        setIsLoading(false);
        return;
      }

      console.log('ℹ️ No saved user session found - showing home screen');
      setIsLoading(false);
      setCurrentScreen('HOME');
      setRequiresBiometricGate(false);
      setBiometricVerified(false);
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
    setRequiresBiometricGate(false);
    setBiometricVerified(true);
    setBiometricPrompted(false);
    await biometricAuthService.markSessionActive();
    initPushNotifications(studentData.regNo, 'student');
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
    setRequiresBiometricGate(false);
    setBiometricVerified(true);
    setBiometricPrompted(false);
    await biometricAuthService.markSessionActive();
    initPushNotifications(staffData.staffCode, 'staff');
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
    setRequiresBiometricGate(false);
    setBiometricVerified(true);
    setBiometricPrompted(false);
    await biometricAuthService.markSessionActive();
    initPushNotifications(hodData.hodCode, 'hod');
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
    setRequiresBiometricGate(false);
    setBiometricVerified(true);
    setBiometricPrompted(false);
    await biometricAuthService.markSessionActive();
    initPushNotifications(hrData.hrCode, 'hr');
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
    setRequiresBiometricGate(false);
    setBiometricVerified(true);
    setBiometricPrompted(false);
    await biometricAuthService.markSessionActive();
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out user...');
      // Unregister push token before clearing session
      await unregisterPushToken();
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
      setRequiresBiometricGate(false);
      setBiometricVerified(false);
      setBiometricPrompted(false);
      await biometricAuthService.clearSession();
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
      // Never allow back during loading
      if (isLoading) return true;

      // Block back if action lock is active (checked via global ref set by ActionLockProvider)
      if ((global as any).__actionLocked) return true;

      if (currentScreen === 'UNIFIED_LOGIN') {
        goBackToHome();
        return true;
      }

      if (ROOT_SCREENS.includes(currentScreen)) {
        // Double-back-to-exit on root screens
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          return false; // let system exit
        }
        lastBackPress.current = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true;
      }

      navigateBack();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [currentScreen, userType, isLoading]);

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

      if (requiresBiometricGate && !biometricVerified) {
        return (
          <BiometricGateScreen
            loading={biometricLoading}
            message={biometricMessage}
            onRetry={runBiometricAuth}
            onUseLogin={handleLogout}
          />
        );
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
                onBack={navigateBack}
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
              <StaffDashboardContainer
                staff={staff}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
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
                onBack={navigateBack}
              />
            );
          default:
            return (
              <StaffDashboardContainer
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
              <HODDashboardContainer
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
            // Handled internally by HODDashboardContainer
            return (
              <HODDashboardContainer
                hod={hod}
                onLogout={handleLogout}
                onNavigate={navigateToScreen}
              />
            );
          case 'HISTORY':
            return (
              <EntryExitHistoryScreen
                user={hod as any}
                onBack={() => setCurrentScreen('HOD_DASHBOARD')}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={hod.hodCode}
                userType="hod"
                onBack={navigateBack}
              />
            );
          default:
            return (
              <HODDashboardContainer
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
              <HRDashboardContainer
                hr={hr}
                onLogout={handleLogout}
                onNavigate={(screen: ScreenName) => setCurrentScreen(screen)}
              />
            );
          case 'HR_APPROVAL':
            return (
              <HRApprovalScreen
                user={hr as any}
                request={selectedRequest}
                onBack={() => setCurrentScreen('HR_DASHBOARD')}
              />
            );
          case 'NOTIFICATIONS':
            return (
              <NotificationsScreen
                userId={hr.hrCode}
                userType="hr"
                onBack={navigateBack}
              />
            );
          default:
            return (
              <HRDashboardContainer
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
        return (
          <SecurityDashboardContainer
            security={security}
            onLogout={handleLogout}
            onNavigate={navigateToScreen}
          />
        );
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

  const isRootScreen = ROOT_SCREENS.includes(currentScreen) || currentScreen === 'UNIFIED_LOGIN';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider userId={
        student?.regNo ||
        staff?.staffCode ||
        hod?.hodCode ||
        hr?.hrCode ||
        security?.securityId ||
        undefined
      }>
        <ActionLockProvider>
          <NotificationProvider>
            <ProfileProvider>
              <ThemedApp>
                <View style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
                  <StatusBar
                    barStyle="dark-content"
                    backgroundColor="transparent"
                    translucent={true}
                  />
                  <AppNavigator
                    isRootScreen={isRootScreen}
                    isLoading={isLoading}
                    onBack={currentScreen === 'UNIFIED_LOGIN' ? goBackToHome : navigateBack}
                  >
                    <ErrorBoundary fallbackScreen={goBackToHome}>
                      {renderCurrentScreen()}
                    </ErrorBoundary>
                  </AppNavigator>
                </View>
              </ThemedApp>
            </ProfileProvider>
          </NotificationProvider>
        </ActionLockProvider>
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
