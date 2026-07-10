"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Chart color tokens per theme. Series hues validated with the dataviz palette
 * checker against the app's card surfaces (light #ffffff, dark #151519):
 * CVD ΔE 76.8 (light) / 61.6 (dark), lightness band and chroma floor PASS.
 * The light aqua sits at 2.8:1 contrast → relief comes from legends, dashed
 * secondary encodings and the table views next to the charts.
 */
export const CHART_TOKENS = {
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

export type ChartTokens = (typeof CHART_TOKENS)[keyof typeof CHART_TOKENS];

export function useChartTokens() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return {
    tokens: CHART_TOKENS[mounted && resolvedTheme === "dark" ? "dark" : "light"],
    mounted,
  };
}
