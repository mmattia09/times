import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { PerformanceCharts, type ChartPoint } from "@/components/charts/performance-charts";
import { GoalsCard, type PbSummary } from "@/components/records/goals-card";
import { Badge } from "@/components/ui/badge";
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
import {
  eventKey,
  eventLabel,
  formatResult,
  isBetter,
  isWindLegal,
  lowerIsBetter,
  resultUnit,
  type EventKey,
} from "@/lib/athletics";
import { formatDate } from "@/lib/format";
import { currentSeason, seasonKey, seasonLabel, seasonOf, seasonStart } from "@/lib/season";
import { getT } from "@/lib/i18n/server";

/** Gap between season best and PB, formatted per unit ("" when SB equals the PB). */
function sbGap(pb: number, sb: number, ek: EventKey, lower: boolean): string {
  const gap = lower ? sb - pb : pb - sb;
  if (gap <= 1e-6) return "";
  const unit = resultUnit(ek);
  if (unit === "s" || unit === "min") return `+${gap.toFixed(2)}`;
  if (unit === "cm") return `−${gap.toFixed(0)} cm`;
  if (unit === "pts") return `−${gap.toFixed(0)} pts`;
  return `−${gap.toFixed(2)} m`;
}


export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("records.title") };
}
export default async function RecordsPage() {
  const user = await requireUser();
  const { t, dict, locale } = await getT();

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
      tipo: sessions.tipo,
      luogo: sessions.luogo,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(eq(performances.userId, user.id))
    .orderBy(asc(sessions.date));

  type Row = (typeof rows)[number] & { resultNum: number; windNum: number | null; legal: boolean };
  const all: Row[] = rows.map((r) => {
    const windNum = r.wind != null ? Number(r.wind) : null;
    return {
      ...r,
      resultNum: Number(r.result),
      windNum,
      legal: isWindLegal(r, windNum),
    };
  });

  const season = currentSeason();
  const seasonLbl = seasonLabel(season, dict);
  const seasonK = seasonKey(season);

  // Group by event key → PB (best wind-legal) + SB (best legal in current season).
  const groups = new Map<string, Row[]>();
  for (const r of all) {
    const k = eventKey(r);
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }

  const pbRows = [...groups.values()]
    .map((list) => {
      const legal = list.filter((r) => r.legal);
      if (legal.length === 0) return null;
      const best = legal.reduce((a, b) => (isBetter(b.resultNum, a.resultNum, b.discipline) ? b : a));
      const inSeason = legal.filter((r) => seasonKey(seasonOf(r.date)) === seasonK);
      const sb =
        inSeason.length > 0
          ? inSeason.reduce((a, b) => (isBetter(b.resultNum, a.resultNum, b.discipline) ? b : a))
          : null;
      return { best, sb };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.best.distance ?? 9999) - (b.best.distance ?? 9999));

  const points: ChartPoint[] = all.map((r) => {
    const s = seasonOf(r.date);
    return {
      date: r.date.toISOString(),
      seasonKey: seasonKey(s),
      seasonLabel: seasonLabel(s, dict),
      seasonSort: seasonStart(s).getTime(),
      type: r.type,
      key: eventKey(r),
      label: eventLabel(r, dict),
      discipline: r.discipline,
      distance: r.distance,
      event: r.event,
      lowerIsBetter: lowerIsBetter(r.discipline),
      result: r.resultNum,
      wind: r.windNum,
      legal: r.legal,
      tipo: r.tipo,
    };
  });

  const pbSummaries: PbSummary[] = pbRows.map(({ best }) => ({
    discipline: best.discipline,
    distance: best.distance,
    event: best.event,
    keyStr: eventKey(best),
    label: eventLabel(best, dict),
    result: best.resultNum,
  }));

  return (
    <>
      <PageHeader
        title={t("records.title")}
        description={t("records.description", { season: seasonLbl })}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("records.speciality")}</TableHead>
                <TableHead>{t("records.record")}</TableHead>
                <TableHead>{t("common.wind")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.place")}</TableHead>
                <TableHead>{t("records.seasonBest", { season: seasonLbl })}</TableHead>
                <TableHead>{t("records.deltaVsPb")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pbRows.map(({ best, sb }) => {
                const lower = lowerIsBetter(best.discipline);
                const gap = sb ? sbGap(best.resultNum, sb.resultNum, best, lower) : null;
                const sbIsPb = sb != null && gap === "";
                return (
                  <TableRow key={best.id}>
                    <TableCell className="font-medium">
                      <Link href={`/sessions/${best.sessionId}`} className="hover:underline">
                        {eventLabel(best, dict)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {formatResult(best.resultNum, best)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {best.windNum != null
                        ? `${best.windNum > 0 ? "+" : ""}${best.windNum.toFixed(1)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(best.date, undefined, locale)}</TableCell>
                    <TableCell className="text-muted-foreground">{best.luogo ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {sb ? (
                        <Link href={`/sessions/${sb.sessionId}`} className="hover:underline">
                          {formatResult(sb.resultNum, sb)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {sb == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : sbIsPb ? (
                        <Badge variant="success">{t("records.equalsPb")}</Badge>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">{gap}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6">
        <GoalsCard pbs={pbSummaries} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">{t("records.charts")}</h2>
      <PerformanceCharts points={points} />
    </>
  );
}
