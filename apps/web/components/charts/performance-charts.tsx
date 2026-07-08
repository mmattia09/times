"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
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
import { formatResult, type EventKey } from "@/lib/athletics";
import type { Discipline } from "@/lib/db/schema";

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
};

/**
 * Chart color tokens per theme. Series hues validated with the dataviz palette
 * checker against the app's card surfaces (light #ffffff, dark #151519):
 * CVD ΔE 76.8 (light) / 61.6 (dark), lightness band and chroma floor PASS.
 * The light aqua sits at 2.8:1 contrast → relief comes from the legend, the
 * dashed-line secondary encoding and the table view above the charts.
 */
const TOKENS = {
  light: {
    gara: "#4a3aa7",
    allenamento: "#1baf7a",
    grid: "#e4e4e7",
    axis: "#71717b",
    surface: "#ffffff",
  },
  dark: {
    gara: "#9085e9",
    allenamento: "#199e70",
    grid: "#2c2c30",
    axis: "#94949f",
    surface: "#151519",
  },
} as const;

function useChartTokens() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return { tokens: TOKENS[mounted && resolvedTheme === "dark" ? "dark" : "light"], mounted };
}

export function PerformanceCharts({ points }: { points: ChartPoint[] }) {
  const { tokens, mounted } = useChartTokens();

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

  const current = eventKeys.find((e) => e.key === eventKey);
  const sample = points.find((p) => p.key === eventKey);
  const lowerIsBetter = sample?.lowerIsBetter ?? true;
  const evk: EventKey = sample
    ? { discipline: sample.discipline, distance: sample.distance, event: sample.event }
    : { discipline: "sprint", distance: 100, event: null };

  const filtered = useMemo(() => {
    return points
      .filter((p) => p.key === eventKey)
      .filter((p) => seasonSel === "all" || p.seasonKey === seasonSel)
      .filter((p) => ctx === "all" || p.type === ctx)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [points, eventKey, seasonSel, ctx]);

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
    for (const p of points.filter((x) => x.key === eventKey && x.legal)) {
      const cur = m.get(p.seasonKey);
      if (!cur || (lowerIsBetter ? p.result < cur.best : p.result > cur.best)) {
        m.set(p.seasonKey, { label: p.seasonLabel, sort: p.seasonSort, best: p.result });
      }
    }
    return [...m.values()].sort((a, b) => a.sort - b.sort).map((e) => ({ season: e.label, best: e.best }));
  }, [points, eventKey, lowerIsBetter]);

  // Improvement curve: running-best (wind-legal) as % gained since the first mark.
  const improvement = useMemo(() => {
    const all = points
      .filter((x) => x.key === eventKey && x.legal)
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
  }, [points, eventKey, lowerIsBetter]);

  const yDomain: [string | number, string | number] = lowerIsBetter
    ? ["dataMin - 0.3", "dataMax + 0.3"]
    : ["dataMin - 5", "dataMax + 5"];

  const fmt = (v: number) => formatResult(v, evk);
  const tick = { fontSize: 11, fill: tokens.axis } as const;

  if (eventKeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Nessun dato disponibile per i grafici.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={eventKey} onValueChange={setEventKey}>
          <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
            <SelectValue />
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le stagioni</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={ctx} onValueChange={(v) => setCtx(v as typeof ctx)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">Tutto</TabsTrigger>
            <TabsTrigger value="competition" className="text-xs">Gare</TabsTrigger>
            <TabsTrigger value="training" className="text-xs">Allen.</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Andamento nel tempo — {current?.label}</CardTitle>
          <ChartLegend tokens={tokens} />
        </CardHeader>
        <CardContent>
          <ChartFrame mounted={mounted}>
            <LineChart data={progress} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} />
              <YAxis
                reversed={lowerIsBetter}
                domain={yDomain}
                tick={tick}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ stroke: tokens.grid }} />
              <Line
                type="monotone"
                dataKey="competition"
                name="Gara"
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
                name="Allenamento"
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
            {lowerIsBetter ? "Asse Y invertito: più in alto = più veloce." : "Più in alto = miglior misura."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Miglior risultato per stagione</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartFrame mounted={mounted}>
              <BarChart data={seasonBest} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="season" tick={tick} tickLine={false} axisLine={false} />
                <YAxis reversed={lowerIsBetter} domain={yDomain} tick={tick} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: tokens.grid, opacity: 0.35 }} />
                <Bar
                  dataKey="best"
                  name="Migliore"
                  fill={tokens.gara}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartFrame>
            <p className="mt-2 text-xs text-muted-foreground">Solo prestazioni regolari (vento ≤ +2.0).</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curva di miglioramento</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartFrame mounted={mounted}>
              <LineChart data={improvement} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={44} unit="%" />
                <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ stroke: tokens.grid }} />
                <Line
                  type="monotone"
                  dataKey="improvement"
                  name="Miglioramento"
                  stroke={tokens.gara}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 5, stroke: tokens.surface, strokeWidth: 2 }}
                />
              </LineChart>
            </ChartFrame>
            <p className="mt-2 text-xs text-muted-foreground">
              % di miglioramento del record rispetto alla prima prestazione registrata.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Legend for the two-series chart: line-key swatches, text in text tokens. */
function ChartLegend({ tokens }: { tokens: (typeof TOKENS)[keyof typeof TOKENS] }) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <svg width="20" height="6" aria-hidden>
          <line x1="1" y1="3" x2="19" y2="3" stroke={tokens.gara} strokeWidth="2" strokeLinecap="round" />
        </svg>
        Gara
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
        Allenamento
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
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string; payload?: Record<string, unknown> }>;
  label?: string;
  suffix?: string;
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { wind?: number | null; legal?: boolean } | undefined;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
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
