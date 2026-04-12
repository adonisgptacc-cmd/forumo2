import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse, ForumoApiClient } from '@forumo/shared';
import { createApiClient } from '../api/client';

const AUTH_STORAGE_KEY = '@forumo/auth';

interface AuthContextValue {
  apiClient: ForumoApiClient;
  user?: AuthResponse['user'];
  accessToken?: string;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  enterDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [auth, setAuth] = useState<AuthResponse | undefined>();
  const [hydrated, setHydrated] = useState(false);
  // Use a ref so the token getter always reads the latest value without recreating apiClient
  const authRef = useRef<AuthResponse | undefined>(auth);
  authRef.current = auth;

  // Rehydrate auth from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setAuth(JSON.parse(raw) as AuthResponse);
          } catch {
            // corrupted storage — ignore
          }
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const persistAuth = useCallback((value: AuthResponse | undefined) => {
    setAuth(value);
    if (value) {
      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value)).catch(() => {});
    } else {
      AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
    }
  }, []);

  // apiClient is created once; the token getter always reads the current ref
  const apiClient = useMemo(
    () => createApiClient(() => authRef.current?.accessToken),
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.auth.login({ email, password });
      persistAuth(response);
    },
    [apiClient, persistAuth],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      const response = await apiClient.auth.register({ name, email, password, phone });
      persistAuth(response);
    },
    [apiClient, persistAuth],
  );

  const logout = useCallback(() => persistAuth(undefined), [persistAuth]);

  const enterDemo = useCallback(() => {
    persistAuth({
      accessToken: 'demo-access-token',
      user: {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'demo@forumo.test',
        name: 'Demo User',
        role: 'BUYER',
      },
    });
  }, [persistAuth]);

  const value = useMemo(
    () => ({ apiClient, user: auth?.user, accessToken: auth?.accessToken, hydrated, login, register, logout, enterDemo }),
    [apiClient, auth?.user, auth?.accessToken, hydrated, login, register, logout, enterDemo],
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
