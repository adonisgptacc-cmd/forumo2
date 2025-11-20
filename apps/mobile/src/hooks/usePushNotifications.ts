import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../providers/AuthProvider';

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
      const tokenResponse = await Notifications.getExpoPushTokenAsync();
      const token = tokenResponse.data;
      await apiClient.notifications.registerExpoPushToken(token);
    };

    register();
  }, [accessToken, apiClient]);
};
