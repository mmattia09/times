/**
 * Athletics seasons run Oct–Sep by default (configurable start month).
 * A season is labelled by its starting and ending calendar years, e.g. "2024/25".
 */

export function seasonStartMonth(): number {
  return 10; // October (1-based). Overridable per user via settings later.
}

/** Returns the season key (start year) for a given date. */
export function seasonOf(date: Date, startMonth = seasonStartMonth()): number {
  const m = date.getUTCMonth() + 1; // 1-based
  const y = date.getUTCFullYear();
  return m >= startMonth ? y : y - 1;
}

/** Label like "2024/25" for a season start year. */
export function seasonLabel(startYear: number): string {
  const end = (startYear + 1) % 100;
  return `${startYear}/${end.toString().padStart(2, "0")}`;
}

/** Inclusive UTC date range [start, end) for a season. */
export function seasonRange(startYear: number, startMonth = seasonStartMonth()) {
  const start = new Date(Date.UTC(startYear, startMonth - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(startYear + 1, startMonth - 1, 1, 0, 0, 0));
  return { start, end };
}

/** The current season's start year. */
export function currentSeason(startMonth = seasonStartMonth()): number {
  return seasonOf(new Date(), startMonth);
}

/** All season start years spanning from earliest date to now, newest first. */
export function seasonsBetween(earliest: Date, latest = new Date()): number[] {
  const from = seasonOf(earliest);
  const to = seasonOf(latest);
  const out: number[] = [];
  for (let y = to; y >= from; y--) out.push(y);
  return out;
}
