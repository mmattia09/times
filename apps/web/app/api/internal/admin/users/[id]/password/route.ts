import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";
import { accounts, authSessions, users } from "@/lib/db/schema";
import { logEvent, maskEmail } from "@/lib/log";

const schema = z.object({
  password: z.string().min(8, "validation.passwordShort").max(128),
  /** Lock the account until they replace what the admin just set. */
  mustChange: z.boolean().default(true),
});

/**
 * Set another user's password.
 *
 * This hands a working credential for someone else's account to whoever calls
 * it, so the blast radius is kept as small as the feature allows: the owner is
 * off limits (the environment owns its password), your own account is too
 * (Settings does that properly, knowing the current password), every existing
 * login of theirs is dropped, and by default they cannot use the app until
 * they have replaced it.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdminApi();
  if ("error" in caller) return caller.error;

  const { id } = await params;
  const [target] = await db
    .select({ id: users.id, isOwner: users.isOwner })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });

  if (target.isOwner) {
    return Response.json({ error: "forbidden", message: "errors.ownerProtected" }, { status: 403 });
  }
  if (target.id === caller.userId) {
    return Response.json(
      { error: "forbidden", message: "errors.useSettingsForOwnPassword" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db
    .update(accounts)
    .set({ password: await hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(and(eq(accounts.userId, id), eq(accounts.providerId, "credential")))
    .returning({ id: accounts.id });
  if (updated.length === 0) {
    // No credential account: they signed in some other way, and there is no
    // password here to replace.
    return Response.json(
      { error: "conflict", message: "errors.noPasswordAccount" },
      { status: 409 },
    );
  }

  await db
    .update(users)
    .set({ mustChangePassword: parsed.data.mustChange, updatedAt: new Date() })
    .where(eq(users.id, id));
  // The old password is gone; sessions opened with it shouldn't outlive it.
  await db.delete(authSessions).where(eq(authSessions.userId, id));

  logEvent("admin.user.password", { by: caller.userId, id, mustChange: parsed.data.mustChange });
  return Response.json({ ok: true, mustChange: parsed.data.mustChange });
}
