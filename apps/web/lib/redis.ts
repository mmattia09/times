import Redis from "ioredis";

/**
 * Redis, if there is one. Optional on purpose, and never load-bearing.
 *
 * Times is normally one container next to one Postgres, where a cache buys
 * nothing: the dataset is a training log, the queries are indexed and local,
 * and the slowest thing in a page load is the network to the phone. What Redis
 * is genuinely for here is state that must outlive a restart or be shared by
 * more than one replica — the rate limiter above all, which is a security
 * control that currently forgets everything each time the container starts.
 *
 * So: no REDIS_URL, no Redis, and every caller keeps the behaviour it had.
 * With one, callers use it and still fall back the moment it misbehaves. An
 * instance must never fail to serve an athlete's session because a cache is
 * having a bad day.
 */

let client: Redis | null | undefined;
let warned = false;

function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[redis] ${message}`);
}

export function redisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url ? url : null;
}

/** The shared client, or null when this instance runs without Redis. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = redisUrl();
  if (!url) {
    client = null;
    return null;
  }

  try {
    client = new Redis(url, {
      // Fail a command rather than queue it forever: every caller has a
      // fallback, and waiting is worse than not using the cache.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 500, 10_000),
    });
    client.on("error", (err: Error) => warnOnce(`${err.message} — carrying on without it`));
  } catch (err) {
    warnOnce(`${err instanceof Error ? err.message : String(err)} — carrying on without it`);
    client = null;
  }
  return client;
}

/**
 * Run something against Redis, and take the fallback if Redis isn't there or
 * doesn't answer. The point of this file in one function.
 */
export async function withRedis<T>(
  fn: (redis: Redis) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fallback();
  try {
    return await fn(redis);
  } catch (err) {
    warnOnce(`${err instanceof Error ? err.message : String(err)} — falling back`);
    return fallback();
  }
}

/** For the boot line, so an admin can see whether it is actually in use. */
export function redisStatus(): "off" | "connected" | "connecting" {
  const redis = getRedis();
  if (!redis) return "off";
  return redis.status === "ready" ? "connected" : "connecting";
}
