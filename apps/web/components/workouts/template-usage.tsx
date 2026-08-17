"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { TemplateUse } from "@/lib/workouts";

/**
 * "Svolta N volte" summary for a scheda, expandable into the session list.
 *
 * The sessions arrive as a prop, from the page's own query. This used to fetch
 * them itself, once per card — so a library of six workouts made seven requests
 * and the line appeared a beat after the rest of the card.
 */
export function TemplateUsage({ usage }: { usage: TemplateUse[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  if (usage.length === 0) {
    return (
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {t("workouts.neverDone")}
      </p>
    );
  }

  const last = usage[0];

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-secondary/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
{t("workouts.doneCount", { count: usage.length, volte: usage.length === 1 ? t("workouts.timeOne") : t("workouts.timeMany"), date: formatDate(last.date, undefined, locale) })}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="divide-y border-t">
          {usage.map((u) => (
            <li key={u.id}>
              <Link
                href={`/sessions/${u.id}`}
                className="flex items-center justify-between gap-2 px-4 py-2 text-xs transition-colors hover:bg-secondary/40"
              >
                <span className="flex items-center gap-2">
                  <Badge variant={u.type === "competition" ? "default" : "muted"}>
                    {u.type === "competition" ? t("common.competition") : t("common.training")}
                  </Badge>
                  {formatDate(u.date, undefined, locale)}
                  {u.endDate && <> → {formatDate(u.endDate, undefined, locale)}</>}
                </span>
                <span className="truncate text-muted-foreground">{u.luogo ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
