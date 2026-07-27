import { formatInTimeZone } from "date-fns-tz";
import { de as deLocale, enGB, es as esLocale, it as itLocale } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import { DEFAULT_LOCALE, getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

export const TIME_ZONE = "Europe/Rome";

const DATE_LOCALES: Record<Locale, DateFnsLocale> = {
  it: itLocale,
  en: enGB,
  de: deLocale,
  es: esLocale,
};

/**
 * Format a date in Europe/Rome. The timezone is fixed (the athlete competes in
 * Italy) but the month names follow the UI language.
 */
export function formatDate(
  date: Date | string,
  fmt = "d MMM yyyy",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, TIME_ZONE, fmt, { locale: DATE_LOCALES[locale] ?? itLocale });
}

/** Long form, e.g. "25 aprile 2026" / "25 April 2026". */
export function formatDateLong(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  return formatDate(date, "d MMMM yyyy", locale);
}

/** Compact form for chart axes, e.g. "4 lug 26" / "4 Jul 26". */
export function formatDateShort(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  return formatDate(date, "d MMM yy", locale);
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
