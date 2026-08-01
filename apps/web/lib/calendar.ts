/**
 * The month a calendar page is showing, and which days a session covers.
 *
 * The grid itself is react-day-picker's; this is the arithmetic around it, in
 * UTC like the calendar days it describes — a session logged on the 24th
 * belongs on the 24th wherever it is read (see lib/timezone.ts).
 */

/** yyyy-MM of a month, the form used in the URL. */
export type MonthKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function monthKey(date: Date): MonthKey {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse yyyy-MM, falling back to the month `now` is in. */
export function parseMonth(value: string | undefined, now: Date = new Date()): Date {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return new Date(Date.UTC(year, month - 1, 1));
}


/** Half-open range [start, end) covering the whole month. */
export function monthRange(month: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)),
    end: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)),
  };
}


/**
 * Every calendar day a session covers. A multi-day competition is one session
 * that belongs on each of its days, capped so a bad end date can't spin.
 */
export function daysCovered(date: Date, endDate: Date | null): string[] {
  const first = dayKey(date);
  if (!endDate) return [first];
  const days: string[] = [];
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const last = dayKey(endDate);
  for (let i = 0; i < 60; i++) {
    const key = dayKey(cursor);
    days.push(key);
    if (key >= last) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
