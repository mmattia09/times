/**
 * A small in-process cache for answers that are expensive to fetch and the same
 * for everyone.
 *
 * Not for training data. Sessions and records come from Postgres on the same
 * network with indexes on the columns that matter — a list is about two
 * milliseconds — so caching them would buy nothing and add a way to show an
 * athlete a personal best they have already beaten. What belongs here is what
 * comes from outside: the release list on GitHub, which is rate limited, slow,
 * and identical for every admin on the instance.
 *
 * Per process, and that is enough: Times is one container, and the only thing
 * lost on a restart is a lookup that is cheap to make again.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/**
 * The cached value, or `fetcher()` — stored for `ttlMs` either way.
 *
 * A failed fetch is never cached: the next caller tries again rather than being
 * told for six hours that the check didn't work.
 */
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  store.delete(key);

  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Forget one key — the refresh button behind the update check. */
export async function invalidate(key: string): Promise<void> {
  store.delete(key);
}
