import type { Discipline } from "@/lib/db/schema";

/** Disciplines whose result is a time (lower is better). */
const TIMED_DISCIPLINES: Discipline[] = [
  "sprint",
  "hurdles",
  "middle_distance",
  "long_distance",
  "relay",
  "walk",
];

/** Running distances offered as quick picks in the entry form (meters). */
export const RUN_DISTANCES = [
  40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000,
  10000,
] as const;

/** Discipline catalogue for the entry form and filters. */
export const DISCIPLINES: { value: Discipline; label: string }[] = [
  { value: "sprint", label: "Velocità" },
  { value: "hurdles", label: "Ostacoli" },
  { value: "middle_distance", label: "Mezzofondo" },
  { value: "long_distance", label: "Fondo" },
  { value: "relay", label: "Staffetta" },
  { value: "walk", label: "Marcia" },
  { value: "jump", label: "Salti" },
  { value: "throw", label: "Lanci" },
  { value: "combined", label: "Prove multiple" },
];

export const JUMP_EVENTS = [
  { event: "alto", label: "Salto in alto" },
  { event: "lungo", label: "Salto in lungo" },
  { event: "triplo", label: "Salto triplo" },
  { event: "asta", label: "Salto con l'asta" },
] as const;

export const THROW_EVENTS = [
  { event: "peso", label: "Getto del peso" },
  { event: "disco", label: "Lancio del disco" },
  { event: "martello", label: "Lancio del martello" },
  { event: "giavellotto", label: "Tiro del giavellotto" },
] as const;

export const RELAY_EVENTS = [
  { event: "4x100", label: "4x100" },
  { event: "4x400", label: "4x400" },
] as const;

export const FIELD_EVENTS = [...JUMP_EVENTS, ...THROW_EVENTS];

export type EventKey = {
  discipline: Discipline;
  distance: number | null;
  event: string | null;
};

export function isTimed(discipline: Discipline): boolean {
  return TIMED_DISCIPLINES.includes(discipline);
}

/**
 * Stable key for grouping performances into the same event (PBs / charts).
 * Discipline is part of the key so e.g. 100m flat and 100m hurdles stay distinct.
 */
export function eventKey(p: EventKey): string {
  return `${p.discipline}:${p.event ?? ""}:${p.distance ?? ""}`;
}

/** Human label for an event. */
export function eventLabel(p: EventKey): string {
  if (p.discipline === "jump" || p.discipline === "throw") {
    const f = FIELD_EVENTS.find((e) => e.event === p.event);
    if (f) return f.label;
    return p.event ? p.event.charAt(0).toUpperCase() + p.event.slice(1) : "—";
  }
  if (p.discipline === "relay") return p.event ?? "Staffetta";
  if (p.discipline === "combined") return p.event ?? "Prove multiple";
  if (p.discipline === "hurdles") return p.distance ? `${p.distance} hs` : "Ostacoli";
  if (p.discipline === "walk") return p.distance ? `${formatDistance(p.distance)} marcia` : "Marcia";
  if (p.event === "campestre" || p.distance === 2000) {
    return p.discipline === "middle_distance" || p.event === "campestre"
      ? "2km campestre"
      : `${formatDistance(p.distance!)}`;
  }
  return p.distance ? formatDistance(p.distance) : "—";
}

function formatDistance(m: number): string {
  if (m >= 1000 && m % 1000 === 0) return `${m / 1000}km`;
  return `${m}m`;
}

/** Unit of a performance result, derived from discipline/event. */
export function resultUnit(p: EventKey): "s" | "cm" | "m" | "min" | "pts" {
  if (p.discipline === "jump") return "cm";
  if (p.discipline === "throw") return "m";
  if (p.discipline === "combined") return "pts";
  if (p.event === "campestre" || p.distance === 2000) return "min";
  return "s";
}

/** Lower is better for timed events; higher for jumps, throws and combined-event points. */
export function lowerIsBetter(discipline: Discipline): boolean {
  return isTimed(discipline);
}

/** True if `a` is a better performance than `b` for the discipline. */
export function isBetter(a: number, b: number, discipline: Discipline): boolean {
  return lowerIsBetter(discipline) ? a < b : a > b;
}

/** Format seconds as "12.34" (sub-minute) or "1:58.40" (minute+). */
function formatSeconds(n: number): string {
  if (n < 60) return n.toFixed(2);
  const m = Math.floor(n / 60);
  const s = n - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/** Format a numeric result with its unit for display. */
export function formatResult(value: number | string, p: EventKey): string {
  const n = typeof value === "string" ? Number(value) : value;
  switch (resultUnit(p)) {
    case "s":
      return n < 60 ? `${formatSeconds(n)}s` : formatSeconds(n);
    case "min":
      return `${n.toFixed(2)}'`;
    case "cm":
      return `${n.toFixed(0)} cm`;
    case "pts":
      return `${n.toFixed(0)} pti`;
    default:
      return `${n.toFixed(2)} m`;
  }
}

/**
 * Map a Notion/FIDAL specialità string to discipline + distance + event.
 * Handles flat runs, hurdles, relays, walks, steeplechase, field events and
 * combined events — kept distinct so they never share an event key.
 */
export function mapSpecialitaToEvent(raw: string): EventKey | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // Combined events.
  if (/(prove multiple|eptathlon|ettathlon|decathlon|tetrathlon|pentathlon)/.test(s))
    return { discipline: "combined", distance: null, event: s.replace(/\s+/g, " ").trim() };

  // Field events.
  if (s.includes("alto")) return { discipline: "jump", distance: null, event: "alto" };
  if (s.includes("triplo")) return { discipline: "jump", distance: null, event: "triplo" };
  if (s.includes("lungo")) return { discipline: "jump", distance: null, event: "lungo" };
  if (s.includes("asta")) return { discipline: "jump", distance: null, event: "asta" };
  if (s.includes("peso")) return { discipline: "throw", distance: null, event: "peso" };
  if (s.includes("disco")) return { discipline: "throw", distance: null, event: "disco" };
  if (s.includes("martello")) return { discipline: "throw", distance: null, event: "martello" };
  if (s.includes("giavellotto") || s.includes("giav"))
    return { discipline: "throw", distance: null, event: "giavellotto" };

  // Relays: "staffetta 4x100", "4x400".
  const relay = s.match(/(\d)\s*x\s*(\d{2,4})/);
  if (relay || s.includes("staffetta"))
    return { discipline: "relay", distance: null, event: relay ? `${relay[1]}x${relay[2]}` : "staffetta" };

  // Cross country.
  if (s.includes("campestre") || s.includes("cross"))
    return { discipline: "long_distance", distance: 2000, event: "campestre" };

  const numMatch = s.match(/(\d{2,5})/);
  const dist = numMatch ? parseInt(numMatch[1], 10) : null;

  // Race walking.
  if (s.includes("marcia")) return { discipline: "walk", distance: dist, event: null };

  if (!dist) return null;

  // Hurdles.
  if (s.includes("hs") || s.includes("ostacoli") || s.includes("ostac"))
    return { discipline: "hurdles", distance: dist, event: null };

  // Steeplechase → middle distance with a marker.
  if (s.includes("siepi") || s.includes("steeple"))
    return { discipline: "middle_distance", distance: dist, event: "siepi" };

  // Flat runs by distance.
  const discipline: Discipline =
    dist <= 400 ? "sprint" : dist <= 1500 ? "middle_distance" : "long_distance";
  return { discipline, distance: dist, event: null };
}
