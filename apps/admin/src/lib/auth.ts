import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { ForumoApiClient } from "@forumo/shared";

function createApiClient(token?: string) {
  return new ForumoApiClient({
    baseUrl:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1",
    getAccessToken: token ? () => token : undefined,
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    // Used directly by the login page for email/password. 2FA-mandatory accounts
    // get a twoFactorToken challenge back from api.auth.login() before this can
    // succeed, so the login page handles that case itself (see /login/2fa) and
    // only calls signIn("credentials", ...) when a full AuthResponse comes back.
    CredentialsProvider({
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const api = createApiClient();
        try {
          const auth = await api.auth.login({
            email: credentials.email,
            password: credentials.password,
          });
          if (!("user" in auth) || !("accessToken" in auth)) {
            return null;
          }
          if (auth.user.role !== "ADMIN" && auth.user.role !== "MODERATOR") {
            return null;
          }
          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            role: auth.user.role,
            accessToken: auth.accessToken,
          } as any;
        } catch {
          return null;
        }
      },
    }),
    // Used to finish a login after the /login/2fa flow has already produced a
    // verified access token. Re-checks the role server-side so a non-admin
    // account can never establish a session here even with a valid token.
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
          if (auth.user.role !== "ADMIN" && auth.user.role !== "MODERATOR") {
            return null;
          }
          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            role: auth.user.role,
            accessToken: credentials.token,
          } as any;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        token.accessToken = (user as any).accessToken;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.user) {
        session.user = token.user as any;
        (session as any).accessToken = token.accessToken as string | undefined;
        (session as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
