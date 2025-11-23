import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth?.token as any)?.user?.role as string | undefined;

    if (req.nextUrl.pathname.startsWith('/admin')) {
      const allowedRoles = ['ADMIN', 'MODERATOR'];
      if (!role) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      if (!allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export const config = {
  matcher: ['/admin/:path*'],
};
