import { and, asc, eq, gte, lte } from "drizzle-orm";
import { authenticateApiKey, unauthorized } from "@/lib/api-key";
import { db } from "@/lib/db";
import { performances, sessions } from "@/lib/db/schema";

export async function GET(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) return unauthorized();

  const sp = new URL(req.url).searchParams;
  const conds = [eq(performances.userId, userId)];
  const distance = sp.get("distance");
  if (distance) conds.push(eq(performances.distance, parseInt(distance, 10)));
  const from = sp.get("from");
  if (from) conds.push(gte(sessions.date, new Date(from)));
  const to = sp.get("to");
  if (to) conds.push(lte(sessions.date, new Date(to)));

  const data = await db
    .select({
      id: performances.id,
      sessionId: performances.sessionId,
      date: sessions.date,
      discipline: performances.discipline,
      distance: performances.distance,
      event: performances.event,
      result: performances.result,
      wind: performances.wind,
      lane: performances.lane,
      position: performances.position,
      heat: performances.heat,
      isPersonalBest: performances.isPersonalBest,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(and(...conds))
    .orderBy(asc(sessions.date));

  return Response.json({ data });
}
