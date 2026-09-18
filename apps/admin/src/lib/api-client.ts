import { ForumoApiClient, getApiBaseUrl } from "@forumo/shared";

export function createApiClient(token?: string) {
  return new ForumoApiClient({
    baseUrl: getApiBaseUrl(),
    getAccessToken: token ? () => token : undefined,
  });
}
