import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { getSession } from "@/lib/current-user";
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

/**
 * Resolve the active locale, most specific first:
 *   1. the signed-in user's saved preference,
 *   2. the cookie (covers login/register, before we know who they are),
 *   3. the browser's Accept-Language,
 *   4. Italian.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const session = await getSession();
  if (session?.user) {
    const [row] = await db
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);
    if (isLocale(row?.locale)) return row.locale;
  }
  return getRequestLocale();
});

/**
 * Locale from the request alone (cookie → Accept-Language → Italian).
 * For responses fetched without credentials, such as the web manifest,
 * where looking up the signed-in user would be a wasted round-trip.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const accept = (await headers()).get("accept-language");
  return localeFromAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}

export type Translator = {
  locale: Locale;
  dict: Dictionary;
  /** Translate by dotted path, e.g. t("sessions.title"). */
  t: (path: string, vars?: Record<string, string | number>) => string;
};

/** Look up a dotted path in the dictionary; falls back to the path itself. */
export function translator(locale: Locale): Translator {
  const dict = getDictionary(locale);
  const t = (path: string, vars?: Record<string, string | number>) => {
    const value = path
      .split(".")
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], dict);
    return typeof value === "string" ? interpolate(value, vars) : path;
  };
  return { locale, dict, t };
}

/** Server-component helper: `const { t, dict, locale } = await getT();` */
export async function getT(): Promise<Translator> {
  return translator(await getLocale());
}
