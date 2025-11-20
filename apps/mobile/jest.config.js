const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@forumo/shared$': '<rootDir>/../../packages/shared/src',
    '^@forumo/shared/(.*)': '<rootDir>/../../packages/shared/src/$1',
    '@react-native/js-polyfills': '<rootDir>/jest.polyfills.mock.ts',
    'react-native-safe-area-context/jest/mock': '<rootDir>/jest.safe-area.mock.ts',
    '^expo$': '<rootDir>/jest.expo.mock.ts',
    '^expo/(.*)$': '<rootDir>/jest.expo.mock.ts',
    '^react-native$': '<rootDir>/jest.react-native.mock.ts',
    '^@react-navigation/native$': '<rootDir>/jest.react-navigation.mock.ts',
    '^@react-navigation/native-stack$': '<rootDir>/jest.react-navigation.mock.ts',
    '^@react-navigation/bottom-tabs$': '<rootDir>/jest.react-navigation.mock.ts',
  },
  transform: {
    ...expoPreset.transform,
    '^.+\\.(js|ts|tsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|expo-modules-core|@react-native|react-native|@react-navigation)/)',
  ],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
};
