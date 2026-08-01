import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SessionCalendar, type CalendarEntry } from "@/components/sessions/session-calendar";
import { SessionFilters } from "@/components/sessions/session-filters";
import { SessionsTable, type SessionRow } from "@/components/sessions/sessions-table";
import { ViewSwitch } from "@/components/sessions/view-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import { eventLabel, formatResult, isWindLegal } from "@/lib/athletics";
import { daysCovered, monthKey, monthRange, parseMonth } from "@/lib/calendar";
import { formatDate, formatOrganizzatore } from "@/lib/format";
import { listSeasons, seasonKey, seasonLabel } from "@/lib/season";
import { listSessions, type SessionFilters as Filters } from "@/lib/services";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("sessions.title") };
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { t, dict, locale } = await getT();
  const sp = await searchParams;

  const view = sp.view === "calendar" ? "calendar" : "list";
  const month = parseMonth(sp.month);

  const filters: Filters = {
    season: sp.season || undefined,
    type: sp.type as Filters["type"],
    distance: sp.distance ? Number(sp.distance) : undefined,
    organizzatore: sp.organizzatore as Filters["organizzatore"],
    livello: sp.livello as Filters["livello"],
    tipo: sp.tipo as Filters["tipo"],
    q: sp.q || undefined,
    // The calendar shows one month, so ask for one month — and a day either
    // side, since a period can start in the month before.
    ...(view === "calendar"
      ? (() => {
          const { start, end } = monthRange(month);
          const from = new Date(start);
          from.setUTCDate(from.getUTCDate() - 31);
          return { from: from.toISOString(), to: end.toISOString() };
        })()
      : {}),
  };

  const [data, earliest] = await Promise.all([
    listSessions(user.id, filters),
    db
      .select({ date: sessions.date })
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(asc(sessions.date))
      .limit(1),
  ]);

  const seasons = earliest[0]
    ? listSeasons(earliest[0].date).map((s) => ({ key: seasonKey(s), label: seasonLabel(s, dict) }))
    : [];

  /** What that day was, in one line: the marks, or the workout, or nothing. */
  const summarise = (s: (typeof data)[number]) =>
    s.performances.length > 0
      ? s.performances
          .map((p) => {
            const windy = !isWindLegal(p, p.wind != null ? Number(p.wind) : null);
            return `${eventLabel(p, dict)} ${formatResult(p.result, p)}${windy ? "w" : ""}`;
          })
          .join(" · ")
      : s.workout?.name
        ? `${dict.sessions.workoutSection}: ${s.workout.name}`
        : dict.common.none;

  const rows: SessionRow[] = data.map((s) => ({
    id: s.id,
    date: formatDate(s.date, undefined, locale),
    type: s.type,
    tempo: s.tempo,
    livello: s.livello,
    luogo: s.luogo,
    organizzatore: formatOrganizzatore(s.organizzatore, dict),
    tipo: s.tipo,
    note: s.note,
    performances: summarise(s),
  }));

  const entries: CalendarEntry[] = data.map((s) => ({
    id: s.id,
    days: daysCovered(s.date, s.endDate),
    type: s.type,
    luogo: s.luogo,
    summary: summarise(s),
    hasWorkout: !!s.workout,
  }));

  const isEmpty = view === "list" ? rows.length === 0 : entries.length === 0 && !earliest[0];

  return (
    <>
      <PageHeader
        title={t("sessions.title")}
        description={view === "list" ? t("sessions.count", { count: data.length }) : undefined}
      >
        <ViewSwitch view={view} />
        <Button asChild size="sm">
          <Link href="/sessions/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.new")}</span>
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SessionFilters seasons={seasons} />
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">{t("sessions.none")}</p>
            <Button asChild size="sm">
              <Link href="/sessions/new">
                <Plus className="h-4 w-4" /> {t("sessions.addFirst")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : view === "calendar" ? (
        <SessionCalendar entries={entries} month={sp.month ?? monthKey(month)} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <SessionsTable rows={rows} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
