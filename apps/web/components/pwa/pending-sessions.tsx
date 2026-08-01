"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { flush, pendingCount } from "@/lib/offline-queue";
import { useI18n } from "@/lib/i18n/client";

/** React's subscription to the queue: our own event, plus other tabs. */
function subscribeToQueue(onChange: () => void): () => void {
  window.addEventListener("times:pending-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("times:pending-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Shows what is still waiting to reach the server, and sends it when it can.
 *
 * Sits in the header so a queued session is never silently held: you can see
 * that something is pending, and press it to try now rather than waiting for
 * the browser to notice the network is back.
 */
export function PendingSessions() {
  const router = useRouter();
  const { t } = useI18n();
  // The queue is state outside React, so let React subscribe to it properly:
  // the server snapshot is 0 because localStorage doesn't exist there.
  const count = useSyncExternalStore(subscribeToQueue, pendingCount, () => 0);
  const [sending, setSending] = useState(false);

  const send = useCallback(
    async (announce: boolean) => {
      if (pendingCount() === 0) return;
      setSending(true);
      const result = await flush();
      setSending(false);
      if (result.sent > 0) {
        toast({
          title: t("offline.synced"),
          description: t("offline.syncedDescription", { count: result.sent }),
        });
        router.refresh();
      } else if (announce && result.remaining > 0) {
        toast({ variant: "destructive", title: t("offline.stillOffline") });
      }
      if (result.failed > 0) {
        toast({ variant: "destructive", title: t("offline.rejected") });
      }
    },
    [router, t],
  );

  useEffect(() => {
    const onOnline = () => void send(false);
    window.addEventListener("online", onOnline);
    // Also try once after mounting: the app may have been closed while offline
    // and reopened somewhere with signal, which fires no event. On a later
    // tick, so the first paint isn't waiting on it.
    const id = window.setTimeout(() => {
      if (navigator.onLine) void send(false);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", onOnline);
    };
  }, [send]);

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void send(true)}
      disabled={sending}
      title={t("offline.pendingTitle", { count })}
      aria-label={t("offline.pendingTitle", { count })}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500/40 px-2 text-xs text-amber-600 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-500"
    >
      {sending ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
