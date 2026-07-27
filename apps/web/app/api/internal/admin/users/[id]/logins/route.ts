import { eq } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";

/**
 * Sign a user out of every device. Useful when someone leaves a browser logged
 * in somewhere they shouldn't have — it drops their login sessions without
 * touching the account or any of their data.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdminApi();
  if ("error" in caller) return caller.error;

  const { id } = await params;
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });

  const removed = await db
    .delete(authSessions)
    .where(eq(authSessions.userId, id))
    .returning({ id: authSessions.id });

  return Response.json({ ok: true, revoked: removed.length });
}
