import "@testing-library/jest-native/extend-expect";
import mockSafeAreaContext from "./jest.safe-area.mock";

jest.mock("react-native-safe-area-context", () => mockSafeAreaContext);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    clear: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    getItem: jest.fn().mockResolvedValue(null),
    mergeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiMerge: jest.fn().mockResolvedValue(undefined),
    multiRemove: jest.fn().mockResolvedValue(undefined),
    multiSet: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("expo-constants", () => ({
  expoConfig: { extra: { apiBaseUrl: "http://localhost:3000/api" } },
}));

jest.mock("expo", () => ({
  registerRootComponent: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "mock-token" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  setNotificationChannelAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: true, assets: [] }),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
}));

jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));
