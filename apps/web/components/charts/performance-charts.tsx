"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChartTokens, type ChartTokens } from "@/components/charts/chart-theme";
import { formatResult, type EventKey } from "@/lib/athletics";
import { formatDateShort } from "@/lib/format";
import type { Discipline } from "@/lib/db/schema";
import { useI18n } from "@/lib/i18n/client";

/** Axis tick label without floating-point noise (12.000001 → "12"). */
function tidyTick(v: number): string {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export type ChartPoint = {
  date: string; // ISO
  seasonKey: string;
  seasonLabel: string;
  seasonSort: number; // season start timestamp, for ordering
  type: "training" | "competition";
  key: string; // event key
  label: string; // event label
  discipline: Discipline;
  distance: number | null;
  event: string | null;
  lowerIsBetter: boolean;
  result: number;
  wind: number | null;
  legal: boolean; // wind-legal mark (counts for PBs)
  tipo: "outdoor" | "indoor" | null;
};

export function PerformanceCharts({ points }: { points: ChartPoint[] }) {
  const { tokens, mounted } = useChartTokens();
  const { t, locale } = useI18n();
  const axisDate = (v: string) => formatDateShort(v, locale);

  const eventKeys = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of points) m.set(p.key, p.label);
    return [...m.entries()].map(([key, label]) => ({ key, label }));
  }, [points]);

  const seasons = useMemo(() => {
    const m = new Map<string, { key: string; label: string; sort: number }>();
    for (const p of points) m.set(p.seasonKey, { key: p.seasonKey, label: p.seasonLabel, sort: p.seasonSort });
    return [...m.values()].sort((a, b) => b.sort - a.sort);
  }, [points]);

  const [eventKey, setEventKey] = useState(eventKeys[0]?.key ?? "");
  const [seasonSel, setSeasonSel] = useState<string>("all");
  const [ctx, setCtx] = useState<"all" | "competition" | "training">("all");
  const [ambiente, setAmbiente] = useState<"all" | "outdoor" | "indoor">("all");

  const current = eventKeys.find((e) => e.key === eventKey);
  const sample = points.find((p) => p.key === eventKey);
  const lowerIsBetter = sample?.lowerIsBetter ?? true;
  const evk: EventKey = sample
    ? { discipline: sample.discipline, distance: sample.distance, event: sample.event }
    : { discipline: "sprint", distance: 100, event: null };

  // "outdoor" includes unlabeled sessions (older data has no ambiente set).
  const matchAmbiente = useCallback(
    (p: ChartPoint) =>
      ambiente === "all" || (ambiente === "indoor" ? p.tipo === "indoor" : p.tipo !== "indoor"),
    [ambiente],
  );

  const filtered = useMemo(() => {
    return points
      .filter((p) => p.key === eventKey)
      .filter((p) => seasonSel === "all" || p.seasonKey === seasonSel)
      .filter((p) => ctx === "all" || p.type === ctx)
      .filter(matchAmbiente)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [points, eventKey, seasonSel, ctx, matchAmbiente]);

  // Progress line: one row per point; the two contexts are separate series.
  const progress = filtered.map((p) => ({
    date: p.date.slice(0, 10),
    competition: p.type === "competition" ? p.result : null,
    training: p.type === "training" ? p.result : null,
    wind: p.wind,
    legal: p.legal,
  }));

  // Season comparison: best wind-legal mark per season for the selected event.
  const seasonBest = useMemo(() => {
    const m = new Map<string, { label: string; sort: number; best: number }>();
    for (const p of points.filter((x) => x.key === eventKey && x.legal && matchAmbiente(x))) {
      const cur = m.get(p.seasonKey);
      if (!cur || (lowerIsBetter ? p.result < cur.best : p.result > cur.best)) {
        m.set(p.seasonKey, { label: p.seasonLabel, sort: p.seasonSort, best: p.result });
      }
    }
    return [...m.values()].sort((a, b) => a.sort - b.sort).map((e) => ({ season: e.label, best: e.best }));
  }, [points, eventKey, lowerIsBetter, matchAmbiente]);

  // Improvement curve: running-best (wind-legal) as % gained since the first mark.
  const improvement = useMemo(() => {
    const all = points
      .filter((x) => x.key === eventKey && x.legal && matchAmbiente(x))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (all.length === 0) return [];
    const first = all[0].result;
    let runningBest = first;
    return all.map((p) => {
      if (lowerIsBetter ? p.result < runningBest : p.result > runningBest) runningBest = p.result;
      const pct = lowerIsBetter
        ? ((first - runningBest) / first) * 100
        : ((runningBest - first) / first) * 100;
      return { date: p.date.slice(0, 10), improvement: Number(pct.toFixed(2)) };
    });
  }, [points, eventKey, lowerIsBetter, matchAmbiente]);

  const yDomain: [string | number, string | number] = lowerIsBetter
    ? ["dataMin - 0.3", "dataMax + 0.3"]
    : ["dataMin - 5", "dataMax + 5"];

  const fmt = (v: number) => formatResult(v, evk);
  const tick = { fontSize: 11, fill: tokens.axis } as const;

  if (eventKeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          {t("records.noChartData")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={eventKey} onValueChange={setEventKey}>
          <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
            {/* Radix fills the trigger only after the items mount; naming the
                label here keeps the server render from showing an empty box. */}
            <SelectValue>{current?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {eventKeys.map((e) => (
              <SelectItem key={e.key} value={e.key}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={seasonSel} onValueChange={setSeasonSel}>
          <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
            <SelectValue>
              {seasons.find((s) => s.key === seasonSel)?.label ?? t("records.allSeasons")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("records.allSeasons")}</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={ctx} onValueChange={(v) => setCtx(v as typeof ctx)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">{t("records.all")}</TabsTrigger>
            <TabsTrigger value="competition" className="text-xs">{t("records.competitionsOnly")}</TabsTrigger>
            <TabsTrigger value="training" className="text-xs">{t("records.trainingsOnly")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={ambiente} onValueChange={(v) => setAmbiente(v as typeof ambiente)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">{t("records.allEnvironments")}</TabsTrigger>
            <TabsTrigger value="outdoor" className="text-xs">{t("records.outdoor")}</TabsTrigger>
            <TabsTrigger value="indoor" className="text-xs">{t("records.indoor")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("records.trendTitle", { event: current?.label ?? "" })}</CardTitle>
          <ChartLegend tokens={tokens} />
        </CardHeader>
        <CardContent>
          <ChartFrame mounted={mounted}>
            <LineChart data={progress} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="date"
                tick={tick}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisDate}
              />
              <YAxis
                reversed={lowerIsBetter}
                domain={yDomain}
                tick={tick}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={tidyTick}
              />
              <Tooltip content={<ChartTooltip fmt={fmt} labelFormat={axisDate} />} cursor={{ stroke: tokens.grid }} />
              <Line
                type="monotone"
                dataKey="competition"
                name={t("dashboard.competitionsLegend")}
                stroke={tokens.gara}
                strokeWidth={2}
                strokeLinecap="round"
                dot={{ r: 4, fill: tokens.gara, stroke: tokens.surface, strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: tokens.surface, strokeWidth: 2 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="training"
                name={t("dashboard.trainingsLegend")}
                stroke={tokens.allenamento}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="5 4"
                dot={{ r: 4, fill: tokens.allenamento, stroke: tokens.surface, strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: tokens.surface, strokeWidth: 2 }}
                connectNulls
              />
            </LineChart>
          </ChartFrame>
          <p className="mt-2 text-xs text-muted-foreground">
            {lowerIsBetter ? t("records.yAxisInverted") : t("records.yAxisNormal")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("records.bestPerSeason")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartFrame mounted={mounted}>
              <BarChart data={seasonBest} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="season" tick={tick} tickLine={false} axisLine={false} />
                <YAxis reversed={lowerIsBetter} domain={yDomain} tick={tick} tickLine={false} axisLine={false} width={44} tickFormatter={tidyTick} />
                <Tooltip content={<ChartTooltip fmt={fmt} labelFormat={axisDate} />} cursor={{ fill: tokens.grid, opacity: 0.35 }} />
                <Bar
                  dataKey="best"
                  name={t("records.record")}
                  fill={tokens.gara}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartFrame>
            <p className="mt-2 text-xs text-muted-foreground">{t("records.legalOnly")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("records.improvementCurve")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartFrame mounted={mounted}>
              <LineChart data={improvement} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
                <XAxis
                dataKey="date"
                tick={tick}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisDate}
              />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={44} unit="%" />
                <Tooltip content={<ChartTooltip suffix="%" labelFormat={axisDate} />} cursor={{ stroke: tokens.grid }} />
                <Line
                  type="monotone"
                  dataKey="improvement"
                  name={t("records.improvementCurve")}
                  stroke={tokens.gara}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 5, stroke: tokens.surface, strokeWidth: 2 }}
                />
              </LineChart>
            </ChartFrame>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("records.improvementCaption")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Legend for the two-series chart: line-key swatches, text in text tokens. */
function ChartLegend({ tokens }: { tokens: ChartTokens }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <svg width="20" height="6" aria-hidden>
          <line x1="1" y1="3" x2="19" y2="3" stroke={tokens.gara} strokeWidth="2" strokeLinecap="round" />
        </svg>
        {t("dashboard.competitionsLegend")}
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="6" aria-hidden>
          <line
            x1="1"
            y1="3"
            x2="19"
            y2="3"
            stroke={tokens.allenamento}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="4 3"
          />
        </svg>
        {t("dashboard.trainingsLegend")}
      </span>
    </div>
  );
}

function ChartFrame({ mounted, children }: { mounted: boolean; children: React.ReactElement }) {
  return (
    <div className="h-64 w-full">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
  fmt,
  labelFormat,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string; payload?: Record<string, unknown> }>;
  label?: string;
  suffix?: string;
  fmt?: (v: number) => string;
  /** Axis labels are ISO dates; the tooltip shows them the same way the axis does. */
  labelFormat?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { wind?: number | null; legal?: boolean } | undefined;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label && labelFormat ? labelFormat(label) : label}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fmt ? fmt(p.value as number) : `${p.value}${suffix}`}
            </span>
            {row?.wind != null && (
              <span className="tabular-nums">
                ({row.wind > 0 ? "+" : ""}
                {Number(row.wind).toFixed(1)}
                {row.legal === false ? " w" : ""})
              </span>
            )}
          </p>
        ))}
    </div>
  );
}
