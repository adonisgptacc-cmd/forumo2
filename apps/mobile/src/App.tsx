import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './providers/AuthProvider';
import { NavigationShell } from './navigation/AppNavigator';
import { usePushNotifications } from './hooks/usePushNotifications';

const AppContent = () => {
  usePushNotifications();
  return <NavigationShell />;
};

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
