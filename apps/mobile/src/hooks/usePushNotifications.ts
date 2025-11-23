import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../providers/AuthProvider';

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

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const type = notification.request.content.data?.type as string | undefined;
      const title = notification.request.content.title ?? 'Inbox update';
      if (type === 'message') {
        Alert.alert(title, 'You have a new message.');
      } else if (type === 'order') {
        Alert.alert(title, 'An order status was updated.');
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type as string | undefined;
      if (type === 'message') {
        Alert.alert('Opening inbox', 'We will take you to your messages when online.');
      }
    });

    register();

    return () => {
      subscription.remove();
      responseSub.remove();
    };
  }, [accessToken, apiClient]);
};
