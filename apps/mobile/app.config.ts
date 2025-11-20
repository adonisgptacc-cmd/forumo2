import { ConfigContext, ExpoConfig } from 'expo/config';
import 'dotenv/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Forumo Mobile',
  slug: 'forumo-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'forumo',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],
  assetBundlePatterns: ['**/*'],
  plugins: ['expo-notifications'],
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
  },
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000/api',
  },
  experiments: {
    typedRoutes: true,
  },
});
