import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { ForumoApiClient, getApiBaseUrl } from "@forumo/shared";

function createApiClient(token?: string) {
  return new ForumoApiClient({
    baseUrl: getApiBaseUrl(),
    getAccessToken: token ? () => token : undefined,
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
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
