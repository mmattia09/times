/**
 * Times service worker.
 *
 * Deliberately conservative: this app is all personal data behind a login, so
 * nothing that contains someone's training is written to the cache. We only
 *  - precache the offline fallback page and icons,
 *  - serve static build assets cache-first (they're content-hashed),
 *  - keep a copy of the *new session* page, which is the one you need to reach
 *    with no signal at the track, and which shows no data of its own,
 *  - and show the offline page when any other navigation fails.
 * Every API call goes straight to the network — stale training data would be
 * worse than an honest error, and a save that can't get through is queued on
 * the device by the app itself rather than faked here.
 */
const VERSION = "times-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";
const LOG_URL = "/sessions/new";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses or auth state.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first. The new-session page is kept so logging works
  // with no signal; anything else falls back to the offline notice.
  if (request.mode === "navigate") {
    const isLogPage = url.pathname === "/sessions/new";
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isLogPage && res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(LOG_URL, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          if (isLogPage) {
            const cached = await cache.match(LOG_URL);
            if (cached) return cached;
          }
          return (await cache.match(OFFLINE_URL)) ?? Response.error();
        }),
    );
    return;
  }

  // Build assets and icons are immutable — cache first, fill in on miss.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
