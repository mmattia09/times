/**
 * Tiny in-memory rate limiter (fixed window).
 *
 * Deliberately process-local: Times is a single-container self-host, so this
 * needs no Redis and still blunts credential stuffing and API-key guessing.
 * Behind multiple replicas it degrades to per-replica limits — still useful,
 * never a correctness issue.
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

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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
