import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AuthResponse, ForumoApiClient } from "@forumo/shared";
import { createApiClient } from "../api/client";

const STORAGE_KEY = "forumo_session";
const REFRESH_KEY = "forumo_refresh_token";

// Decode the exp claim (ms) from a JWT without a library dependency
function parseTokenExpiry(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const exp = parseTokenExpiry(token);
  return exp !== null && exp <= Date.now();
}

interface AuthContextValue {
  apiClient: ForumoApiClient;
  user?: AuthResponse["user"];
  accessToken?: string;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    phone?: string,
  ) => Promise<void>;
  logout: () => void;
  enterDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [auth, setAuth] = useState<AuthResponse | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const authRef = useRef<AuthResponse | undefined>(auth);
  authRef.current = auth;

  // apiClient is created once; the token getter always reads the current ref
  const apiClient = useMemo(
    () => createApiClient(() => authRef.current?.accessToken),
    [],
  );

  // Restore session from storage on mount, attempting a silent refresh if the
  // access token has expired but a refresh token is still available.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        if (!raw && !refreshToken) return;

        const stored = raw
          ? (JSON.parse(raw) as AuthResponse)
          : ({} as AuthResponse);
        if (refreshToken) stored.refreshToken = refreshToken;

        if (stored.accessToken && !isExpired(stored.accessToken)) {
          setAuth(stored);
          return;
        }

        // Access token is expired — try a silent refresh
        if (refreshToken) {
          try {
            const tokens = await apiClient.auth.refresh(refreshToken);
            const refreshed: AuthResponse = { ...stored, ...tokens };
            setAuth(refreshed);
            if (refreshed.accessToken) {
              await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ ...refreshed, refreshToken: undefined }),
              );
            }
            if (tokens.refreshToken) {
              await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
            }
            return;
          } catch {
            // Refresh failed — fall through to clear storage
          }
        }

        await AsyncStorage.removeItem(STORAGE_KEY);
        await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
      } catch {
        // Storage unavailable on this device — start unauthenticated
      } finally {
        setHydrated(true);
      }
    })();
  }, [apiClient]);

  const persistAuth = useCallback((value: AuthResponse | undefined) => {
    setAuth(value);
    if (value) {
      const { refreshToken, ...rest } = value as AuthResponse & {
        refreshToken?: string;
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest)).catch(() => {});
      if (refreshToken) {
        SecureStore.setItemAsync(REFRESH_KEY, refreshToken).catch(() => {});
      } else {
        SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
      }
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.auth.login({
        identifier: email,
        password,
      });
      if (!("accessToken" in response)) {
        throw new Error(
          "Two-factor authentication must be completed before signing in.",
        );
      }
      persistAuth(response);
    },
    [apiClient, persistAuth],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      await apiClient.auth.register({ name, email, password, phone });
    },
    [apiClient],
  );

  const logout = useCallback(() => persistAuth(undefined), [persistAuth]);

  const enterDemo = useCallback(() => {
    if (!__DEV__) {
      throw new Error("Demo login is only available in development builds");
    }
    const demoId = `demo-${Math.random().toString(36).slice(2, 10)}`;
    persistAuth({
      accessToken: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      refreshToken: `demo-refresh-${Date.now()}`,
      user: {
        id: demoId,
        email: "demo@forumo.test",
        name: "Demo User",
        role: "BUYER",
      },
    } as AuthResponse);
  }, [persistAuth]);

  const value = useMemo(
    () => ({
      apiClient,
      user: auth?.user,
      accessToken: auth?.accessToken,
      hydrated,
      login,
      register,
      logout,
      enterDemo,
    }),
    [
      apiClient,
      auth?.user,
      auth?.accessToken,
      hydrated,
      login,
      register,
      logout,
      enterDemo,
    ],
  );

  if (!hydrated) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
