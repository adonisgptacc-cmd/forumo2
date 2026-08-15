import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role as string | undefined;
    if (role !== "ADMIN" && role !== "MODERATOR") {
      return NextResponse.redirect(new URL("/403", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
      error: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!login|403|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
