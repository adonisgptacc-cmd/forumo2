import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './providers/AuthProvider';
import { NavigationShell } from './navigation/AppNavigator';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useAuth } from './providers/AuthProvider';
import { cartStore } from './screens/CartScreen';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Rendered only after auth hydration completes so the hook runs with a
// resolved session and doesn't fire during the async restore on startup.
const HydratedContent = () => {
  usePushNotifications();
  return <NavigationShell />;
};

const AppContent = () => {
  const { hydrated } = useAuth();
  useEffect(() => { cartStore.hydrate(); }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <HydratedContent />;
};

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
