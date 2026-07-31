import React from "react";

const createNavigator = () => {
  const Navigator: React.FC<React.PropsWithChildren> = ({ children }) =>
    React.createElement("div", null, children);
  const Screen: React.FC<
    React.PropsWithChildren<{
      name: string;
      component: React.ComponentType<any>;
    }>
  > = ({ children }) => React.createElement("div", null, children);
  return { Navigator, Screen } as const;
};

export const NavigationContainer = React.forwardRef<
  unknown,
  React.PropsWithChildren
>(({ children }, _ref) =>
  React.createElement(
    "div",
    { "data-testid": "mock-navigation-container" },
    children,
  ),
);
NavigationContainer.displayName = "NavigationContainer";
export const DefaultTheme = {};
export const createNavigationContainerRef = () => ({
  current: null,
  dispatch: jest.fn(),
  getCurrentOptions: jest.fn(),
  getCurrentRoute: jest.fn(),
  getRootState: jest.fn(),
  isReady: jest.fn(() => true),
  navigate: jest.fn(),
  resetRoot: jest.fn(),
});
export const createNativeStackNavigator = () => createNavigator();
export const createBottomTabNavigator = () => createNavigator();
export const useNavigation = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
});
