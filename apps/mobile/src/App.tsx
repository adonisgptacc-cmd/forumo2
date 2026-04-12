import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './providers/AuthProvider';
import { NavigationShell } from './navigation/AppNavigator';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useAuth } from './providers/AuthProvider';
import { cartStore } from './screens/CartScreen';

const AppContent = () => {
  usePushNotifications();
  const { hydrated } = useAuth();
  useEffect(() => { cartStore.hydrate(); }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
