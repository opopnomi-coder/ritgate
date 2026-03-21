import React, { useState } from 'react';
import { View } from 'react-native';
import { HR, ScreenName } from '../../types';
import NewHRDashboard from './NewHRDashboard';
import ProfileScreen from '../shared/ProfileScreen';

interface HRDashboardContainerProps {
  hr: HR;
  onLogout: () => void;
  onNavigate: (screen: ScreenName) => void;
}

type InternalTab = 'DASHBOARD' | 'PROFILE';

const HRDashboardContainer: React.FC<HRDashboardContainerProps> = ({
  hr,
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
        user={hr}
        userType="HR"
        onBack={() => setActiveTab('DASHBOARD')}
        onLogout={onLogout}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NewHRDashboard
        hr={hr}
        onLogout={onLogout}
        onNavigate={handleNavigate}
      />
    </View>
  );
};

export default HRDashboardContainer;
