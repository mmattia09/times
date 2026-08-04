"use client";

import type { SessionInput } from "@/lib/validation";

/**
 * Sessions written or changed without a network, waiting to reach the server.
 *
 * The app is installed on a phone and used at the track, where there often
 * isn't any signal. Losing what you just typed because of that is the worst
 * thing this app could do, so a save that can't reach the server is kept here
 * and sent when one appears.
 *
 * localStorage rather than IndexedDB on purpose: these are a handful of small
 * objects, it is synchronous (so a save can't be half-written while the page
 * is being closed), and it survives the app being killed.
 */
const KEY = "times.pending-sessions";

export type PendingSession = {
  /** Client-side id: the same queued save must not become two sessions. */
  clientId: string;
  /** When it was written, not when it was sent. */
  queuedAt: string;
  /**
   * The session being changed, or null for one being created. A change is a
   * PUT that replaces the whole session, so sending it twice is harmless and
   * needs no id of its own.
   */
  sessionId: string | null;
  input: SessionInput;
};

function read(): PendingSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingSession[]) : [];
  } catch {
    // Corrupt or unavailable storage shouldn't take the form down with it.
    return [];
  }
}

function write(items: PendingSession[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Quota or private mode: nothing more we can do here.
  }
  window.dispatchEvent(new CustomEvent("times:pending-changed"));
}

export function pending(): PendingSession[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

export function enqueue(input: SessionInput, sessionId: string | null = null): PendingSession {
  const entry: PendingSession = {
    clientId: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    sessionId,
    input,
  };
  // Only the newest change to a session is worth sending: an earlier one would
  // just be overwritten by it a moment later.
  const rest = sessionId ? read().filter((p) => p.sessionId !== sessionId) : read();
  write([...rest, entry]);
  return entry;
}

/** The queued change to this session, if there is one waiting. */
export function pendingFor(sessionId: string): PendingSession | undefined {
  return read().find((p) => p.sessionId === sessionId);
}

export function remove(clientId: string): void {
  write(read().filter((p) => p.clientId !== clientId));
}

/** A failure that means "the server never heard us", not "the server said no". */
export function isOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  // fetch() rejects with a TypeError when the request never left the device.
  return error instanceof TypeError;
}

export type FlushResult = { sent: number; failed: number; remaining: number };

/**
 * Try to send everything queued. Anything the server rejects on its merits is
 * dropped rather than retried forever — it would fail identically next time —
 * while anything that fails for want of a network stays put.
 */
export async function flush(): Promise<FlushResult> {
  const items = read();
  if (items.length === 0) return { sent: 0, failed: 0, remaining: 0 };

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = item.sessionId
        ? await fetch(`/api/internal/sessions/${item.sessionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.input),
          })
        : await fetch("/api/internal/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...item.input, clientId: item.clientId }),
          });
      if (res.ok || res.status === 409) {
        // 409: the server already has this clientId, so it arrived after all.
        remove(item.clientId);
        sent++;
      } else if (res.status >= 400 && res.status < 500) {
        // The server understood and refused. Retrying changes nothing.
        remove(item.clientId);
        failed++;
      }
      // 5xx: leave it queued and try again later.
    } catch {
      // No network. Stop here rather than hammering the rest.
      break;
    }
  }

  return { sent, failed, remaining: read().length };
}
