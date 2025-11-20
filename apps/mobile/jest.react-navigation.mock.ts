import React from 'react';

const createNavigator = () => {
  const Navigator: React.FC<React.PropsWithChildren> = ({ children }) => React.createElement('div', null, children);
  const Screen: React.FC<React.PropsWithChildren<{ name: string; component: React.ComponentType<any> }>> = ({ children }) =>
    React.createElement('div', null, children);
  return { Navigator, Screen } as const;
};

export const NavigationContainer: React.FC<React.PropsWithChildren> = ({ children }) =>
  React.createElement('div', { 'data-testid': 'mock-navigation-container' }, children);
export const DefaultTheme = {};
export const createNativeStackNavigator = () => createNavigator();
export const createBottomTabNavigator = () => createNavigator();
export const useNavigation = () => ({ navigate: jest.fn(), replace: jest.fn() });
