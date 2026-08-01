import { ConfigContext, ExpoConfig } from "expo/config";

const appEnv = process.env.APP_ENV ?? "development";

const apiBaseUrls: Record<string, string> = {
  development: "http://localhost:4000/api/v1",
  preview: "https://api-preview.forumo.app/api/v1",
  production: "https://api.forumo.app/api/v1",
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appEnv === "production" ? "Forumo" : `Forumo (${appEnv})`,
  slug: "forumo-mobile",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "forumo",
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android"],
  assetBundlePatterns: ["**/*"],
  splash: {
    backgroundColor: "#ffffff",
    resizeMode: "contain",
  },
  plugins: [
    "expo-notifications",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
        },
      },
    ],
    ...(process.env.DETOX_ANDROID === "true"
      ? ["./plugins/withDetoxAndroid"]
      : []),
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.forumo.mobile",
    infoPlist: {
      NSCameraUsageDescription: "Used to capture listing photos.",
      NSPhotoLibraryUsageDescription: "Used to attach photos to listings.",
    },
    associatedDomains: ["applinks:forumo.app", "applinks:*.forumo.app"],
  },
  android: {
    package: "app.forumo.mobile",
    permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "forumo" },
          { scheme: "https", host: "*.forumo.app", pathPrefix: "/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  updates: {
    url: "https://u.expo.dev/forumo-mobile",
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    appEnv,
    apiBaseUrl:
      process.env.API_BASE_URL ??
      apiBaseUrls[appEnv] ??
      apiBaseUrls.development,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "",
    },
  },
  experiments: {
    typedRoutes: true,
  },
});
