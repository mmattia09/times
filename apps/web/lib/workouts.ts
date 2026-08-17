import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, workoutTemplates, type WorkoutTemplate } from "@/lib/db/schema";

/**
 * The workout library with, for each workout, the sessions it was used in.
 *
 * The page used to build this from the browser: one request for the list, then
 * one per workout for its usage. Seven requests to draw six cards, arriving in
 * two waves — which is why the "done N times" line turned up a moment after
 * everything else. Two queries here, on the server, and the page arrives whole.
 *
 * A session stores its workout as a jsonb snapshot (so editing the library never
 * rewrites history), so the link back is the templateId inside that snapshot.
 */

export type TemplateUse = {
  id: string;
  date: string;
  endDate: string | null;
  type: "training" | "competition";
  luogo: string | null;
};

export type TemplateWithUsage = WorkoutTemplate & { usage: TemplateUse[] };

export async function listTemplatesWithUsage(userId: string): Promise<TemplateWithUsage[]> {
  const [templates, used] = await Promise.all([
    db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, userId))
      .orderBy(workoutTemplates.name),
    db
      .select({
        templateId: sql<string>`${sessions.workout}->>'templateId'`.as("template_id"),
        id: sessions.id,
        date: sessions.date,
        endDate: sessions.endDate,
        type: sessions.type,
        luogo: sessions.luogo,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNotNull(sessions.workout),
          sql`${sessions.workout}->>'templateId' IS NOT NULL`,
        ),
      )
      .orderBy(desc(sessions.date)),
  ]);

  const byTemplate = new Map<string, TemplateUse[]>();
  for (const row of used) {
    const list = byTemplate.get(row.templateId) ?? [];
    list.push({
      id: row.id,
      date: row.date.toISOString(),
      endDate: row.endDate ? row.endDate.toISOString() : null,
      type: row.type,
      luogo: row.luogo,
    });
    byTemplate.set(row.templateId, list);
  }

  return templates.map((tpl) => ({ ...tpl, usage: byTemplate.get(tpl.id) ?? [] }));
}
