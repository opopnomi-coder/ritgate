import React, { useState } from 'react';
import { View } from 'react-native';
import { HOD, ScreenName } from '../../types';
import NewHODDashboard from './NewHODDashboard';
import ProfileScreen from '../shared/ProfileScreen';

interface HODDashboardContainerProps {
  hod: HOD;
  onLogout: () => void;
  onNavigate: (screen: ScreenName) => void;
}

type InternalTab = 'DASHBOARD' | 'PROFILE';

const HODDashboardContainer: React.FC<HODDashboardContainerProps> = ({
  hod,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<InternalTab>('DASHBOARD');

  const handleNavigate = (screen: ScreenName) => {
    if (screen === 'PROFILE') {
      setActiveTab('PROFILE');
    } else {
      onNavigate(screen);
    }
  };

  if (activeTab === 'PROFILE') {
    return (
      <ProfileScreen
        user={hod}
        userType="HOD"
        onBack={() => setActiveTab('DASHBOARD')}
        onLogout={onLogout}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NewHODDashboard
        hod={hod}
        onLogout={onLogout}
        onNavigate={handleNavigate}
      />
    </View>
  );
};

export default HODDashboardContainer;
