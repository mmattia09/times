import { requireApiKey } from "@/lib/api-key";
import { deleteSession, getSessionById, updateSession } from "@/lib/services";
import { sessionInputCheckedSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const { id } = await params;
  const data = await getSessionById(userId, id);
  if (!data) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ data });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sessionInputCheckedSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const ok = await updateSession(userId, id, parsed.data);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ id });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const { id } = await params;
  const ok = await deleteSession(userId, id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
