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
import type { Locale } from "@/lib/i18n";

export type CalendarEntry = {
  id: string;
  /** Every calendar day this session covers — a meet can span several. */
  days: string[];
  type: "training" | "competition";
  luogo: string | null;
  summary: string;
  hasWorkout: boolean;
};

/** One session, as a row in the side panel. */
function EntryLink({ entry, day, locale }: { entry: CalendarEntry; day?: string; locale: Locale }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/sessions/${entry.id}`}
      className="flex items-start justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-secondary"
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={entry.type === "competition" ? "default" : "muted"}>
            {entry.type === "competition" ? t("common.competition") : t("common.training")}
          </Badge>
          {day && (
            <span className="text-xs font-medium tabular-nums">
              {formatDateLong(`${day}T00:00:00.000Z`, locale)}
            </span>
          )}
          {entry.luogo && (
            <span className="truncate text-xs text-muted-foreground">{entry.luogo}</span>
          )}
        </span>
        <span className="mt-1 block text-sm">{entry.summary}</span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/**
 * The training month at a glance: which days you were out, which were races,
 * and where the gaps are.
 *
 * On a wide screen the grid is capped and the month's sessions sit beside it —
 * left to itself the calendar stretched to fill a desktop and became a wall of
 * empty boxes, with the useful part (what you actually did) pushed below the
 * fold. Picking a day narrows the panel to that day instead of navigating
 * away, so paging through months keeps its place.
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

  // The month itself, one row per session, earliest first — the side panel's
  // default content, and what the calendar view was missing. Note `entries`
  // reaches a month back, so a session can be in it without being in view:
  // the page asks for the extra days to draw periods that started earlier.
  const monthDays = useMemo(() => {
    const prefix = month.slice(0, 7);
    return [...byDay.entries()]
      .filter(([day]) => day.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [byDay, month]);

  const monthCount = useMemo(
    () => new Set(monthDays.flatMap(([, list]) => list.map((e) => e.id))).size,
    [monthDays],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
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

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            {/* Only the date needs its first letter lifted — `capitalize` would
                also turn "6 sessions this month" into a headline. */}
            <p className={cn("text-sm font-semibold", selected && "first-letter:uppercase")}>
              {selected
                ? formatDateLong(`${selected}T00:00:00.000Z`, locale)
                : t("calendar.monthSessions", { count: monthCount })}
            </p>
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                {t("calendar.wholeMonth")}
              </button>
            )}
          </div>

          {monthCount === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("calendar.emptyMonth")}
            </p>
          ) : selected ? (
            <ul className="space-y-2">
              {selectedEntries.map((entry) => (
                <li key={entry.id}>
                  <EntryLink entry={entry} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            // Scrolls on its own rather than stretching the page: a heavy month
            // is 20 sessions and the calendar beside it stays put.
            <ul className="space-y-2 lg:max-h-[26rem] lg:overflow-y-auto lg:pr-1">
              {monthDays.flatMap(([day, dayEntries]) =>
                dayEntries.map((entry) => (
                  <li key={`${day}-${entry.id}`}>
                    <EntryLink entry={entry} day={day} locale={locale} />
                  </li>
                )),
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
