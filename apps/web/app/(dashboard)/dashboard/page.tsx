import Link from "next/link";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { CalendarDays, ClipboardList, ListChecks, Target, Trophy } from "lucide-react";
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
import { currentSeason, seasonLabel, seasonRange } from "@/lib/season";
import { listSessions } from "@/lib/services";

export default async function DashboardPage() {
  const user = await requireUser();
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
      seasonBest.set(key, { label: eventLabel(ek), result: r, ek });
    }
  }
  const seasonBests = [...seasonBest.values()].sort(
    (a, b) => (a.ek.distance ?? 9999) - (b.ek.distance ?? 9999),
  );

  const stats = [
    { label: "Sessioni totali", value: totalSessions, icon: ListChecks },
    { label: "Gare", value: totalCompetitions, icon: Trophy },
    { label: "Record assoluti", value: pbs.length, icon: CalendarDays },
    { label: "PB di stagione", value: seasonBests.length, icon: Target },
    { label: "Schede", value: templateCount, icon: ClipboardList },
  ];

  // Latest personal bests, newest first.
  const latestPbs = [...pbs]
    .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime())
    .slice(0, 5);

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
      <PageHeader title="Dashboard" description={`Stagione ${seasonLabel(season)}`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Migliori prestazioni — Stagione {seasonLabel(season)}</CardTitle>
          </CardHeader>
          <CardContent>
            {seasonBests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna prestazione in questa stagione.</p>
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
            <CardTitle className="text-base">Attività recente</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna sessione.{" "}
                <Link href="/sessions/new" className="text-primary hover:underline">
                  Aggiungine una
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {recent.map((s) => (
                  <li key={s.id} className="py-2">
                    <Link href={`/sessions/${s.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="flex items-center gap-2">
                        <Badge variant={s.type === "competition" ? "default" : "muted"}>
                          {s.type === "competition" ? "Gara" : "Allenamento"}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(s.date)}</span>
                      </span>
                      <span className="truncate text-muted-foreground">
                        {s.performances.map((p) => eventLabel(p)).join(", ")}
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
            <CardTitle className="text-base">Obiettivi</CardTitle>
          </CardHeader>
          <CardContent>
            {goalRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun obiettivo.{" "}
                <Link href="/records" className="text-primary hover:underline">
                  Fissane uno nella pagina Record
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {goalRows.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium">{eventLabel(g.ek)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">
                        {g.pbVal != null ? formatResult(g.pbVal, g.ek) : "—"} →{" "}
                        <span className="font-medium text-foreground">{formatResult(g.target, g.ek)}</span>
                      </span>
                      {g.achieved ? (
                        <Badge variant="success">raggiunto</Badge>
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
            <CardTitle className="text-base">Ultimi record personali</CardTitle>
          </CardHeader>
          <CardContent>
            {latestPbs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ancora nessun record registrato.</p>
            ) : (
              <ul className="divide-y">
                {latestPbs.map((pb) => (
                  <li key={pb.id} className="py-2">
                    <Link
                      href={`/sessions/${pb.sessionId}`}
                      className="flex items-center justify-between gap-2 text-sm hover:underline"
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant="success">PB</Badge>
                        <span className="font-medium">{eventLabel(pb)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums font-medium">{formatResult(pb.result, pb)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(pb.achievedAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
