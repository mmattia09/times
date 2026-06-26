import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { performances, personalBests, sessions, type Discipline } from "@/lib/db/schema";
import { eventKey, isBetter } from "@/lib/athletics";

type Row = {
  performanceId: string;
  sessionId: string;
  discipline: Discipline;
  distance: number | null;
  event: string | null;
  result: number;
  date: Date;
};

/**
 * Recompute the user's personal bests and the `isPersonalBest` flags from
 * scratch. Cheap for a single-user dataset; run after any write.
 */
export async function recomputePersonalBests(userId: string): Promise<void> {
  const rows = await db
    .select({
      performanceId: performances.id,
      sessionId: performances.sessionId,
      discipline: performances.discipline,
      distance: performances.distance,
      event: performances.event,
      result: performances.result,
      date: sessions.date,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(eq(performances.userId, userId));

  const parsed: Row[] = rows.map((r) => ({ ...r, result: Number(r.result) }));

  // Best per event key.
  const bestByKey = new Map<string, Row>();
  for (const r of parsed) {
    const key = eventKey(r);
    const current = bestByKey.get(key);
    if (!current || isBetter(r.result, current.result, r.discipline)) {
      bestByKey.set(key, r);
    }
  }

  const pbPerformanceIds = new Set([...bestByKey.values()].map((r) => r.performanceId));

  await db.transaction(async (tx) => {
    // Reset and re-flag isPersonalBest.
    await tx
      .update(performances)
      .set({ isPersonalBest: false })
      .where(eq(performances.userId, userId));

    if (pbPerformanceIds.size > 0) {
      await tx
        .update(performances)
        .set({ isPersonalBest: true })
        .where(
          and(
            eq(performances.userId, userId),
            inArray(performances.id, [...pbPerformanceIds]),
          ),
        );
    }

    // Rebuild personal_bests rows.
    await tx.delete(personalBests).where(eq(personalBests.userId, userId));
    const values = [...bestByKey.values()].map((r) => ({
      userId,
      discipline: r.discipline,
      distance: r.distance,
      event: r.event,
      result: r.result.toString(),
      sessionId: r.sessionId,
      performanceId: r.performanceId,
      achievedAt: r.date,
    }));
    if (values.length > 0) await tx.insert(personalBests).values(values);
  });
}
