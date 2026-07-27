import { requireApiUser } from "@/lib/current-user";
import { createSession, listSessions, type SessionFilters } from "@/lib/services";
import { sessionInputCheckedSchema, sessionQuerySchema } from "@/lib/validation";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = sessionQuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = await listSessions(auth.user.id, parsed.data as SessionFilters);
  return Response.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = sessionInputCheckedSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const id = await createSession(auth.user.id, parsed.data);
  return Response.json({ id }, { status: 201 });
}
