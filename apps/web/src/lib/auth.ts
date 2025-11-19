import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { createApiClient } from './api-client';

const allowMockAuth = process.env.NEXT_PUBLIC_USE_API_MOCKS === 'true';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }
        const api = createApiClient();
        try {
          const auth = await api.auth.login({
            email: credentials.email,
            password: credentials.password,
          });
          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            role: auth.user.role,
            accessToken: auth.accessToken,
          } as any;
        } catch (error) {
          if (allowMockAuth) {
            return {
              id: 'mock-user',
              email: credentials.email,
              name: 'Mock Seller',
              role: 'SELLER',
              accessToken: 'mock-token',
            } as any;
          }
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
      }
      return token;
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
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
