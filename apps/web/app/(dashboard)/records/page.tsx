import { asc, eq } from "drizzle-orm";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PerformanceCharts, type ChartPoint } from "@/components/charts/performance-charts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { performances, sessions } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import { eventKey, eventLabel, formatResult, isBetter, lowerIsBetter } from "@/lib/athletics";
import { formatDate } from "@/lib/format";
import { seasonOf } from "@/lib/season";

export default async function RecordsPage() {
  const user = await requireUser();

  const rows = await db
    .select({
      id: performances.id,
      sessionId: performances.sessionId,
      discipline: performances.discipline,
      distance: performances.distance,
      event: performances.event,
      result: performances.result,
      wind: performances.wind,
      date: sessions.date,
      type: sessions.type,
      luogo: sessions.luogo,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(eq(performances.userId, user.id))
    .orderBy(asc(sessions.date));

  type Row = (typeof rows)[number] & { resultNum: number };
  const all: Row[] = rows.map((r) => ({ ...r, resultNum: Number(r.result) }));

  // Group by event key → compute best & previous-best for improvement display.
  const groups = new Map<string, Row[]>();
  for (const r of all) {
    const k = eventKey(r);
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }

  const pbRows = [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) =>
        isBetter(a.resultNum, b.resultNum, a.discipline) ? -1 : 1,
      );
      const best = sorted[0];
      const previous = sorted.find((r) => r.resultNum !== best.resultNum);
      const delta = previous ? best.resultNum - previous.resultNum : null;
      return { best, previous, delta };
    })
    .sort((a, b) => (a.best.distance ?? 9999) - (b.best.distance ?? 9999));

  const points: ChartPoint[] = all.map((r) => ({
    date: r.date.toISOString(),
    season: seasonOf(r.date),
    type: r.type,
    key: eventKey(r),
    label: eventLabel(r),
    lowerIsBetter: lowerIsBetter(r.discipline),
    result: r.resultNum,
  }));

  return (
    <>
      <PageHeader title="Record" description="Migliori prestazioni personali e andamento." />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Specialità</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Miglioramento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Luogo</TableHead>
                <TableHead>Vento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pbRows.map(({ best, delta }) => {
                const lower = lowerIsBetter(best.discipline);
                const improved = delta != null && (lower ? delta < 0 : delta > 0);
                return (
                  <TableRow key={best.id}>
                    <TableCell className="font-medium">{eventLabel(best)}</TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {formatResult(best.resultNum, best)}
                    </TableCell>
                    <TableCell>
                      {delta == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            improved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          }`}
                        >
                          {lower ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                          {Math.abs(delta).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(best.date)}</TableCell>
                    <TableCell className="text-muted-foreground">{best.luogo ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{best.wind ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Grafici</h2>
      <PerformanceCharts points={points} />
    </>
  );
}
