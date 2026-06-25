import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route protection:
 *  - /api/auth/*  → public (Better Auth endpoints)
 *  - /api/v1/*    → guarded by API-key middleware inside each handler (skip here)
 *  - other /api/* → require a session cookie
 *  - /dashboard, /sessions, /records, /settings → require a session cookie
 *  - /login, /register → redirect to /dashboard if already signed in
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!getSessionCookie(req);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage) {
    if (hasSession) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // /api/v1 is authenticated per-handler with API keys.
  if (pathname.startsWith("/api/v1")) return NextResponse.next();

  const isProtectedApi = pathname.startsWith("/api/internal") || pathname.startsWith("/api/keys");
  if (isProtectedApi && !hasSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sessions/:path*",
    "/records/:path*",
    "/settings/:path*",
    "/api/internal/:path*",
    "/api/keys/:path*",
    "/login",
    "/register",
  ],
};
