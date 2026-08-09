"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";
import { supportedTimeZones, zoneOffset } from "@/lib/timezone";

/**
 * There are ~400 IANA zones, far too many for a plain dropdown, so this is a
 * filter box over a scrolling list — plus one button to hand the choice back to
 * the browser, which is what most people want.
 */
export function TimeZoneSwitcher({ saved }: { saved: string | null }) {
  const router = useRouter();
  const { t, timeZone } = useI18n();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const zones = useMemo(() => supportedTimeZones(), []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "_");
    const matching = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
    return matching.slice(0, 200);
  }, [zones, query]);

  async function save(next: string | null) {
    setSaving(true);
    const res = await fetch("/api/internal/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.saveFailed"),
      });
      return;
    }
    // The zone is resolved server-side, so re-render everything.
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{timeZone.replace(/_/g, " ")}</span>
        <span className="tabular-nums text-muted-foreground">UTC{zoneOffset(timeZone)}</span>
        {!saved && (
          <span className="text-xs text-muted-foreground">({t("settings.timezoneAuto")})</span>
        )}
      </p>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings.timezoneSearch")}
          aria-label={t("settings.timezoneSearch")}
          className="h-8 pl-8 text-xs"
        />
      </div>

      <ul className="max-h-56 max-w-xs overflow-y-auto rounded-md border">
        {shown.map((z) => (
          <li key={z}>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(z)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-muted disabled:opacity-50 sm:py-1.5"
            >
              <span className="truncate">{z.replace(/_/g, " ")}</span>
              <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
                UTC{zoneOffset(z)}
                {z === saved && <Check className="h-3.5 w-3.5 text-foreground" />}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">{t("settings.timezoneNone")}</li>
        )}
      </ul>

      <Button variant="outline" size="sm" disabled={saving || !saved} onClick={() => save(null)}>
        {t("settings.timezoneUseBrowser")}
      </Button>
    </div>
  );
}
