import { ForumoApiClient } from '@forumo/shared';

export function createApiClient(token?: string) {
  return new ForumoApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1',
    getAccessToken: token ? () => token : undefined,
  });
}
