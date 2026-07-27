/**
 * Two different kinds of "date" live in this app, and they need different rules.
 *
 * A **session date** is a calendar day — "I raced on 24 May" is the same day in
 * Rome, Berlin or Auckland. Those are stored as midnight UTC and always
 * rendered in UTC, so the day never shifts with where the server or the reader
 * happens to be.
 *
 * A **timestamp** is an instant: the last FIDAL sync, when an API key was
 * created or last used. Those are rendered in the reader's zone, which comes
 * from their settings or, failing that, from the browser.
 */

/** The zone calendar days are stored and rendered in. Not user-configurable. */
export const CALENDAR_ZONE = "UTC";

/** Fallback for instants when neither the setting nor the browser says otherwise. */
export const DEFAULT_TIME_ZONE = "UTC";

/** Set by the browser on first load so instants read correctly right away. */
export const TIMEZONE_COOKIE = "times_tz";

/**
 * True if the runtime knows this IANA zone. Anything reaching the server from
 * a cookie or a request body is untrusted, and an unknown zone makes
 * Intl.DateTimeFormat throw at render time.
 */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

/** Every zone this runtime supports, for the settings picker. */
export function supportedTimeZones(): string[] {
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  return supported ? supported("timeZone") : [DEFAULT_TIME_ZONE];
}

/** Current UTC offset, e.g. "+02:00" — shown next to each zone in the picker. */
export function zoneOffset(tz: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // Intl says "GMT+2" / "GMT" — normalise to "+02:00" / "+00:00".
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "+00:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
}
