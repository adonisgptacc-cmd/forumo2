const expoPreset = require("jest-expo/jest-preset");

module.exports = {
  ...expoPreset,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    "^@forumo/shared$": "<rootDir>/../../packages/shared/src",
    "^@forumo/shared/(.*)": "<rootDir>/../../packages/shared/src/$1",
    "^@forumo/config$": "<rootDir>/../../packages/config/src",
    "^@forumo/config/(.*)": "<rootDir>/../../packages/config/src/$1",
    "@react-native/js-polyfills": "<rootDir>/jest.polyfills.mock.ts",
    "react-native-safe-area-context/jest/mock":
      "<rootDir>/jest.safe-area.mock.ts",
    "^expo$": "<rootDir>/jest.expo.mock.ts",
    "^expo/(.*)$": "<rootDir>/jest.expo.mock.ts",
    "^react-native$": "<rootDir>/jest.react-native.mock.ts",
    "^@react-navigation/native$": "<rootDir>/jest.react-navigation.mock.ts",
    "^@react-navigation/native-stack$":
      "<rootDir>/jest.react-navigation.mock.ts",
    "^@react-navigation/bottom-tabs$":
      "<rootDir>/jest.react-navigation.mock.ts",
  },
  transform: {
    ...expoPreset.transform,
    "^.+\\.(js|ts|tsx)$": ["babel-jest", { presets: ["babel-preset-expo"] }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(expo|@expo|expo-modules-core|@react-native|react-native|@react-navigation|@react-native-async-storage)/)",
  ],
  // Deliberately not "<rootDir>/e2e/": Jest resolves <rootDir> tokens in
  // ignore patterns through a path-separator conversion that leaves a
  // backslash unconverted when it precedes a regex-special character (e.g.
  // a dot-prefixed directory like ".claude" in the absolute path), silently
  // breaking this exclusion on Windows checkouts nested under such a path.
  // A rootDir-relative pattern avoids the substitution entirely.
  testPathIgnorePatterns: ["/e2e/"],
};
