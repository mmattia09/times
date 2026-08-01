import { formatInTimeZone } from "date-fns-tz";
import { de as deLocale, enGB, es as esLocale, it as itLocale } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import { DEFAULT_LOCALE, getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import { CALENDAR_ZONE, DEFAULT_TIME_ZONE } from "@/lib/timezone";

/** date-fns locales, also handed to the calendar for its own labels. */
export const DATE_LOCALES: Record<Locale, DateFnsLocale> = {
  it: itLocale,
  en: enGB,
  de: deLocale,
  es: esLocale,
};

/**
 * Format a calendar day — a session date, a personal best, a chart tick.
 * Rendered in UTC on purpose: the day you raced is the same day in Rome and in
 * Auckland, so it must not drift with the server's or the reader's zone. Month
 * names follow the UI language.
 */
export function formatDate(
  date: Date | string,
  fmt = "d MMM yyyy",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, CALENDAR_ZONE, fmt, { locale: DATE_LOCALES[locale] ?? itLocale });
}

/** Long form, e.g. "25 aprile 2026" / "25 April 2026". */
export function formatDateLong(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  return formatDate(date, "d MMMM yyyy", locale);
}

/** Compact form for chart axes, e.g. "4 lug 26" / "4 Jul 26". */
export function formatDateShort(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  return formatDate(date, "d MMM yy", locale);
}

/**
 * Format an instant — a sync time, when an API key was last used. Unlike a
 * calendar day this happened at a moment in time, so it is shown in the
 * reader's zone.
 */
export function formatMoment(
  date: Date | string,
  timeZone: string = DEFAULT_TIME_ZONE,
  fmt = "d MMM yyyy, HH:mm",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, timeZone, fmt, { locale: DATE_LOCALES[locale] ?? itLocale });
}

/** ISO yyyy-MM-dd for <input type=date>. */
export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, CALENDAR_ZONE, "yyyy-MM-dd");
}

/**
 * Parse a yyyy-MM-dd input as that calendar day at midnight UTC. Explicitly
 * UTC, not the process's local zone: otherwise the day that gets stored would
 * depend on the container's TZ, and moving instances could shift every date.
 */
export function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Today as yyyy-MM-dd in the *browser's* zone — for form defaults. "Today" is
 * a local notion: at 10am in Auckland, UTC is still yesterday, and the athlete
 * logging a session means the day they are living in.
 */
export function localTodayInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Display label for organizzatore — federation acronyms are always uppercase. */
export function formatOrganizzatore(
  value: string | null | undefined,
  dict?: Dictionary,
): string | null {
  if (!value) return null;
  const d = dict ?? getDictionary(DEFAULT_LOCALE);
  const known = (d.enums.organizzatore as Record<string, string>)[value];
  if (known) return known;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
