"use client";

import { useMemo, useState } from "react";
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

export type ChartPoint = {
  date: string; // ISO
  seasonKey: string;
  seasonLabel: string;
  seasonSort: number; // season start timestamp, for ordering
  type: "training" | "competition";
  key: string; // event key
  label: string; // event label
  lowerIsBetter: boolean;
  result: number;
};

const ACCENT = "hsl(262 83% 58%)";
const MUTED = "hsl(240 4% 60%)";

export function PerformanceCharts({ points }: { points: ChartPoint[] }) {
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
  const lowerIsBetter = points.find((p) => p.key === eventKey)?.lowerIsBetter ?? true;

  const filtered = useMemo(() => {
    return points
      .filter((p) => p.key === eventKey)
      .filter((p) => seasonSel === "all" || p.seasonKey === seasonSel)
      .filter((p) => ctx === "all" || p.type === ctx)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [points, eventKey, seasonSel, ctx]);

  // Progress line (split competition vs training series via separate keys).
  const progress = filtered.map((p) => ({
    date: p.date.slice(0, 10),
    competition: p.type === "competition" ? p.result : null,
    training: p.type === "training" ? p.result : null,
    result: p.result,
  }));

  // Season comparison (best per season for the selected event).
  const seasonBest = useMemo(() => {
    const m = new Map<string, { label: string; sort: number; best: number }>();
    for (const p of points.filter((x) => x.key === eventKey)) {
      const cur = m.get(p.seasonKey);
      if (!cur || (lowerIsBetter ? p.result < cur.best : p.result > cur.best)) {
        m.set(p.seasonKey, { label: p.seasonLabel, sort: p.seasonSort, best: p.result });
      }
    }
    return [...m.values()].sort((a, b) => a.sort - b.sort).map((e) => ({ season: e.label, best: e.best }));
  }, [points, eventKey, lowerIsBetter]);

  // Improvement curve (% improvement from first recorded result).
  const improvement = useMemo(() => {
    const all = points
      .filter((x) => x.key === eventKey)
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
        <CardHeader>
          <CardTitle className="text-base">Andamento nel tempo — {current?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartFrame>
            <LineChart data={progress} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 5% 88% / 0.4)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                reversed={lowerIsBetter}
                domain={yDomain}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="competition" name="Gara" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="training" name="Allenamento" stroke={MUTED} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
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
            <ChartFrame>
              <BarChart data={seasonBest} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 5% 88% / 0.4)" vertical={false} />
                <XAxis dataKey="season" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis reversed={lowerIsBetter} domain={yDomain} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="best" name="Migliore" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curva di miglioramento</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartFrame>
              <LineChart data={improvement} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 5% 88% / 0.4)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} unit="%" />
                <Tooltip content={<ChartTooltip suffix="%" />} />
                <Line type="monotone" dataKey="improvement" name="Miglioramento" stroke={ACCENT} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartFrame>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload
        .filter((p: any) => p.value != null)
        .map((p: any) => (
          <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}: <span className="font-medium text-foreground tabular-nums">{p.value}{suffix}</span>
          </p>
        ))}
    </div>
  );
}
