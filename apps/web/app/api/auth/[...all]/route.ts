import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/** Credential endpoints that are worth brute-forcing. */
const GUARDED = ["/sign-in", "/sign-up", "/change-password", "/change-email"];

export async function POST(req: Request) {
  const { pathname } = new URL(req.url);
  if (GUARDED.some((p) => pathname.includes(p))) {
    // 10 attempts per IP per 5 minutes — invisible in normal use, kills
    // credential stuffing against a publicly reachable instance.
    const limit = rateLimit(`auth:${clientIp(req)}`, 10, 5 * 60_000);
    if (!limit.ok) return tooManyRequests(limit.retryAfter);
  }
  return handlers.POST(req);
}
