import React, { useState } from 'react';
import { View } from 'react-native';
import { Staff, ScreenName } from '../../types';
import NewStaffDashboard from './NewStaffDashboard';
import ProfileScreen from '../shared/ProfileScreen';

interface StaffDashboardContainerProps {
  staff: Staff;
  onLogout: () => void;
  onNavigate: (screen: ScreenName) => void;
}

type InternalTab = 'DASHBOARD' | 'PROFILE';

const StaffDashboardContainer: React.FC<StaffDashboardContainerProps> = ({
  staff,
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
        user={staff}
        userType="STAFF"
        onBack={() => setActiveTab('DASHBOARD')}
        onLogout={onLogout}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NewStaffDashboard
        staff={staff}
        onLogout={onLogout}
        onNavigate={handleNavigate}
      />
    </View>
  );
};

export default StaffDashboardContainer;
