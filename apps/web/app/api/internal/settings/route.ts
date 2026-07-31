import { eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { fidalUrlSchema } from "@/lib/validation";
import { logEvent } from "@/lib/log";

export async function PUT(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = fidalUrlSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .insert(userSettings)
    .values({ userId: auth.user.id, fidalUrl: parsed.data.fidalUrl })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { fidalUrl: parsed.data.fidalUrl, updatedAt: new Date() },
    });

  logEvent("settings.updated", { user: auth.user.id, what: "fidalUrl" });
  return Response.json({ ok: true });
}
