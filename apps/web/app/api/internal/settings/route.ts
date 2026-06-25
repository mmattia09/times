import { eq } from "drizzle-orm";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { fidalUrlSchema } from "@/lib/validation";

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = fidalUrlSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .insert(userSettings)
    .values({ userId: session.user.id, fidalUrl: parsed.data.fidalUrl })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { fidalUrl: parsed.data.fidalUrl, updatedAt: new Date() },
    });

  return Response.json({ ok: true });
}
