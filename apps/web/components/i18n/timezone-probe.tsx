"use client";

import { useEffect } from "react";
import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * Tells the server which zone this browser is in, so timestamps read correctly
 * before the user has picked anything in Settings. Written as a plain cookie
 * (not a fetch): every render from the next navigation on sees it, and it is
 * re-checked on each mount so travelling is picked up. An explicit choice in
 * Settings still wins over it.
 *
 * Only a zone name, no coordinates: the value is validated server-side against
 * the runtime's IANA list before it is used.
 */
export function TimeZoneProbe({ current }: { current: string }) {
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === current) return;
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(detected)}; path=/; max-age=${oneYear}; samesite=lax`;
  }, [current]);

  return null;
}
