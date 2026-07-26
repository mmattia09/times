import { requireApiKey } from "@/lib/api-key";
import { createSession, listSessions, type SessionFilters } from "@/lib/services";
import { sessionInputCheckedSchema, sessionQuerySchema } from "@/lib/validation";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = sessionQuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = await listSessions(userId, parsed.data as SessionFilters);
  return Response.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => null);
  const parsed = sessionInputCheckedSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const id = await createSession(userId, parsed.data);
  return Response.json({ id }, { status: 201 });
}
