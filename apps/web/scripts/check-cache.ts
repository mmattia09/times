import { cached, invalidate } from "@/lib/cache";
import { redisStatus, redisUrl } from "@/lib/redis";

/**
 * Redis is optional here, and the rule that matters is that it stays optional:
 * with no REDIS_URL every caller behaves exactly as it did before, and with one
 * that doesn't answer nothing fails — a cache having a bad day must never stop
 * an athlete opening their own log.
 *
 * This runs without a Redis, which is the case worth pinning down.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

delete process.env.REDIS_URL;

check("no REDIS_URL means no Redis", redisUrl() === null);
check("and the boot line says off", redisStatus() === "off");

// Falling back to memory has to behave like a cache, not like a no-op: the
// update check leans on it to stay inside GitHub's rate limit.
let calls = 0;
const fetcher = async () => {
  calls++;
  return { value: calls };
};

const first = await cached("check:one", 60_000, fetcher);
const second = await cached("check:one", 60_000, fetcher);
check("the first call fetches", first.value === 1);
check("the second is served from cache", second.value === 1 && calls === 1, String(calls));

await invalidate("check:one");
const third = await cached("check:one", 60_000, fetcher);
check("invalidate makes the next call fetch again", third.value === 2 && calls === 2, String(calls));

// An expired entry is a miss, not a stale answer.
await cached("check:ttl", 1, fetcher);
await new Promise((r) => setTimeout(r, 20));
const before = calls;
await cached("check:ttl", 1, fetcher);
check("an expired entry is refetched", calls === before + 1);

// Two keys are two answers — a shared namespace would serve one instance's
// release list for another's.
await cached("check:a", 60_000, async () => "a");
const b = await cached("check:b", 60_000, async () => "b");
check("keys don't collide", b === "b");

// A fetch that throws must not be remembered as an answer.
let threw = false;
try {
  await cached("check:boom", 60_000, async () => {
    throw new Error("nope");
  });
} catch {
  threw = true;
}
check("a failed fetch propagates", threw);
const after = await cached("check:boom", 60_000, async () => "recovered");
check("and is not cached, so the next call can succeed", after === "recovered");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
