import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";
import { logEvent, maskEmail } from "@/lib/log";

const patchSchema = z.object({ isAdmin: z.boolean() });

/** The target row plus the two things every guard below cares about. */
async function loadTarget(id: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email, isOwner: users.isOwner, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

/** Grant or revoke admin access. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdminApi();
  if ("error" in caller) return caller.error;

  const { id } = await params;
  const target = await loadTarget(id);
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  // The owner's admin flag is re-applied from the environment on every boot, so
  // clearing it here would only look like it worked.
  if (target.isOwner) {
    return Response.json({ error: "forbidden", message: "errors.ownerProtected" }, { status: 403 });
  }
  // Dropping your own access mid-session is the classic way to lock yourself
  // out; another admin can still do it for you.
  if (target.id === caller.userId) {
    return Response.json({ error: "forbidden", message: "errors.cannotDemoteSelf" }, { status: 403 });
  }

  await db
    .update(users)
    .set({ isAdmin: parsed.data.isAdmin, updatedAt: new Date() })
    .where(eq(users.id, id));

  // Losing admin should take effect now, not whenever their cookie expires.
  if (!parsed.data.isAdmin) {
    await db.delete(authSessions).where(eq(authSessions.userId, id));
  }

  logEvent("admin.user.role", {
    by: caller.userId,
    id,
    user: maskEmail(target.email),
    admin: parsed.data.isAdmin,
  });
  return Response.json({ ok: true, isAdmin: parsed.data.isAdmin });
}

/**
 * Delete a user and everything they logged. Every table referencing users.id
 * cascades, so this one statement removes their sessions, performances,
 * records, workouts, goals, API keys and settings with them.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdminApi();
  if ("error" in caller) return caller.error;

  const { id } = await params;
  const target = await loadTarget(id);
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });

  if (target.isOwner) {
    return Response.json({ error: "forbidden", message: "errors.ownerProtected" }, { status: 403 });
  }
  if (target.id === caller.userId) {
    return Response.json({ error: "forbidden", message: "errors.cannotDeleteSelf" }, { status: 403 });
  }
  // Refuse to remove the last account that can still reach this page.
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isAdmin, true), ne(users.id, id)))
    .limit(1);
  if (!other) {
    return Response.json({ error: "forbidden", message: "errors.lastAdmin" }, { status: 403 });
  }

  await db.delete(users).where(eq(users.id, id));
  logEvent("admin.user.deleted", { by: caller.userId, id, user: maskEmail(target.email) });
  return Response.json({ ok: true });
}
