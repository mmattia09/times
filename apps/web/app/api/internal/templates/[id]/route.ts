import { and, eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { workoutTemplates } from "@/lib/db/schema";
import { workoutTemplateInputSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = workoutTemplateInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await db
    .update(workoutTemplates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, auth.user.id)))
    .returning({ id: workoutTemplates.id });
  if (updated.length === 0) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const deleted = await db
    .delete(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, auth.user.id)))
    .returning({ id: workoutTemplates.id });
  if (deleted.length === 0) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
