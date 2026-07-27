import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  performances,
  personalBests,
  sessions,
  type SessionWithPerformances,
} from "@/lib/db/schema";
import { recomputePersonalBests } from "@/lib/records";
import { parseSeasonKey, seasonRange } from "@/lib/season";
import type { SessionInput } from "@/lib/validation";

export type SessionFilters = {
  from?: string;
  to?: string;
  type?: "training" | "competition";
  distance?: number;
  organizzatore?: "fidal" | "csi" | "altro";
  livello?: "regionale" | "provinciale" | "nazionale" | "internazionale";
  tipo?: "outdoor" | "indoor";
  season?: string; // season key, e.g. "estiva-2025"
  q?: string; // free text over venue and notes
};

export type CreateSessionOptions = {
  fidalId?: string | null;
  /** Skip the PB recompute (callers doing bulk inserts recompute once at the end). */
  recompute?: boolean;
};

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Create a session and its performances, then recompute PBs (unless opted out). */
export async function createSession(
  userId: string,
  input: SessionInput,
  opts: CreateSessionOptions = {},
): Promise<string> {
  const { fidalId = null, recompute = true } = opts;
  const date = toDate(input.date);
  if (!date) throw new Error("Invalid date");

  const sessionId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sessions)
      .values({
        userId,
        date,
        endDate: toDate(input.endDate),
        type: input.type,
        tempo: input.tempo ?? null,
        livello: input.livello ?? null,
        luogo: input.luogo ?? null,
        organizzatore: input.organizzatore ?? null,
        tipo: input.tipo ?? null,
        note: input.note ?? null,
        workout: input.workout ?? null,
        fidalId: fidalId ?? null,
      })
      .returning({ id: sessions.id });

    // A session can have no measured results (e.g. "I trained that day").
    if (input.performances.length > 0) {
      await tx.insert(performances).values(
        input.performances.map((p) => ({
          sessionId: row.id,
          userId,
          discipline: p.discipline,
          distance: p.distance ?? null,
          event: p.event ?? null,
          result: p.result.toString(),
          wind: p.wind != null ? p.wind.toString() : null,
          lane: p.lane ?? null,
          position: p.position ?? null,
          heat: p.heat ?? null,
        })),
      );
    }
    return row.id;
  });

  if (recompute) await recomputePersonalBests(userId);
  return sessionId;
}

/** Replace a session and its performances. */
export async function updateSession(
  userId: string,
  sessionId: string,
  input: SessionInput,
): Promise<boolean> {
  const date = toDate(input.date);
  if (!date) throw new Error("Invalid date");

  const ok = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);
    if (!existing) return false;

    await tx
      .update(sessions)
      .set({
        date,
        endDate: toDate(input.endDate),
        type: input.type,
        tempo: input.tempo ?? null,
        livello: input.livello ?? null,
        luogo: input.luogo ?? null,
        organizzatore: input.organizzatore ?? null,
        tipo: input.tipo ?? null,
        note: input.note ?? null,
        workout: input.workout ?? null,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    await tx.delete(performances).where(eq(performances.sessionId, sessionId));
    if (input.performances.length > 0) {
      await tx.insert(performances).values(
        input.performances.map((p) => ({
          sessionId,
          userId,
          discipline: p.discipline,
          distance: p.distance ?? null,
          event: p.event ?? null,
          result: p.result.toString(),
          wind: p.wind != null ? p.wind.toString() : null,
          lane: p.lane ?? null,
          position: p.position ?? null,
          heat: p.heat ?? null,
        })),
      );
    }
    return true;
  });

  if (ok) await recomputePersonalBests(userId);
  return ok;
}

export async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  if (deleted.length === 0) return false;
  await recomputePersonalBests(userId);
  return true;
}

export async function getSessionById(
  userId: string,
  sessionId: string,
): Promise<SessionWithPerformances | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  if (!session) return null;
  const perfs = await db
    .select()
    .from(performances)
    .where(eq(performances.sessionId, sessionId))
    .orderBy(asc(performances.distance));
  return { ...session, performances: perfs };
}

export async function listSessions(
  userId: string,
  filters: SessionFilters = {},
): Promise<SessionWithPerformances[]> {
  const conds = [eq(sessions.userId, userId)];

  if (filters.season) {
    const season = parseSeasonKey(filters.season);
    if (season) {
      const { start, end } = seasonRange(season);
      // Half-open [start, end): lt(end) so a session at the next season's first
      // instant doesn't fall into both seasons.
      conds.push(gte(sessions.date, start), lt(sessions.date, end));
    }
  }
  const from = toDate(filters.from);
  const to = toDate(filters.to);
  if (from) conds.push(gte(sessions.date, from));
  if (to) conds.push(lte(sessions.date, to));
  if (filters.type) conds.push(eq(sessions.type, filters.type));
  if (filters.organizzatore) conds.push(eq(sessions.organizzatore, filters.organizzatore));
  if (filters.livello) conds.push(eq(sessions.livello, filters.livello));
  if (filters.tipo) conds.push(eq(sessions.tipo, filters.tipo));

  // Free-text, case-insensitive search over the two prose fields. The pattern
  // is a bound parameter and its wildcards are escaped, so a venue literally
  // called "100%" searches for that and not for everything.
  const q = filters.q?.trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(
      sql`(${sessions.luogo} ilike ${like} escape '\\' or ${sessions.note} ilike ${like} escape '\\')`,
    );
  }

  // Filter by distance via a subquery on performances.
  if (filters.distance != null) {
    conds.push(
      sql`exists (select 1 from ${performances} p where p.session_id = ${sessions.id} and p.distance = ${filters.distance})`,
    );
  }

  const rows = await db
    .select()
    .from(sessions)
    .where(and(...conds))
    .orderBy(desc(sessions.date));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const perfs = await db
    .select()
    .from(performances)
    .where(inArray(performances.sessionId, ids));

  const bySession = new Map<string, typeof perfs>();
  for (const p of perfs) {
    const list = bySession.get(p.sessionId) ?? [];
    list.push(p);
    bySession.set(p.sessionId, list);
  }
  return rows.map((r) => ({ ...r, performances: bySession.get(r.id) ?? [] }));
}

export async function getRecords(userId: string) {
  return db
    .select()
    .from(personalBests)
    .where(eq(personalBests.userId, userId))
    .orderBy(asc(personalBests.distance));
}

/** Distinct past luogo values for autocomplete. */
export async function getLuoghi(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ luogo: sessions.luogo })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  return rows
    .map((r) => r.luogo)
    .filter((l): l is string => !!l)
    .sort();
}
