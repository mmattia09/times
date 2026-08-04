"use client";

import { useSyncExternalStore } from "react";
import { CloudOff } from "lucide-react";
import { pendingFor } from "@/lib/offline-queue";
import { useI18n } from "@/lib/i18n/client";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("times:pending-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("times:pending-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Says that this session has a change waiting to be sent.
 *
 * Without it the page shows what the server still has, which after saving a
 * change offline reads exactly like the change was thrown away.
 */
export function PendingEditNotice({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const waiting = useSyncExternalStore(
    subscribe,
    () => !!pendingFor(sessionId),
    () => false,
  );

  if (!waiting) return null;

  return (
    <p className="mt-4 flex items-center gap-2 rounded-md border border-amber-500/40 px-3 py-2 text-xs text-amber-600 dark:text-amber-500">
      <CloudOff className="h-3.5 w-3.5 shrink-0" />
      {t("offline.editWaiting")}
    </p>
  );
}
