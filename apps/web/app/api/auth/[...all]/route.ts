import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { logEvent, maskEmail, requestIp, type LogEvent } from "@/lib/log";
import { configuredOrigins, trustedOriginsFor } from "@/lib/origins";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/** Credential endpoints that are worth brute-forcing. */
const GUARDED = ["/sign-in", "/sign-up", "/change-password", "/change-email"];

/** What to call the thing that just happened, for the log. */
function eventFor(pathname: string, ok: boolean): LogEvent | null {
  if (pathname.includes("/sign-in")) return ok ? "auth.signin" : "auth.signin.failed";
  if (pathname.includes("/sign-up")) return ok ? "auth.signup" : "auth.signin.failed";
  if (pathname.includes("/sign-out")) return "auth.signout";
  if (pathname.includes("/change-password")) return "auth.password.changed";
  return null;
}

export async function POST(req: Request) {
  const { pathname } = new URL(req.url);
  const ip = requestIp(req);
  const origin = req.headers.get("origin") ?? undefined;
  const guarded = GUARDED.some((p) => pathname.includes(p));

  if (guarded) {
    // 10 attempts per IP per 5 minutes — invisible in normal use, kills
    // credential stuffing against a publicly reachable instance.
    const limit = rateLimit(`auth:${clientIp(req)}`, 10, 5 * 60_000);
    if (!limit.ok) {
      logEvent("auth.ratelimited", { path: pathname, ip, origin });
      return tooManyRequests(limit.retryAfter);
    }
  }

  // Read the email off a clone: the handler needs the request exactly as Next
  // handed it over, and rebuilding one loses the type it expects.
  let email: string | undefined;
  if (guarded) {
    try {
      const parsed = (await req.clone().json()) as { email?: unknown };
      if (typeof parsed.email === "string") email = parsed.email;
    } catch {
      // Not JSON, or no email in it — nothing to name in the log.
    }
  }

  const res = await handlers.POST(req);

  const event = eventFor(pathname, res.ok);
  if (event) {
    logEvent(event, {
      user: email ? maskEmail(email) : undefined,
      ip,
      origin,
      status: res.status,
    });
  }

  // A refused origin is the one failure whose cause isn't obvious from the
  // status, so say what would have been accepted instead.
  if (res.status === 403 && origin && !trustedOriginsFor(req).includes(origin)) {
    logEvent("auth.origin.rejected", {
      origin,
      trusted: configuredOrigins().join(",") || "(none configured)",
      hint: "set BETTER_AUTH_URL to the public URL, or list it in TRUSTED_ORIGINS",
    });
  }

  return res;
}
