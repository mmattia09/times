import { it } from "./locales/it";
import { en } from "./locales/en";
import { de } from "./locales/de";
import { es } from "./locales/es";

export const LOCALES = ["it", "en", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  de: "Deutsch",
  es: "Español",
};

export const DEFAULT_LOCALE: Locale = "it";

/** Italian is the source of truth; every locale must match its shape exactly. */
type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Dictionary = DeepString<typeof it>;

const DICTIONARIES: Record<Locale, Dictionary> = { it, en, de, es };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** BCP-47 tag used for date/number formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
};

/**
 * Interpolate {placeholders}. Kept dead simple on purpose: no plural engine,
 * because the few plural cases here read better as explicit word params
 * (e.g. `{count} {schede}`).
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Pick the best supported locale from an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase();
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export const LOCALE_COOKIE = "times_locale";
