import { and, eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { logEvent } from "@/lib/log";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const revoked = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, auth.user.id)))
    .returning({ id: apiKeys.id });
  if (revoked.length === 0) return Response.json({ error: "not_found" }, { status: 404 });
  logEvent("apikey.revoked", { user: auth.user.id, id });
  return Response.json({ ok: true });
}
