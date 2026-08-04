import { enqueue, flush, isOffline, pending, pendingCount } from "@/lib/offline-queue";
import type { SessionInput } from "@/lib/validation";

/**
 * The queue holds a session someone typed at the track with no signal, so the
 * rules that matter are: nothing is lost, nothing is sent twice, and something
 * the server refuses on its merits doesn't retry for ever.
 */

// A DOM-less stand-in for the browser bits the queue touches.
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
  dispatchEvent: () => true,
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
  writable: true,
});
(globalThis as unknown as { crypto: Crypto }).crypto ??= {
  randomUUID: () => `id-${store.size}-${Math.random()}`,
} as Crypto;

const session = (date: string): SessionInput =>
  ({ date, type: "training", performances: [], links: [] }) as unknown as SessionInput;

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

// What counts as "the server never heard us".
check("a fetch TypeError is offline", isOffline(new TypeError("Failed to fetch")));
check("a normal Error is not", !isOffline(new Error("boom")));

// Queueing keeps what was typed.
enqueue(session("2026-07-01"));
enqueue(session("2026-07-02"));
check("two saves are held", pendingCount() === 2, String(pendingCount()));
check("each gets its own id", new Set(pending().map((p) => p.clientId)).size === 2);
check("the input survives", pending()[0].input.date === "2026-07-01");

// Every attempt carries the client id, so a retry can be recognised.
const seen: Array<{ clientId: string; status: number; url: string; method: string }> = [];
const respondWith = (statusFor: (n: number) => number) => {
  let n = 0;
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { clientId?: string };
    const status = statusFor(n++);
    seen.push({
      clientId: body.clientId ?? "",
      status,
      url: String(url),
      method: String(init.method),
    });
    return { ok: status >= 200 && status < 300, status } as Response;
  };
};

// A server that is up: both go, queue empties.
respondWith(() => 201);
let result = await flush();
check("both are sent", result.sent === 2, JSON.stringify(result));
check("the queue is empty", pendingCount() === 0);
check("each carried its client id", seen.every((s) => !!s.clientId));

// A save the server already has comes back 409 — that is success, not failure.
enqueue(session("2026-07-03"));
respondWith(() => 409);
result = await flush();
check("a duplicate counts as sent", result.sent === 1 && result.remaining === 0, JSON.stringify(result));

// A save the server refuses on its merits is dropped, not retried for ever.
enqueue(session("bad-date"));
respondWith(() => 400);
result = await flush();
check("a rejected save is dropped", result.failed === 1 && result.remaining === 0, JSON.stringify(result));

// A server error keeps it queued for next time.
enqueue(session("2026-07-04"));
respondWith(() => 503);
result = await flush();
check("a server error keeps it queued", result.remaining === 1, JSON.stringify(result));

// And no network at all leaves everything where it is.
(globalThis as unknown as { fetch: unknown }).fetch = async () => {
  throw new TypeError("Failed to fetch");
};
result = await flush();
check("no network loses nothing", result.sent === 0 && pendingCount() === 1);

// A change to an existing session goes as a PUT to that session.
store.clear();
seen.length = 0;
enqueue(session("2026-07-05"), "sess-abc");
respondWith(() => 200);
result = await flush();
check("a queued change is sent", result.sent === 1 && pendingCount() === 0, JSON.stringify(result));
check("as a PUT to its own session", seen[0]?.method === "PUT" && seen[0]?.url.endsWith("/sess-abc"), JSON.stringify(seen[0]));

// Editing the same session twice offline should send the later version, once.
store.clear();
seen.length = 0;
enqueue(session("2026-07-06"), "sess-abc");
enqueue(session("2026-07-07"), "sess-abc");
check("only the newest change is held", pendingCount() === 1, String(pendingCount()));
check("and it is the newer one", pending()[0].input.date === "2026-07-07", pending()[0].input.date);
respondWith(() => 200);
result = await flush();
check("it is sent once", seen.length === 1 && result.sent === 1, JSON.stringify(result));

// A change to a session that has since been deleted is dropped, not retried.
store.clear();
enqueue(session("2026-07-08"), "sess-gone");
respondWith(() => 404);
result = await flush();
check("a change to a deleted session is dropped", result.failed === 1 && result.remaining === 0, JSON.stringify(result));

// New sessions and changes queue side by side without colliding.
store.clear();
seen.length = 0;
enqueue(session("2026-07-09"));
enqueue(session("2026-07-10"), "sess-xyz");
respondWith(() => 200);
result = await flush();
check("a new one and a change both go", result.sent === 2, JSON.stringify(result));
check("each by its own method", seen.map((s) => s.method).join(",") === "POST,PUT", seen.map((s) => s.method).join(","));

// Flushing an empty queue is a no-op, not a request.
store.clear();
let called = false;
(globalThis as unknown as { fetch: unknown }).fetch = async () => {
  called = true;
  return { ok: true, status: 201 } as Response;
};
result = await flush();
check("an empty queue makes no request", !called && result.sent === 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
