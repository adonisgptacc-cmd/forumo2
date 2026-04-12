import Constants from 'expo-constants';
import { ForumoApiClient } from '@forumo/shared';

export const createApiClient = (getAccessToken?: () => string | undefined | Promise<string | undefined>) => {
  const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:4000/api/v1';
  return new ForumoApiClient({
    baseUrl,
    getAccessToken,
  });
};
