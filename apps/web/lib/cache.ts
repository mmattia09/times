import { withRedis } from "@/lib/redis";

/**
 * A small shared cache for answers that are expensive to fetch and the same
 * for everyone.
 *
 * Not for training data. Sessions and records come from Postgres on the same
 * network with indexes on the columns that matter, and putting a cache in
 * front of them would buy microseconds while adding a way to show an athlete
 * a personal best they have already beaten. What belongs here is what comes
 * from outside: the release list on GitHub, which is rate limited and slow and
 * identical for every admin on the instance.
 *
 * Without Redis this is a per-process map, which is what the update check was
 * doing on its own before — same behaviour, one implementation.
 */

type Entry = { value: unknown; expiresAt: number };

const local = new Map<string, Entry>();

function readLocal<T>(key: string): T | null {
  const hit = local.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    local.delete(key);
    return null;
  }
  return hit.value as T;
}

/**
 * The cached value, or `fetcher()` — stored for `ttlMs` either way.
 *
 * A failed fetch is never cached: the next caller tries again rather than
 * being told for six hours that the check didn't work.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const namespaced = `times:cache:${key}`;

  const hit = await withRedis<T | null>(
    async (redis) => {
      const raw = await redis.get(namespaced);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    () => readLocal<T>(namespaced),
  );
  if (hit !== null) return hit;

  const value = await fetcher();

  await withRedis(
    async (redis) => {
      await redis.set(namespaced, JSON.stringify(value), "PX", ttlMs);
    },
    () => {
      local.set(namespaced, { value, expiresAt: Date.now() + ttlMs });
    },
  );

  return value;
}

/** Forget one key — the refresh button behind the update check. */
export async function invalidate(key: string): Promise<void> {
  const namespaced = `times:cache:${key}`;
  await withRedis(
    async (redis) => {
      await redis.del(namespaced);
    },
    () => {
      local.delete(namespaced);
    },
  );
}
