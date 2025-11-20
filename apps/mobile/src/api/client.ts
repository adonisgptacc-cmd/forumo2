import Constants from 'expo-constants';
import { ForumoApiClient } from '@forumo/shared';

export const createApiClient = (getAccessToken?: () => string | undefined | Promise<string | undefined>) => {
  const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3000/api';
  return new ForumoApiClient({
    baseUrl,
    getAccessToken,
  });
};
