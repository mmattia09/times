import { cached, invalidate } from "@/lib/cache";
import { enforceRateLimit, rateLimit } from "@/lib/rate-limit";

/**
 * Two small things the app leans on and nobody would notice breaking.
 *
 * The cache exists so the update check stays inside GitHub's rate limit — a
 * cache that silently never hits would look fine and quietly burn the quota.
 * And the limiter is a security control that was, for two of its four callers,
 * dead code: `if (!rateLimit(…))` is always false, because an object is always
 * truthy. The guard below is the shape that can't be written that way.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

// ── The cache ───────────────────────────────────────────────────────────────

let calls = 0;
const fetcher = async () => ({ n: ++calls });

const first = await cached("check:one", 60_000, fetcher);
const second = await cached("check:one", 60_000, fetcher);
check("the first call fetches", first.n === 1);
check("the second is served from cache", second.n === 1 && calls === 1, String(calls));

await invalidate("check:one");
const third = await cached("check:one", 60_000, fetcher);
check("invalidate makes the next call fetch again", third.n === 2 && calls === 2, String(calls));

await cached("check:ttl", 1, fetcher);
await new Promise((r) => setTimeout(r, 20));
const before = calls;
await cached("check:ttl", 1, fetcher);
check("an expired entry is refetched", calls === before + 1);

await cached("check:a", 60_000, async () => "a");
check("keys don't collide", (await cached("check:b", 60_000, async () => "b")) === "b");

// A fetch that throws must not be remembered as an answer, or one bad moment
// would be cached for as long as a good one.
let threw = false;
try {
  await cached("check:boom", 60_000, async () => {
    throw new Error("nope");
  });
} catch {
  threw = true;
}
check("a failed fetch propagates", threw);
check(
  "and is not cached, so the next call can succeed",
  (await cached("check:boom", 60_000, async () => "recovered")) === "recovered",
);

// ── The limiter ─────────────────────────────────────────────────────────────

const key = `check:rl:${Date.now()}`;
const results = [1, 2, 3, 4].map(() => rateLimit(key, 3, 60_000));
check(
  "three go through and the fourth doesn't",
  results.slice(0, 3).every((r) => r.ok) && !results[3].ok,
  JSON.stringify(results),
);
check(
  "the refusal says how long to wait",
  !results[3].ok && results[3].retryAfter > 0 && results[3].retryAfter <= 60,
);

// The window is per key: one address hitting its limit must not lock out another.
check("a different key has its own window", rateLimit(`${key}:other`, 3, 60_000).ok);

// The guard: null while under the limit, a 429 once over it. Never an object,
// which is the trap that made two of these do nothing at all.
const guardKey = `check:guard:${Date.now()}`;
check("the guard lets the first through", enforceRateLimit(guardKey, 1, 60_000) === null);
const blocked = enforceRateLimit(guardKey, 1, 60_000);
check("and answers 429 after that", blocked instanceof Response && blocked.status === 429);
check(
  "with a Retry-After header",
  blocked instanceof Response && Number(blocked.headers.get("Retry-After")) > 0,
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
