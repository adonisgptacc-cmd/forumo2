import Constants from "expo-constants";
import { ForumoApiClient } from "@forumo/shared";

export const createApiClient = (
  getAccessToken?: () => string | undefined | Promise<string | undefined>,
) => {
  const baseUrl =
    Constants.expoConfig?.extra?.apiBaseUrl ??
    (() => {
      throw new Error(
        "No API base URL configured. Set apiBaseUrl in app.config.ts extra or via EXPO_PUBLIC_API_BASE_URL environment variable.",
      );
    })();
  return new ForumoApiClient({
    baseUrl,
    getAccessToken,
  });
};
