/**
 * Athletics seasons, two per year (matching indoor/outdoor calendars):
 *   - estiva   (outdoor): April–September of year Y          → "Estiva Y"
 *   - invernale (indoor): October Y – March Y+1 (crosses NY) → "Invernale Y/Y+1"
 *
 * A season is identified by { type, year } and serialized as a key like
 * "estiva-2025" / "invernale-2024".
 */

export type SeasonType = "estiva" | "invernale";
export type Season = { type: SeasonType; year: number };

/** The season a date falls into. */
export function seasonOf(date: Date): Season {
  const m = date.getUTCMonth() + 1; // 1..12
  const y = date.getUTCFullYear();
  if (m >= 4 && m <= 9) return { type: "estiva", year: y };
  if (m >= 10) return { type: "invernale", year: y }; // Oct–Dec
  return { type: "invernale", year: y - 1 }; // Jan–Mar belong to the winter started last Oct
}

/** Half-open UTC range [start, end) for a season. */
export function seasonRange(s: Season): { start: Date; end: Date } {
  if (s.type === "estiva") {
    return { start: new Date(Date.UTC(s.year, 3, 1)), end: new Date(Date.UTC(s.year, 9, 1)) };
  }
  return { start: new Date(Date.UTC(s.year, 9, 1)), end: new Date(Date.UTC(s.year + 1, 3, 1)) };
}

export function seasonStart(s: Season): Date {
  return seasonRange(s).start;
}

export function seasonKey(s: Season): string {
  return `${s.type}-${s.year}`;
}

export function parseSeasonKey(key: string): Season | null {
  const m = key.match(/^(estiva|invernale)-(\d{4})$/);
  if (!m) return null;
  return { type: m[1] as SeasonType, year: parseInt(m[2], 10) };
}

export function seasonLabel(s: Season): string {
  if (s.type === "estiva") return `Estiva ${s.year}`;
  return `Invernale ${s.year}/${((s.year + 1) % 100).toString().padStart(2, "0")}`;
}

export function currentSeason(): Season {
  return seasonOf(new Date());
}

/** Next season chronologically (estiva Y → invernale Y → estiva Y+1 …). */
function nextSeason(s: Season): Season {
  return s.type === "estiva" ? { type: "invernale", year: s.year } : { type: "estiva", year: s.year + 1 };
}

/** All seasons from the earliest date up to `latest`, newest first. */
export function listSeasons(earliest: Date, latest = new Date()): Season[] {
  const out: Season[] = [];
  let cur = seasonOf(earliest);
  const endStart = seasonStart(seasonOf(latest)).getTime();
  // Generate forward, then reverse to newest-first. Bounded for safety.
  for (let i = 0; i < 200 && seasonStart(cur).getTime() <= endStart; i++) {
    out.push(cur);
    cur = nextSeason(cur);
  }
  return out.reverse();
}
