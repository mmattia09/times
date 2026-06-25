import type { Discipline } from "@/lib/db/schema";

/** Running distances offered in the entry form (meters). */
export const RUN_DISTANCES = [40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400] as const;

/** Field events — stored with discipline + event label, distance = null. */
export const FIELD_EVENTS = [
  { event: "alto", label: "Alto", discipline: "jump" as const, unit: "cm" },
  { event: "lungo", label: "Lungo", discipline: "jump" as const, unit: "cm" },
  { event: "giavellotto", label: "Giavellotto", discipline: "throw" as const, unit: "m" },
] as const;

/** Cross-country: stored as middle_distance, distance = 2000. */
export const CROSS_COUNTRY = { distance: 2000, label: "2km campestre", unit: "min" };

export type EventKey = {
  discipline: Discipline;
  distance: number | null;
  event: string | null;
};

/** Stable string key for grouping performances by event (used for PBs/charts). */
export function eventKey(p: EventKey): string {
  if (p.event) return `event:${p.event}`;
  return `dist:${p.distance ?? "?"}`;
}

/** Human label for an event key. */
export function eventLabel(p: EventKey): string {
  if (p.event) {
    const f = FIELD_EVENTS.find((e) => e.event === p.event);
    return f ? f.label : p.event;
  }
  if (p.distance === 2000) return CROSS_COUNTRY.label;
  return p.distance ? `${p.distance}m` : "—";
}

/** Unit of a performance result, derived from discipline/event. */
export function resultUnit(p: EventKey): "s" | "cm" | "m" | "min" {
  if (p.event) {
    const f = FIELD_EVENTS.find((e) => e.event === p.event);
    return (f?.unit as "cm" | "m") ?? "m";
  }
  if (p.distance === 2000) return "min";
  return "s";
}

/**
 * Lower is better for timed events (sprint / middle_distance);
 * higher is better for jumps and throws.
 */
export function lowerIsBetter(discipline: Discipline): boolean {
  return discipline === "sprint" || discipline === "middle_distance";
}

/** Compare two results; returns true if `a` is a better performance than `b`. */
export function isBetter(a: number, b: number, discipline: Discipline): boolean {
  return lowerIsBetter(discipline) ? a < b : a > b;
}

/** Format a numeric result with its unit for display. */
export function formatResult(value: number | string, p: EventKey): string {
  const n = typeof value === "string" ? Number(value) : value;
  const unit = resultUnit(p);
  if (unit === "s") return `${n.toFixed(2)}s`;
  if (unit === "min") return `${n.toFixed(2)}'`;
  if (unit === "cm") return `${n.toFixed(0)} cm`;
  return `${n.toFixed(2)} m`;
}

/** Map a Notion/FIDAL specialità string to discipline + distance + event. */
export function mapSpecialitaToEvent(raw: string): EventKey | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // Field events
  if (s.includes("alto")) return { discipline: "jump", distance: null, event: "alto" };
  if (s.includes("lungo")) return { discipline: "jump", distance: null, event: "lungo" };
  if (s.includes("giavellotto") || s.includes("giav"))
    return { discipline: "throw", distance: null, event: "giavellotto" };
  if (s.includes("peso")) return { discipline: "throw", distance: null, event: "peso" };
  if (s.includes("disco")) return { discipline: "throw", distance: null, event: "disco" };

  // Cross country
  if (s.includes("campestre") || s.includes("cross"))
    return { discipline: "middle_distance", distance: 2000, event: null };

  // Running events: FIDAL writes "100 metri", "60 piani", "200 metri", "400 hs"…
  // Field events were handled above, so any leading number here is a run distance.
  const m = s.match(/(\d{2,4})/);
  if (m) {
    const dist = parseInt(m[1], 10);
    const discipline: Discipline = dist >= 800 ? "middle_distance" : "sprint";
    return { discipline, distance: dist, event: null };
  }
  return null;
}
