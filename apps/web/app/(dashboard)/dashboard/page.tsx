import Link from "next/link";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { CalendarDays, ClipboardList, ListChecks, Target, Trophy } from "lucide-react";
import { MonthlyVolumeChart, TrendChart, type MonthVolume, type TrendPoint } from "@/components/dashboard/dashboard-charts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { goals, performances, personalBests, sessions, workoutTemplates } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import {
  eventKey,
  eventLabel,
  formatResult,
  isWindLegal,
  lowerIsBetter,
  resultUnit,
  type EventKey,
} from "@/lib/athletics";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentSeason, seasonLabel, seasonRange } from "@/lib/season";
import { listSessions } from "@/lib/services";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("nav.dashboard") };
}
export default async function DashboardPage() {
  const user = await requireUser();
  const { t, dict, locale } = await getT();
  const season = currentSeason();
  const { start, end } = seasonRange(season);

  const [[{ totalSessions }], [{ totalCompetitions }], pbs, recent, allGoals, [{ templateCount }]] =
    await Promise.all([
      db.select({ totalSessions: count() }).from(sessions).where(eq(sessions.userId, user.id)),
      db
        .select({ totalCompetitions: count() })
        .from(sessions)
        .where(and(eq(sessions.userId, user.id), eq(sessions.type, "competition"))),
      db.select().from(personalBests).where(eq(personalBests.userId, user.id)),
      listSessions(user.id, {}).then((s) => s.slice(0, 5)),
      db.select().from(goals).where(eq(goals.userId, user.id)),
      db
        .select({ templateCount: count() })
        .from(workoutTemplates)
        .where(eq(workoutTemplates.userId, user.id)),
    ]);

  // Season PBs: best result per event recorded within the current season.
  const seasonPerfs = await db
    .select({
      discipline: performances.discipline,
      distance: performances.distance,
      event: performances.event,
      result: performances.result,
      wind: performances.wind,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(and(eq(performances.userId, user.id), gte(sessions.date, start), lte(sessions.date, end)));

  const seasonBest = new Map<
    string,
    { label: string; result: number; ek: { discipline: typeof seasonPerfs[number]["discipline"]; distance: number | null; event: string | null } }
  >();
  for (const p of seasonPerfs) {
    const ek = { discipline: p.discipline, distance: p.distance, event: p.event };
    if (!isWindLegal(ek, p.wind != null ? Number(p.wind) : null)) continue;
    const key = eventKey(ek);
    const r = Number(p.result);
    const lower = lowerIsBetter(p.discipline);
    const cur = seasonBest.get(key);
    if (!cur || (lower ? r < cur.result : r > cur.result)) {
      seasonBest.set(key, { label: eventLabel(ek, dict), result: r, ek });
    }
  }
  const seasonBests = [...seasonBest.values()].sort(
    (a, b) => (a.ek.distance ?? 9999) - (b.ek.distance ?? 9999),
  );

  const stats = [
    { label: t("dashboard.totalSessions"), value: totalSessions, icon: ListChecks },
    { label: t("dashboard.competitions"), value: totalCompetitions, icon: Trophy },
    { label: t("dashboard.absoluteRecords"), value: pbs.length, icon: CalendarDays },
    { label: t("dashboard.seasonBests"), value: seasonBests.length, icon: Target },
    { label: t("dashboard.workouts"), value: templateCount, icon: ClipboardList },
  ];

  // Latest personal bests, newest first.
  const latestPbs = [...pbs]
    .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime())
    .slice(0, 5);

  // Trend of the most-raced event in the last 12 months (wind-legal marks only).
  const yearAgo = new Date();
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const recentPerfs = await db
    .select({
      discipline: performances.discipline,
      distance: performances.distance,
      event: performances.event,
      result: performances.result,
      wind: performances.wind,
      date: sessions.date,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(and(eq(performances.userId, user.id), gte(sessions.date, yearAgo)))
    .orderBy(sessions.date);

  const legalRecent = recentPerfs.filter((p) =>
    isWindLegal(p, p.wind != null ? Number(p.wind) : null),
  );
  const byEvent = new Map<string, typeof legalRecent>();
  for (const p of legalRecent) {
    const k = eventKey(p);
    byEvent.set(k, [...(byEvent.get(k) ?? []), p]);
  }
  const topEventList = [...byEvent.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  const trendEvent: EventKey | null =
    topEventList.length >= 2
      ? { discipline: topEventList[0].discipline, distance: topEventList[0].distance, event: topEventList[0].event }
      : null;
  const trendPoints: TrendPoint[] = topEventList.map((p) => ({
    date: formatDate(p.date, "d MMM", locale),
    result: Number(p.result),
  }));

  // Sessions per month (last 6 months), split gare / allenamenti.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5, 1);
  sixMonthsAgo.setUTCHours(0, 0, 0, 0);
  const recentSessions = await db
    .select({ date: sessions.date, type: sessions.type })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), gte(sessions.date, sixMonthsAgo)));

  const monthlyVolume: MonthVolume[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const inMonth = recentSessions.filter(
      (s) => `${s.date.getUTCFullYear()}-${s.date.getUTCMonth()}` === key,
    );
    monthlyVolume.push({
      month: formatDate(d, "MMM", locale),
      gare: inMonth.filter((s) => s.type === "competition").length,
      allenamenti: inMonth.filter((s) => s.type === "training").length,
    });
  }

  // Goals vs current PBs.
  const goalRows = allGoals.map((g) => {
    const ek: EventKey = { discipline: g.discipline, distance: g.distance, event: g.event };
    const pb = pbs.find((p) => eventKey(p) === eventKey(ek));
    const target = Number(g.target);
    const lower = lowerIsBetter(g.discipline);
    const pbVal = pb != null ? Number(pb.result) : null;
    const achieved = pbVal != null && (lower ? pbVal <= target : pbVal >= target);
    const gap = pbVal != null ? (lower ? pbVal - target : target - pbVal) : null;
    return { id: g.id, ek, target, pbVal, achieved, gap };
  });

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.season", { season: seasonLabel(season, dict) })} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {stats.map((s, i) => {
          const Icon = s.icon;
          // An odd number of stats leaves the last one alone in a two-column
          // row; let it take the whole width instead of hanging there.
          const orphan = stats.length % 2 === 1 && i === stats.length - 1;
          return (
            <Card key={s.label} className={cn(orphan && "col-span-2 sm:col-span-1")}>
              <CardContent className="flex items-center justify-between gap-2 p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{s.label}</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums">{s.value}</p>
                </div>
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.bestOfSeason", { season: seasonLabel(season, dict) })}</CardTitle>
          </CardHeader>
          <CardContent>
            {seasonBests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noSeasonResults")}</p>
            ) : (
              <ul className="divide-y">
                {seasonBests.map((b) => (
                  <li key={b.label} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{b.label}</span>
                    <span className="tabular-nums">{formatResult(b.result, b.ek)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noSessions")}{" "}
                <Link href="/sessions/new" className="text-primary hover:underline">
                  {t("dashboard.addOne")}
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {recent.map((s) => (
                  <li key={s.id}>
                    {/* The padding lives on the link, not the row: on a phone
                        the whole line should be the tap target. */}
                    <Link href={`/sessions/${s.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:underline">
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant={s.type === "competition" ? "default" : "muted"}>
                          {s.type === "competition" ? t("common.competition") : t("common.training")}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(s.date, undefined, locale)}</span>
                      </span>
                      <span className="min-w-0 truncate text-muted-foreground">
                        {s.performances.length > 0
                          ? s.performances.map((p) => eventLabel(p, dict)).join(", ")
                          : (s.workout?.name ?? "—")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.goals")}</CardTitle>
          </CardHeader>
          <CardContent>
            {goalRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noGoals")}{" "}
                <Link href="/records" className="text-primary hover:underline">
                  {t("dashboard.setOneInRecords")}
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {goalRows.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium">{eventLabel(g.ek, dict)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">
                        {g.pbVal != null ? formatResult(g.pbVal, g.ek) : "—"} →{" "}
                        <span className="font-medium text-foreground">{formatResult(g.target, g.ek)}</span>
                      </span>
                      {g.achieved ? (
                        <Badge variant="success">{t("records.achieved")}</Badge>
                      ) : g.gap != null ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          −{resultUnit(g.ek) === "cm" ? g.gap.toFixed(0) : g.gap.toFixed(2)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.latestPbs")}</CardTitle>
          </CardHeader>
          <CardContent>
            {latestPbs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noPbs")}</p>
            ) : (
              <ul className="divide-y">
                {latestPbs.map((pb) => (
                  <li key={pb.id}>
                    <Link
                      href={`/sessions/${pb.sessionId}`}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm hover:underline"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="success">PB</Badge>
                        <span className="truncate font-medium">{eventLabel(pb, dict)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="tabular-nums font-medium">{formatResult(pb.result, pb)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(pb.achievedAt, undefined, locale)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {trendEvent && (
          <TrendChart
            title={t("dashboard.trend", { event: eventLabel(trendEvent, dict) })}
            points={trendPoints}
            lowerIsBetter={lowerIsBetter(trendEvent.discipline)}
            eventKey={trendEvent}
          />
        )}
        <MonthlyVolumeChart data={monthlyVolume} />
      </div>
    </>
  );
}
