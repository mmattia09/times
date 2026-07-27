import { cookies } from "next/headers";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { TIMEZONE_COOKIE, isValidTimeZone } from "@/lib/timezone";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Set the UI language and/or the timezone used for timestamps. Both are stored
 * on the user (so they follow them across devices) and mirrored into cookies,
 * which is what makes the login screen already translated and the very first
 * render use the right zone.
 *
 * A null timezone means "follow the browser" and clears the stored choice.
 */
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    locale?: unknown;
    timezone?: unknown;
  } | null;
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });

  const setsLocale = "locale" in body;
  const setsZone = "timezone" in body;
  if (setsLocale && !isLocale(body.locale)) {
    return Response.json(
      { error: "bad_request", message: "errors.invalidLocale" },
      { status: 400 },
    );
  }
  if (setsZone && body.timezone !== null && !isValidTimeZone(body.timezone as string)) {
    return Response.json(
      { error: "bad_request", message: "errors.invalidTimezone" },
      { status: 400 },
    );
  }
  if (!setsLocale && !setsZone) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const locale = setsLocale ? (body.locale as ReturnType<typeof String>) : undefined;
  const timezone = setsZone ? ((body.timezone as string | null) ?? null) : undefined;

  const session = await getSession();
  if (session?.user) {
    await db
      .insert(userSettings)
      .values({
        userId: session.user.id,
        ...(locale ? { locale } : {}),
        ...(setsZone ? { timezone } : {}),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...(locale ? { locale } : {}),
          ...(setsZone ? { timezone } : {}),
          updatedAt: new Date(),
        },
      });
  }

  const jar = await cookies();
  const cookieOptions = {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax" as const,
    httpOnly: false,
  };
  if (locale) jar.set(LOCALE_COOKIE, locale, cookieOptions);
  // Clearing the choice hands the zone back to the browser probe.
  if (setsZone && timezone) jar.set(TIMEZONE_COOKIE, timezone, cookieOptions);
  if (setsZone && !timezone) jar.delete(TIMEZONE_COOKIE);

  return Response.json({ ok: true, locale, timezone });
}
