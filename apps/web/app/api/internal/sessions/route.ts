import { getSession } from "@/lib/current-user";
import { createSession, listSessions, type SessionFilters } from "@/lib/services";
import { sessionInputSchema, sessionQuerySchema } from "@/lib/validation";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = sessionQuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = await listSessions(session.user.id, parsed.data as SessionFilters);
  return Response.json({ data });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = sessionInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const id = await createSession(session.user.id, parsed.data);
  return Response.json({ id }, { status: 201 });
}
