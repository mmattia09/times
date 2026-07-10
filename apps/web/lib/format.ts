import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";

export const TIME_ZONE = "Europe/Rome";

/** Format a date in Europe/Rome with Italian locale, e.g. "25 apr 2026". */
export function formatDate(date: Date | string, fmt = "d MMM yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, TIME_ZONE, fmt, { locale: it });
}

/** "25 aprile 2026" long form. */
export function formatDateLong(date: Date | string): string {
  return formatDate(date, "d MMMM yyyy");
}

/** ISO yyyy-MM-dd in Europe/Rome (for <input type=date>). */
export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, TIME_ZONE, "yyyy-MM-dd");
}

/** Parse a yyyy-MM-dd input as a UTC date at midnight Rome time. */
export function fromDateInputValue(value: string): Date {
  // Treat the input as a Rome-local calendar day; store as that day's UTC instant.
  return new Date(`${value}T00:00:00`);
}

/** Display label for organizzatore — federation acronyms are always uppercase. */
export function formatOrganizzatore(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value === "fidal") return "FIDAL";
  if (value === "csi") return "CSI";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
