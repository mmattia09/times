import { requireApiUser } from "@/lib/current-user";
import { createSession, findByClientId, listSessions, type SessionFilters } from "@/lib/services";
import { sessionInputCheckedSchema, sessionQuerySchema } from "@/lib/validation";
import { logEvent } from "@/lib/log";

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
  // A session written offline carries the id the app gave it. If that save
  // already arrived, say so rather than creating it twice — the phone retries
  // whenever it can't tell whether the first attempt was heard.
  if (parsed.data.clientId) {
    const existing = await findByClientId(auth.user.id, parsed.data.clientId);
    if (existing) return Response.json({ id: existing, duplicate: true }, { status: 409 });
  }

  const id = await createSession(auth.user.id, parsed.data);
  logEvent("session.created", {
    user: auth.user.id,
    id,
    date: parsed.data.date,
    type: parsed.data.type,
    results: parsed.data.performances.length,
    offline: parsed.data.clientId ? true : undefined,
  });
  return Response.json({ id }, { status: 201 });
}
