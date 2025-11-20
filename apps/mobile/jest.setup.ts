import '@testing-library/jest-native/extend-expect';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiBaseUrl: 'http://localhost:3000/api' } },
}));

jest.mock('expo', () => ({
  registerRootComponent: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-token' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn(),
}));
