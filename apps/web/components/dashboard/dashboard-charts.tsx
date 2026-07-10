"use client";

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
import { useChartTokens } from "@/components/charts/chart-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatResult, type EventKey } from "@/lib/athletics";

export type TrendPoint = { date: string; result: number };
export type MonthVolume = { month: string; gare: number; allenamenti: number };

/** Compact single-series trend of the athlete's most-raced event. */
export function TrendChart({
  title,
  points,
  lowerIsBetter,
  eventKey,
}: {
  title: string;
  points: TrendPoint[];
  lowerIsBetter: boolean;
  eventKey: EventKey;
}) {
  const { tokens, mounted } = useChartTokens();
  const tick = { fontSize: 11, fill: tokens.axis } as const;
  const fmt = (v: number) => formatResult(v, eventKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52 w-full">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} />
                <YAxis
                  reversed={lowerIsBetter}
                  domain={lowerIsBetter ? ["dataMin - 0.2", "dataMax + 0.2"] : ["dataMin - 5", "dataMax + 5"]}
                  tick={tick}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: tokens.grid }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="mb-1 font-medium">{label}</p>
                        <p className="tabular-nums text-foreground">{fmt(payload[0].value as number)}</p>
                      </div>
                    ) : null
                  }
                />
                <Line
                  type="monotone"
                  dataKey="result"
                  stroke={tokens.gara}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={{ r: 4, fill: tokens.gara, stroke: tokens.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: tokens.surface, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {lowerIsBetter ? "Prestazioni regolari, ultimi 12 mesi — più in alto = più veloce." : "Prestazioni regolari, ultimi 12 mesi."}
        </p>
      </CardContent>
    </Card>
  );
}

/** Sessions per month, split gare / allenamenti (last 6 months). */
export function MonthlyVolumeChart({ data }: { data: MonthVolume[] }) {
  const { tokens, mounted } = useChartTokens();
  const tick = { fontSize: 11, fill: tokens.axis } as const;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Volume di allenamento</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tokens.gara }} />
            Gare
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tokens.allenamento }} />
            Allenamenti
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52 w-full">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={tokens.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="month" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip
                  cursor={{ fill: tokens.grid, opacity: 0.35 }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="mb-1 font-medium">{label}</p>
                        {payload.map((p) => (
                          <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                            {p.name}: <span className="tabular-nums text-foreground">{p.value}</span>
                          </p>
                        ))}
                      </div>
                    ) : null
                  }
                />
                {/* 2px surface gap between stacked segments via stroke. */}
                <Bar
                  dataKey="allenamenti"
                  name="Allenamenti"
                  stackId="v"
                  fill={tokens.allenamento}
                  stroke={tokens.surface}
                  strokeWidth={1}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="gare"
                  name="Gare"
                  stackId="v"
                  fill={tokens.gara}
                  stroke={tokens.surface}
                  strokeWidth={1}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Sessioni registrate negli ultimi 6 mesi.</p>
      </CardContent>
    </Card>
  );
}
