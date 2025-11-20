import React from 'react';
import renderer from 'react-test-renderer';
import { NavigationShell } from '../src/navigation/AppNavigator';
import { AuthProvider } from '../src/providers/AuthProvider';

jest.mock('../src/hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));

describe('NavigationShell', () => {
  it('renders the navigation container', () => {
    const tree = renderer
      .create(
        <AuthProvider>
          <NavigationShell />
        </AuthProvider>,
      )
      .toJSON();

    expect(tree).toMatchSnapshot();
  });
});
