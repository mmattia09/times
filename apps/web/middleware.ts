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

  // Optionally lock down open registration (recommended for public deployments
  // once your own account exists): set DISABLE_REGISTRATION=true.
  const registrationDisabled = process.env.DISABLE_REGISTRATION === "true";
  if (registrationDisabled) {
    if (pathname.startsWith("/api/auth/sign-up")) {
      return NextResponse.json({ error: "registration_disabled" }, { status: 403 });
    }
    if (pathname === "/register") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

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
    "/api/auth/sign-up/:path*",
    "/login",
    "/register",
  ],
};
