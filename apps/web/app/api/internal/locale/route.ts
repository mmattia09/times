import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

/**
 * Set the UI language. Stored on the user (so it follows them across devices)
 * and mirrored into a cookie so the login screen is already translated.
 */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const locale = (body as { locale?: unknown } | null)?.locale;
  if (!isLocale(locale)) {
    return Response.json({ error: "bad_request", message: "Lingua non valida." }, { status: 400 });
  }

  const session = await getSession();
  if (session?.user) {
    await db
      .insert(userSettings)
      .values({ userId: session.user.id, locale })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { locale, updatedAt: new Date() },
      });
  }

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  return Response.json({ ok: true, locale });
}
