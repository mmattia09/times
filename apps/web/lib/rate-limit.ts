import { withRedis } from "@/lib/redis";

/**
 * Fixed-window rate limiting, in Redis when there is one and in memory when
 * there isn't.
 *
 * In memory it is process-local and forgets everything on restart, which is
 * fine for blunting credential stuffing on a single container but means a
 * restart loop hands an attacker a fresh allowance each time. With REDIS_URL
 * set the window survives restarts and is shared across replicas, which is the
 * main reason this app has any use for Redis at all.
 *
 * Redis being unreachable is never a reason to refuse a request: the limiter
 * falls back to the in-memory window rather than failing closed. A cache
 * outage must not lock an athlete out of their own log.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Drop expired buckets occasionally so the map can't grow unbounded. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

function inMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { ok: true };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return withRedis(
    async (redis) => {
      const namespaced = `times:rl:${key}`;
      // INCR then set the expiry on first sight: the window starts with the
      // first request in it and the key disposes of itself.
      const count = await redis.incr(namespaced);
      if (count === 1) await redis.pexpire(namespaced, windowMs);
      if (count > limit) {
        const ttl = await redis.pttl(namespaced);
        return { ok: false, retryAfter: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)) };
      }
      return { ok: true };
    },
    () => inMemory(key, limit, windowMs),
  );
}

/** Best-effort client IP from the usual proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function tooManyRequests(retryAfter: number): Response {
  return Response.json(
    { error: "rate_limited", message: "Troppi tentativi. Riprova più tardi." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/**
 * The limiter as a guard: the 429 to return, or null to carry on.
 *
 *   const limited = await enforceRateLimit(`password:${clientIp(req)}`, 10, 60_000);
 *   if (limited) return limited;
 *
 * rateLimit() returns an object, and two call sites wrote `if (!rateLimit(…))`
 * — always false, because an object is always truthy, so those limits silently
 * did nothing. This shape has no truthy-object trap in it: what comes back is
 * either a Response or null.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<Response | null> {
  const result = await rateLimit(key, limit, windowMs);
  return result.ok ? null : tooManyRequests(result.retryAfter);
}
