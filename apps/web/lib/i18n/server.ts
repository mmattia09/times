import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { getSession } from "@/lib/current-user";
import { DEFAULT_TIME_ZONE, TIMEZONE_COOKIE, isValidTimeZone } from "@/lib/timezone";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  interpolate,
  isLocale,
  localeFromAcceptLanguage,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

export type Preferences = { locale: Locale; timeZone: string };

/**
 * The reader's language and zone, most specific first:
 *   1. what they saved in Settings,
 *   2. the cookie — the locale one covers login/register, the timezone one is
 *      written by the browser so instants read right before anything is saved,
 *   3. Accept-Language for the locale,
 *   4. Italian, and UTC.
 *
 * One query for both, cached per request.
 */
export const getPreferences = cache(async (): Promise<Preferences> => {
  const session = await getSession();
  if (session?.user) {
    const [row] = await db
      .select({ locale: userSettings.locale, timezone: userSettings.timezone })
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);
    const fromRequest = await getRequestPreferences();
    return {
      locale: isLocale(row?.locale) ? row.locale : fromRequest.locale,
      // A null timezone means "follow the browser", so fall through to the cookie.
      timeZone: isValidTimeZone(row?.timezone) ? row.timezone : fromRequest.timeZone,
    };
  }
  return getRequestPreferences();
});

/**
 * Preferences from the request alone. Used for responses fetched without
 * credentials, such as the web manifest, where looking up the signed-in user
 * would be a wasted round-trip.
 */
export async function getRequestPreferences(): Promise<Preferences> {
  const jar = await cookies();

  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const accept = (await headers()).get("accept-language");
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : (localeFromAcceptLanguage(accept) ?? DEFAULT_LOCALE);

  const cookieZone = jar.get(TIMEZONE_COOKIE)?.value;
  return { locale, timeZone: isValidTimeZone(cookieZone) ? cookieZone : DEFAULT_TIME_ZONE };
}

export async function getLocale(): Promise<Locale> {
  return (await getPreferences()).locale;
}

export async function getRequestLocale(): Promise<Locale> {
  return (await getRequestPreferences()).locale;
}

export type Translator = {
  locale: Locale;
  dict: Dictionary;
  /** IANA zone for instants; calendar days ignore it (see lib/timezone.ts). */
  timeZone: string;
  /** Translate by dotted path, e.g. t("sessions.title"). */
  t: (path: string, vars?: Record<string, string | number>) => string;
};

/** Look up a dotted path in the dictionary; falls back to the path itself. */
export function translator(locale: Locale, timeZone: string = DEFAULT_TIME_ZONE): Translator {
  const dict = getDictionary(locale);
  const t = (path: string, vars?: Record<string, string | number>) => {
    const value = path
      .split(".")
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], dict);
    return typeof value === "string" ? interpolate(value, vars) : path;
  };
  return { locale, dict, timeZone, t };
}

/** Server-component helper: `const { t, dict, locale, timeZone } = await getT();` */
export async function getT(): Promise<Translator> {
  const { locale, timeZone } = await getPreferences();
  return translator(locale, timeZone);
}
