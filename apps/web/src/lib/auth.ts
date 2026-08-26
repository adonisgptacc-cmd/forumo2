import { createHash } from "crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { createApiClient } from "./api-client";

// Mock auth is only allowed in local development — never in production builds
const allowMockAuth =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_API_MOCKS === "true";

// 15-minute access token; refresh 60 s before expiry
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_BEFORE_MS = 60 * 1000;

function deviceFingerprint(userAgent: string | undefined): string {
  return createHash("sha256")
    .update(userAgent ?? "nextauth-server")
    .digest("hex")
    .slice(0, 32);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      id: "token-auth",
      name: "Token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        const api = createApiClient(credentials.token);
        try {
          const auth = await api.auth.me();
          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            role: auth.user.role,
            accessToken: credentials.token,
            refreshToken: undefined,
          } as any;
        } catch {
          return null;
        }
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.identifier || !credentials.password) {
          return null;
        }
        const fingerprint = deviceFingerprint(
          (req?.headers as Record<string, string> | undefined)?.["user-agent"],
        );
        const api = createApiClient();
        try {
          const auth = await api.auth.login({
            identifier: credentials.identifier,
            password: credentials.password,
            deviceFingerprint: fingerprint,
          });
          // 2FA and OAuth-recovery responses are handled by the signin form
          // directly; Credentials provider only completes login for full
          // AuthResponse.
          if (
            "twoFactorRequired" in auth ||
            "twoFactorSetupRequired" in auth ||
            "passwordSetupRequired" in auth
          ) {
            return null;
          }
          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            role: auth.user.role,
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
          } as any;
        } catch (error) {
          if (allowMockAuth) {
            return {
              id: "mock-user",
              email: credentials.identifier,
              name: "Mock Seller",
              role: "SELLER",
              accessToken: "mock-token",
              refreshToken: undefined,
            } as any;
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }): Promise<any> {
      // Initial sign-in: store tokens and set expiry
      if (user) {
        token.user = user;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpiry = Date.now() + ACCESS_TOKEN_TTL_MS;
        return token;
      }

      // Token still valid — return as-is
      const expiry = token.accessTokenExpiry as number | undefined;
      if (expiry && Date.now() < expiry - REFRESH_BEFORE_MS) {
        return token;
      }

      // No refresh token available — force re-login
      const refreshToken = token.refreshToken as string | undefined;
      if (!refreshToken) return null;

      // Silently exchange the refresh token for a new access token
      try {
        const { getApiBaseUrl } = await import("@forumo/shared");
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        if (!response.ok) return null;

        const data = (await response.json()) as {
          accessToken: string;
          refreshToken: string;
        };

        return {
          ...token,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
        };
      } catch {
        return null;
      }
    },
    async session({ session, token }) {
      if (token?.user) {
        session.user = token.user as any;
        session.accessToken = token.accessToken as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
