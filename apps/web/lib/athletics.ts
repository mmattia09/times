import type { Discipline } from "@/lib/db/schema";
import { DEFAULT_LOCALE, getDictionary, type Dictionary } from "@/lib/i18n";

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
/** Discipline order shown in the entry form. */
export const DISCIPLINE_VALUES: Discipline[] = [
  "sprint",
  "hurdles",
  "middle_distance",
  "long_distance",
  "relay",
  "walk",
  "jump",
  "throw",
  "combined",
  "test",
];

/** Discipline options with labels in the active language. */
export function disciplineOptions(dict?: Dictionary): { value: Discipline; label: string }[] {
  const d = dict ?? getDictionary(DEFAULT_LOCALE);
  return DISCIPLINE_VALUES.map((value) => ({ value, label: d.disciplines[value] }));
}

/** Event options for a field/relay/test discipline, labelled in the active language. */
export function eventOptionsFor(
  discipline: Discipline,
  dict?: Dictionary,
): { event: string; label: string }[] | null {
  const d = dict ?? getDictionary(DEFAULT_LOCALE);
  const named = (key: string) => (d.events as Record<string, string>)[key] ?? key;
  const keys =
    discipline === "jump"
      ? JUMP_EVENTS.map((e) => e.event)
      : discipline === "throw"
        ? THROW_EVENTS.map((e) => e.event)
        : discipline === "relay"
          ? RELAY_EVENTS.map((e) => e.event)
          : discipline === "test"
            ? TEST_EVENTS.map((e) => e.event)
            : null;
  if (!keys) return null;
  // Relay labels are just "4x100"/"4x400" — no translation needed.
  return keys.map((event) => ({
    event,
    label: discipline === "relay" ? event : named(event),
  }));
}

export const JUMP_EVENTS = [
  { event: "alto", label: "Salto in alto" },
  { event: "lungo", label: "Salto in lungo" },
  { event: "triplo", label: "Salto triplo" },
  { event: "asta", label: "Salto con l'asta" },
] as const;

/**
 * Athletic tests — standing/plyometric jumps and similar checks done in
 * training. Measured in cm (higher is better), kept apart from the competition
 * jumps so they never mix into the same records.
 */
export const TEST_EVENTS = [
  { event: "lungo_fermo", label: "Lungo da fermo" },
  { event: "alto_fermo", label: "Alto da fermo" },
  { event: "triplo_fermo", label: "Triplo da fermo" },
  { event: "quintuplo_fermo", label: "Quintuplo da fermo" },
  { event: "decuplo_fermo", label: "Decuplo da fermo" },
  { event: "sargent", label: "Sargent test" },
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
/**
 * Human label for an event, in the active language. `dict` is optional so
 * callers that don't have one (or don't care) still get Italian.
 */
export function eventLabel(p: EventKey, dict?: Dictionary): string {
  const d = dict ?? getDictionary(DEFAULT_LOCALE);
  const named = (key: string) => (d.events as Record<string, string>)[key];

  if (p.discipline === "test") {
    if (p.event && named(p.event)) return named(p.event);
    return p.event
      ? p.event.charAt(0).toUpperCase() + p.event.slice(1).replace(/_/g, " ")
      : d.disciplines.test;
  }
  if (p.discipline === "jump" || p.discipline === "throw") {
    if (p.event && named(p.event)) return named(p.event);
    return p.event ? p.event.charAt(0).toUpperCase() + p.event.slice(1) : d.common.none;
  }
  if (p.discipline === "relay") return p.event ?? d.events.staffetta;
  if (p.discipline === "combined") return p.event ?? d.events.proveMultiple;
  if (p.discipline === "hurdles")
    return p.distance ? `${p.distance} ${d.events.hurdlesSuffix}` : d.disciplines.hurdles;
  if (p.discipline === "walk")
    return p.distance
      ? `${formatDistance(p.distance)} ${d.events.walkSuffix}`
      : d.disciplines.walk;
  if (p.event === "campestre" || p.distance === 2000) {
    return p.discipline === "middle_distance" || p.event === "campestre"
      ? d.events.campestre
      : `${formatDistance(p.distance!)}`;
  }
  return p.distance ? formatDistance(p.distance) : d.common.none;
}

function formatDistance(m: number): string {
  if (m >= 1000 && m % 1000 === 0) return `${m / 1000}km`;
  return `${m}m`;
}

/** Unit of a performance result, derived from discipline/event. */
export function resultUnit(p: EventKey): "s" | "cm" | "m" | "min" | "pts" {
  if (p.discipline === "jump" || p.discipline === "test") return "cm";
  if (p.discipline === "throw") return "m";
  if (p.discipline === "combined") return "pts";
  if (p.event === "campestre" || p.distance === 2000) return "min";
  return "s";
}

/** Lower is better for timed events; higher for jumps, throws and combined-event points. */
export function lowerIsBetter(discipline: Discipline): boolean {
  return isTimed(discipline);
}

// ── Wind legality (FIDAL / World Athletics) ────────────────────────────────────
// Wind is measured (and caps record validity) for outdoor runs up to 200m,
// short hurdles, and the horizontal jumps. Tailwind above +2.0 m/s makes the
// mark "ventosa": still a real result, but not valid as a personal best.
export const WIND_LEGAL_LIMIT = 2.0;

export function isWindAffected(p: EventKey): boolean {
  if (p.discipline === "sprint" || p.discipline === "hurdles") return (p.distance ?? 0) <= 200;
  if (p.discipline === "jump") return p.event === "lungo" || p.event === "triplo";
  return false;
}

/**
 * True if the mark counts for records: wind-immune event, unknown wind
 * (common in training / indoor), or tailwind within +2.0 m/s.
 */
export function isWindLegal(p: EventKey, wind: number | null): boolean {
  if (!isWindAffected(p)) return true;
  if (wind == null) return true;
  return wind <= WIND_LEGAL_LIMIT;
}

/** True if `a` is a better performance than `b` for the discipline. */
export function isBetter(a: number, b: number, discipline: Discipline): boolean {
  return lowerIsBetter(discipline) ? a < b : a > b;
}

/** Format seconds as "12.34", "1:58.40", or "2:35:10.00" once past the hour. */
function formatSeconds(n: number): string {
  if (n < 60) return n.toFixed(2);
  const secs = n % 60;
  const totalMinutes = Math.floor(n / 60);
  const tail = `${secs.toFixed(2).padStart(5, "0")}`;
  if (totalMinutes < 60) return `${totalMinutes}:${tail}`;
  const h = Math.floor(totalMinutes / 60);
  return `${h}:${String(totalMinutes % 60).padStart(2, "0")}:${tail}`;
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
      // "pts" is the World Athletics abbreviation, so it needs no translation.
      return `${n.toFixed(0)} pts`;
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

  /**
   * Whole-word match. Substring matching filed every "salto in lungo",
   * "salto triplo" and "salto con l'asta" as a high jump, because "salto"
   * contains "alto".
   */
  const word = (w: string) => new RegExp(`\\b${w}`, "i").test(s);

  // Combined events.
  if (/(prove multiple|eptathlon|ettathlon|decathlon|tetrathlon|pentathlon)/.test(s))
    return { discipline: "combined", distance: null, event: s.replace(/\s+/g, " ").trim() };

  // Athletic tests — checked before the flat jumps, otherwise "lungo da fermo"
  // would match plain "lungo".
  if (s.includes("sargent")) return { discipline: "test", distance: null, event: "sargent" };
  if (/(da fermo|fermo|standing)/.test(s)) {
    if (word("decuplo")) return { discipline: "test", distance: null, event: "decuplo_fermo" };
    if (word("quintuplo")) return { discipline: "test", distance: null, event: "quintuplo_fermo" };
    if (word("triplo")) return { discipline: "test", distance: null, event: "triplo_fermo" };
    if (word("alto")) return { discipline: "test", distance: null, event: "alto_fermo" };
    if (word("lungo")) return { discipline: "test", distance: null, event: "lungo_fermo" };
  }

  // Field events.
  if (word("alto")) return { discipline: "jump", distance: null, event: "alto" };
  if (word("triplo")) return { discipline: "jump", distance: null, event: "triplo" };
  if (word("lungo")) return { discipline: "jump", distance: null, event: "lungo" };
  if (word("asta")) return { discipline: "jump", distance: null, event: "asta" };
  if (word("peso")) return { discipline: "throw", distance: null, event: "peso" };
  if (word("disco")) return { discipline: "throw", distance: null, event: "disco" };
  if (word("martello")) return { discipline: "throw", distance: null, event: "martello" };
  if (word("giavellotto") || word("giav"))
    return { discipline: "throw", distance: null, event: "giavellotto" };

  // Relays: "staffetta 4x100", "4x400".
  const relay = s.match(/(\d)\s*x\s*(\d{2,4})/);
  if (relay || s.includes("staffetta"))
    return { discipline: "relay", distance: null, event: relay ? `${relay[1]}x${relay[2]}` : "staffetta" };

  // Cross country.
  if (s.includes("campestre") || s.includes("cross"))
    return { discipline: "long_distance", distance: 2000, event: "campestre" };

  // Distance in metres. Track events carry it in the name ("3000 siepi"), road
  // races give kilometres ("10 km"), and the classics give neither.
  const km = s.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  const numMatch = s.match(/(\d{2,5})/);
  const dist = km
    ? Math.round(parseFloat(km[1].replace(",", ".")) * 1000)
    : numMatch
      ? parseInt(numMatch[1], 10)
      : null;

  // Race walking, on the track or on the road.
  if (word("marcia")) return { discipline: "walk", distance: dist, event: null };

  // Named road distances. "mezza" first: "maratona" is a prefix of "maratonina".
  if (/\bmaratonina\b|\bmezza\s+maratona\b/.test(s))
    return { discipline: "long_distance", distance: 21097, event: null };
  if (word("maratona")) return { discipline: "long_distance", distance: 42195, event: null };

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
