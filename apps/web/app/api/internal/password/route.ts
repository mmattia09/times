import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { logEvent, maskEmail } from "@/lib/log";

const schema = z.object({
  currentPassword: z.string().min(1, "validation.passwordRequired").max(128),
  newPassword: z.string().min(8, "validation.passwordShort").max(128),
});

/**
 * Replace the password while a forced change is pending. Deliberately *not*
 * behind requireApiUser: this is the one thing a locked-out account is allowed
 * to do. The current password is still required, so a hijacked session can't
 * take the account over — and clearing the flag is what unlocks the app again.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Guessing the temporary password here would be as good as knowing it.
  const limited = await enforceRateLimit(`password:${clientIp(req)}`, 10, 60_000);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) {
    return Response.json(
      { error: "bad_request", message: "errors.passwordUnchanged" },
      { status: 400 },
    );
  }

  // revokeOtherSessions closes anything opened with the old password. It also
  // rotates the caller's own session, so take the raw Response and pass its
  // Set-Cookie along — otherwise changing the password would sign you out.
  let authResponse: Response;
  try {
    authResponse = await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
      asResponse: true,
    });
  } catch {
    authResponse = new Response(null, { status: 400 });
  }
  if (!authResponse.ok) {
    // Better Auth doesn't distinguish "wrong password" from other failures in a
    // way worth exposing; either way there is nothing for the caller to fix but
    // the password they typed.
    return Response.json(
      { error: "bad_request", message: "errors.wrongPassword" },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  logEvent("auth.password.forced", { user: session.user.id });
  const res = Response.json({ ok: true });
  for (const cookie of authResponse.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
