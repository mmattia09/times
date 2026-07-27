import { and, desc, eq, sql } from "drizzle-orm";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

/**
 * Sessions where this scheda was used. The workout is stored as a jsonb
 * snapshot on the session, so we match on its templateId.
 */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const data = await db
    .select({
      id: sessions.id,
      date: sessions.date,
      endDate: sessions.endDate,
      type: sessions.type,
      luogo: sessions.luogo,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, auth.user.id),
        sql`${sessions.workout}->>'templateId' = ${id}`,
      ),
    )
    .orderBy(desc(sessions.date));

  return Response.json({ data });
}
