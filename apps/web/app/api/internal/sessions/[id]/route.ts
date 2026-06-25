import { getSession } from "@/lib/current-user";
import { deleteSession, getSessionById, updateSession } from "@/lib/services";
import { sessionInputSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await getSessionById(session.user.id, id);
  if (!data) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ data });
}

export async function PUT(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sessionInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const ok = await updateSession(session.user.id, id, parsed.data);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteSession(session.user.id, id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
