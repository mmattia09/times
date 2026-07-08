import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, session.user.id)))
    .returning({ id: goals.id });
  if (deleted.length === 0) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
