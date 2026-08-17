/**
 * Fixed-window rate limiting, in this process's memory.
 *
 * Deliberately local: Times is a single container next to a single database, so
 * this needs nothing else and still blunts credential stuffing and API-key
 * guessing. It forgets everything on restart, which is a real but narrow
 * weakness — a container restarts when its owner updates it, not when an
 * attacker asks — and behind several replicas it degrades to per-replica limits,
 * which is still useful and never a correctness problem.
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

/**
 * The limiter as a guard: the 429 to return, or null to carry on.
 *
 *   const limited = enforceRateLimit(`password:${clientIp(req)}`, 10, 60_000);
 *   if (limited) return limited;
 *
 * rateLimit() returns an object, and two call sites wrote `if (!rateLimit(…))`
 * — always false, because an object is always truthy, so those limits silently
 * did nothing. This shape has no truthy-object trap in it: what comes back is
 * either a Response or null.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): Response | null {
  const result = rateLimit(key, limit, windowMs);
  return result.ok ? null : tooManyRequests(result.retryAfter);
}
