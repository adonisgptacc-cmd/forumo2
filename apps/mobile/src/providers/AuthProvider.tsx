import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AuthResponse, ForumoApiClient } from '@forumo/shared';
import { createApiClient } from '../api/client';

interface AuthContextValue {
  apiClient: ForumoApiClient;
  user?: AuthResponse['user'];
  accessToken?: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  enterDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [auth, setAuth] = useState<AuthResponse | undefined>();

  const apiClient = useMemo(
    () =>
      createApiClient(() => {
        return auth?.accessToken;
      }),
    [auth?.accessToken],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.auth.login({ email, password });
      setAuth(response);
    },
    [apiClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      const response = await apiClient.auth.register({ name, email, password, phone });
      setAuth(response);
    },
    [apiClient],
  );

  const logout = useCallback(() => setAuth(undefined), []);

  const enterDemo = useCallback(() => {
    setAuth({
      accessToken: 'demo-access-token',
      user: {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'demo@forumo.test',
        name: 'Demo User',
        role: 'BUYER',
      },
    });
  }, []);

  const value = useMemo(
    () => ({ apiClient, user: auth?.user, accessToken: auth?.accessToken, login, register, logout, enterDemo }),
    [apiClient, auth?.user, auth?.accessToken, login, register, logout, enterDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return value;
};
