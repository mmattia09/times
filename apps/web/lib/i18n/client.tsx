"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";
import {
  DEFAULT_LOCALE,
  LOCALE_TAGS,
  getDictionary,
  interpolate,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  dict: Dictionary;
  /** IANA zone for instants; calendar days ignore it (see lib/timezone.ts). */
  timeZone: string;
  t: (path: string, vars?: Record<string, string | number>) => string;
  /** BCP-47 tag for Intl formatting. */
  tag: string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  timeZone,
  children,
}: {
  locale: Locale;
  timeZone: string;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const dict = getDictionary(locale);
    return {
      locale,
      dict,
      timeZone,
      tag: LOCALE_TAGS[locale],
      t: (path, vars) => {
        const found = path
          .split(".")
          .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], dict);
        return typeof found === "string" ? interpolate(found, vars) : path;
      },
    };
  }, [locale, timeZone]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client components: `const { t } = useI18n();` */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Defensive default so a component rendered outside the provider (e.g. in a
  // test) degrades to Italian rather than crashing.
  const dict = getDictionary(DEFAULT_LOCALE);
  return {
    locale: DEFAULT_LOCALE,
    dict,
    timeZone: DEFAULT_TIME_ZONE,
    tag: LOCALE_TAGS[DEFAULT_LOCALE],
    t: (path, vars) => {
      const found = path
        .split(".")
        .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], dict);
      return typeof found === "string" ? interpolate(found, vars) : path;
    },
  };
}
