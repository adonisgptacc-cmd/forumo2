import React from 'react';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { mobileNavigationTheme } from '@forumo/config';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ListingDiscoveryScreen } from '../screens/ListingDiscoveryScreen';
import { MessagingInboxScreen } from '../screens/MessagingInboxScreen';
import { MessageThreadScreen } from '../screens/MessageThreadScreen';
import { AuthStackParamList, MainStackParamList, MainTabParamList } from './types';
import { useAuth } from '../providers/AuthProvider';

const Stack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

const MainTabs = () => (
  <Tabs.Navigator>
    <Tabs.Screen name="Discover" component={ListingDiscoveryScreen} />
    <Tabs.Screen name="Inbox" component={MessagingInboxScreen} />
  </Tabs.Navigator>
);

const MainNavigator = () => (
  <MainStack.Navigator>
    <MainStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
    <MainStack.Screen name="Thread" component={MessageThreadScreen} options={{ title: 'Conversation' }} />
  </MainStack.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer theme={mobileNavigationTheme as Theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : null}
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export const NavigationShell: React.FC = () => (
  <View style={{ flex: 1 }} testID="navigation-shell">
    <AppNavigator />
  </View>
);
