"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dayKey, monthKey, parseMonth } from "@/lib/calendar";
import { DATE_LOCALES, formatDateLong } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

export type CalendarEntry = {
  id: string;
  /** Every calendar day this session covers — a meet can span several. */
  days: string[];
  type: "training" | "competition";
  luogo: string | null;
  summary: string;
  hasWorkout: boolean;
};

/**
 * The training month at a glance: which days you were out, which were races,
 * and where the gaps are. Tapping a day opens it underneath rather than
 * navigating away, so paging through months keeps its place.
 */
export function SessionCalendar({ entries, month }: { entries: CalendarEntry[]; month: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useI18n();

  const current = parseMonth(month);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      for (const day of entry.days) {
        map.set(day, [...(map.get(day) ?? []), entry]);
      }
    }
    return map;
  }, [entries]);

  const todayKey = dayKey(new Date());
  const [selected, setSelected] = useState<string | null>(() =>
    byDay.has(todayKey) ? todayKey : null,
  );

  function goToMonth(next: Date) {
    const query = new URLSearchParams(params.toString());
    query.set("view", "calendar");
    query.set("month", monthKey(next));
    setSelected(null);
    router.push(`/sessions?${query.toString()}`);
  }

  const selectedEntries = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="relative p-2 sm:p-4">
          <Calendar
            month={current}
            onMonthChange={goToMonth}
            locale={DATE_LOCALES[locale]}
            onDayClick={(day) => {
              const key = dayKey(day);
              setSelected(byDay.has(key) ? key : null);
            }}
            components={{
              DayButton: ({ day, modifiers, ...buttonProps }) => {
                const key = dayKey(day.date);
                const sessions = byDay.get(key) ?? [];
                const isSelected = selected === key;
                return (
                  <button
                    {...buttonProps}
                    type="button"
                    className={cn(
                      // 44px keeps every day a comfortable tap target on a phone.
                      "flex min-h-11 w-full flex-col items-center justify-start gap-1 rounded-md p-1 transition-colors sm:min-h-14 sm:p-1.5",
                      sessions.length > 0 ? "hover:bg-secondary" : "cursor-default",
                      isSelected && "bg-secondary ring-1 ring-inset ring-primary/40",
                      modifiers.today && !isSelected && "ring-1 ring-inset ring-border",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular-nums leading-none",
                        modifiers.today && "font-semibold text-primary",
                      )}
                    >
                      {day.date.getUTCDate()}
                    </span>
                    {sessions.length > 0 && (
                      <span className="flex flex-wrap items-center justify-center gap-0.5">
                        {sessions.slice(0, 3).map((s, i) => (
                          <span
                            key={`${s.id}-${i}`}
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              s.type === "competition" ? "bg-primary" : "bg-muted-foreground/60",
                            )}
                          />
                        ))}
                        {sessions.length > 3 && (
                          <span className="text-[10px] leading-none text-muted-foreground">
                            +{sessions.length - 3}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              },
            }}
          />

          <div className="mt-3 flex items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              {t("common.competition")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              {t("common.training")}
            </span>
          </div>
        </CardContent>
      </Card>

      {selected && selectedEntries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold capitalize">
              {formatDateLong(`${selected}T00:00:00.000Z`, locale)}
            </p>
            <ul className="space-y-2">
              {selectedEntries.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/sessions/${entry.id}`}
                    className="flex items-start justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant={entry.type === "competition" ? "default" : "muted"}>
                          {entry.type === "competition"
                            ? t("common.competition")
                            : t("common.training")}
                        </Badge>
                        {entry.luogo && (
                          <span className="truncate text-xs text-muted-foreground">
                            {entry.luogo}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm">{entry.summary}</span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("calendar.emptyMonth")}</p>
      )}
    </div>
  );
}
