import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route protection (Next 16 "proxy", formerly middleware):
 *  - /api/auth/*  → public (Better Auth endpoints)
 *  - /api/v1/*    → guarded by API-key auth inside each handler (skip here)
 *  - other /api/* → require a session cookie
 *  - app pages    → require a session cookie
 *  - /login, /register → always reachable (DB-validated redirect lives in the (auth) layout)
 */
export function proxy(req: NextRequest) {
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

  // Auth pages are always reachable. The "already signed in → dashboard" redirect
  // lives in the (auth) layout, which validates the session against the DB — the
  // middleware only sees cookie *presence*, and a stale cookie (e.g. after a DB
  // reset) would otherwise cause an infinite /login ↔ /dashboard redirect loop.
  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage) return NextResponse.next();

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
    "/workouts/:path*",
    "/records/:path*",
    "/settings/:path*",
    "/api/internal/:path*",
    "/api/keys/:path*",
    "/api/auth/sign-up/:path*",
    "/login",
    "/register",
  ],
};
