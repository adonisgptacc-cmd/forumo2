import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user?: {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string | null;
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    user?: {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string | null;
    };
  }
}
