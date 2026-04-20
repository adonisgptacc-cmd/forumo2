import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { mobileNavigationTheme } from '@forumo/config';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ListingDiscoveryScreen } from '../screens/ListingDiscoveryScreen';
import { MessagingInboxScreen } from '../screens/MessagingInboxScreen';
import { MessageThreadScreen } from '../screens/MessageThreadScreen';
import { AuctionDetailScreen } from '../screens/AuctionDetailScreen';
import { AuctionsTab } from '../screens/AuctionsScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { OrdersTab } from '../screens/OrdersScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { ProfileTab } from '../screens/ProfileScreen';
import { OffersScreen } from '../screens/OffersScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ListingDetailScreen } from '../screens/ListingDetailScreen';
import { WishlistScreen } from '../screens/WishlistScreen';
import { CreateListingScreen } from '../screens/CreateListingScreen';
import { MyListingsScreen } from '../screens/MyListingsScreen';
import { EditListingScreen } from '../screens/EditListingScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';
import { SellerDashboardScreen } from '../screens/SellerDashboardScreen';
import { KYCScreen } from '../screens/KYCScreen';
import { StorefrontScreen } from '../screens/StorefrontScreen';
import { AuthStackParamList, MainStackParamList, MainTabParamList } from './types';
import { useAuth } from '../providers/AuthProvider';

export const navigationRef = createNavigationContainerRef<MainStackParamList>();

const linking = {
  prefixes: ['forumo://', 'https://forumo.app'],
  config: {
    screens: {
      Main: {
        screens: {
          Tabs: {
            screens: {
              Discover: 'discover',
              Auctions: 'auctions',
              Orders: 'orders',
              Inbox: 'inbox',
              Profile: 'profile',
            },
          },
          ListingDetail: 'listing/:listingId',
          AuctionDetail: 'auction/:auctionId',
          OrderDetail: 'order/:orderId',
          Thread: 'messages/:threadId',
          Storefront: 'shop/:slug',
          Notifications: 'notifications',
          Wishlist: 'wishlist',
          Reviews: 'reviews/:sellerId',
        },
      },
    },
  },
};

const Stack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

// Simple icon helper (text-based, no icon library required)
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Discover: '🔍',
    Auctions: '⚡',
    Orders: '📦',
    Inbox: '💬',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

const MainTabs = () => {
  const { apiClient, accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const fetch = async () => {
      try {
        const data = await apiClient.notifications.unreadCount();
        setUnreadCount(data.count ?? 0);
      } catch {
        // silently ignore — badge just won't show
      }
    };
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [apiClient, accessToken]);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: true,
      })}
    >
      <Tabs.Screen
        name="Discover"
        component={ListingDiscoveryScreen}
        options={{ title: 'Discover' }}
      />
      <Tabs.Screen
        name="Auctions"
        component={AuctionsTab}
        options={{ title: 'Auctions' }}
      />
      <Tabs.Screen
        name="Orders"
        component={OrdersTab}
        options={{ title: 'Orders' }}
      />
      <Tabs.Screen
        name="Inbox"
        component={MessagingInboxScreen}
        options={{ title: 'Inbox', tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileTab}
        options={{ title: 'Profile' }}
      />
    </Tabs.Navigator>
  );
};

const MainNavigator = () => (
  <MainStack.Navigator>
    <MainStack.Screen
      name="Tabs"
      component={MainTabs}
      options={{ headerShown: false }}
    />
    <MainStack.Screen
      name="Thread"
      component={MessageThreadScreen}
      options={{ title: 'Conversation' }}
    />
    <MainStack.Screen
      name="AuctionDetail"
      component={AuctionDetailScreen}
      options={{ title: 'Auction' }}
    />
    <MainStack.Screen
      name="OrderDetail"
      component={OrderDetailScreen}
      options={{ title: 'Order' }}
    />
    <MainStack.Screen
      name="Cart"
      component={CartScreen}
      options={{ title: 'Cart' }}
    />
    <MainStack.Screen
      name="Checkout"
      component={CheckoutScreen}
      options={{ title: 'Checkout' }}
    />
    <MainStack.Screen
      name="Offers"
      component={OffersScreen}
      options={{ title: 'Offers' }}
    />
    <MainStack.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{ title: 'Notifications' }}
    />
    <MainStack.Screen
      name="ListingDetail"
      component={ListingDetailScreen}
      options={{ title: 'Listing' }}
    />
    <MainStack.Screen
      name="Wishlist"
      component={WishlistScreen}
      options={{ title: 'Wishlist' }}
    />
    <MainStack.Screen
      name="CreateListing"
      component={CreateListingScreen}
      options={{ title: 'New Listing' }}
    />
    <MainStack.Screen
      name="MyListings"
      component={MyListingsScreen}
      options={{ title: 'My Listings' }}
    />
    <MainStack.Screen
      name="EditListing"
      component={EditListingScreen}
      options={{ title: 'Edit Listing' }}
    />
    <MainStack.Screen
      name="Reviews"
      component={ReviewsScreen}
      options={{ title: 'Reviews' }}
    />
    <MainStack.Screen
      name="SellerDashboard"
      component={SellerDashboardScreen}
      options={{ title: 'Seller Dashboard' }}
    />
    <MainStack.Screen
      name="KYC"
      component={KYCScreen}
      options={{ title: 'Identity Verification' }}
    />
    <MainStack.Screen
      name="Storefront"
      component={StorefrontScreen}
      options={{ title: 'Shop' }}
    />
  </MainStack.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={mobileNavigationTheme as Theme}>
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
