import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../providers/AuthProvider';
import { navigationRef } from '../navigation/AppNavigator';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  const { apiClient, accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;

    const register = async () => {
      if (!Device.isDevice) {
        return;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }
      const tokenResponse = await Notifications.getExpoPushTokenAsync();
      const token = tokenResponse.data;
      await apiClient.notifications.registerExpoPushToken(token);
    };

    const subscription = Notifications.addNotificationReceivedListener((_notification) => {
      // Foreground: the OS won't show a banner automatically — handled by setNotificationHandler above.
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const type = data?.type as string | undefined;
      const id = data?.id as string | undefined;

      if (!navigationRef.isReady()) return;

      if (type === 'message' && id) {
        navigationRef.navigate('Thread', { threadId: id });
      } else if (type === 'order' && id) {
        navigationRef.navigate('OrderDetail', { orderId: id });
      } else if (type === 'auction' && id) {
        navigationRef.navigate('AuctionDetail', { auctionId: id });
      } else if (type === 'listing' && id) {
        navigationRef.navigate('ListingDetail', { listingId: id });
      } else {
        navigationRef.navigate('Notifications', undefined);
      }
    });

    register();

    return () => {
      subscription.remove();
      responseSub.remove();
    };
  }, [accessToken, apiClient]);
};
