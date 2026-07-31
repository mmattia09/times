import { and, eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { logEvent } from "@/lib/log";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const deleted = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, auth.user.id)))
    .returning({ id: goals.id });
  if (deleted.length === 0) return Response.json({ error: "not_found" }, { status: 404 });
  logEvent("goal.deleted", { user: auth.user.id, id });
  return Response.json({ ok: true });
}
