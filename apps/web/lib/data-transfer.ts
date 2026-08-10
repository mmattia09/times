import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  apiKeys,
  goals,
  sessions,
  userSettings,
  workoutTemplates,
} from "@/lib/db/schema";
import { isLocale } from "@/lib/i18n";
import { isValidTimeZone } from "@/lib/timezone";
import { recomputePersonalBests } from "@/lib/records";
import { createSession, listSessions } from "@/lib/services";
import {
  goalInputSchema,
  sessionLinkSchema,
  sessionInputSchema,
  workoutTemplateInputSchema,
  sessionWorkoutSchema,
} from "@/lib/validation";

/**
 * Full-instance JSON export/import. The export contains ALL user data —
 * sessions (with performances and workouts), workout templates, goals,
 * settings and API keys (hashes only; raw keys are never stored) — so moving
 * to a new instance is: export → register → import. Auth credentials are the
 * one thing not exported: passwords are re-created on the new instance.
 */

export const EXPORT_VERSION = 1;

const exportSessionSchema = sessionInputSchema
  .extend({
    fidalId: z.string().max(128).nullable().optional(),
    workout: sessionWorkoutSchema.nullable().optional(),
    // Optional so an export taken before links existed still imports.
    links: z.array(sessionLinkSchema).max(20).default([]),
  })
  // The same rule the form applies. An imported session that ends before it
  // starts would otherwise be a period no view can draw.
  .refine((s) => !s.endDate || Date.parse(s.endDate) >= Date.parse(s.date), {
    message: "validation.endBeforeStart",
    path: ["endDate"],
  });

const exportApiKeySchema = z.object({
  label: z.string().max(64),
  keyHash: z.string().regex(/^[a-f0-9]{64}$/, "Hash chiave non valido"),
  prefix: z.string().max(32),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

// Upper bounds so a hand-crafted file can't exhaust memory or run for hours.
// Generous vs. a real career: ~55 years at 200 sessions/year.
const MAX_SESSIONS = 20_000;
const MAX_TEMPLATES = 2_000;
const MAX_GOALS = 500;
const MAX_KEYS = 100;

export const exportFileSchema = z.object({
  app: z.literal("athletics-tracker"),
  /**
   * Refuse a file from a newer version of the app rather than importing the
   * parts we happen to recognise: a format we don't know is a format we would
   * silently drop half of, and the person doing it believes their data arrived.
   */
  version: z
    .number()
    .int()
    .min(1)
    .max(EXPORT_VERSION, { message: "errors.importTooNew" }),
  exportedAt: z.string(),
  settings: z
    .object({
      fidalUrl: z.string().nullable(),
      seasonStartMonth: z.number().int().min(1).max(12),
      defaultDistances: z.array(z.number()).max(50).nullable(),
      // Optional so exports taken before these existed still import.
      locale: z.string().max(8).optional(),
      timezone: z.string().max(64).nullable().optional(),
    })
    .nullable(),
  goals: z.array(goalInputSchema).max(MAX_GOALS),
  workoutTemplates: z.array(workoutTemplateInputSchema).max(MAX_TEMPLATES),
  apiKeys: z.array(exportApiKeySchema).max(MAX_KEYS),
  sessions: z.array(exportSessionSchema).max(MAX_SESSIONS),
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export async function buildExport(userId: string): Promise<ExportFile> {
  const [allSessions, [settings], allGoals, templates, keys] = await Promise.all([
    listSessions(userId),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(workoutTemplates).where(eq(workoutTemplates.userId, userId)),
    db.select().from(apiKeys).where(eq(apiKeys.userId, userId)),
  ]);

  return {
    app: "athletics-tracker",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settings
      ? {
          fidalUrl: settings.fidalUrl,
          seasonStartMonth: settings.seasonStartMonth,
          defaultDistances: settings.defaultDistances,
          locale: settings.locale,
          timezone: settings.timezone,
        }
      : null,
    goals: allGoals.map((g) => ({
      discipline: g.discipline,
      distance: g.distance,
      event: g.event,
      target: Number(g.target),
      note: g.note,
    })),
    workoutTemplates: templates.map((t) => ({
      name: t.name,
      category: t.category,
      description: t.description,
      blocks: t.blocks,
    })),
    apiKeys: keys.map((k) => ({
      label: k.label,
      keyHash: k.keyHash,
      prefix: k.prefix,
      revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    })),
    sessions: allSessions.map((s) => ({
      date: s.date.toISOString(),
      endDate: s.endDate ? s.endDate.toISOString() : null,
      type: s.type,
      tempo: s.tempo,
      livello: s.livello,
      luogo: s.luogo,
      organizzatore: s.organizzatore,
      tipo: s.tipo,
      note: s.note,
      links: s.links ?? [],
      fidalId: s.fidalId,
      workout: s.workout ?? null,
      performances: s.performances.map((p) => ({
        discipline: p.discipline,
        distance: p.distance,
        event: p.event,
        result: Number(p.result),
        wind: p.wind != null ? Number(p.wind) : null,
        lane: p.lane,
        position: p.position,
        heat: p.heat,
      })),
    })),
  };
}

/** The shape sessionSignature needs, from either an export file or the database. */
export type SignableSession = {
  date: string | Date;
  endDate?: string | Date | null;
  type?: string | null;
  luogo?: string | null;
  note?: string | null;
  workout?: { name?: string | null; blocks?: Array<{ ripetute?: string | null }> } | null;
  performances: Array<{
    discipline?: string | null;
    distance: number | null;
    event: string | null;
    result: number | string;
  }>;
};

const day = (v: string | Date): string =>
  (typeof v === "string" ? new Date(v) : v).toISOString().slice(0, 10);

/**
 * Content signature used to dedup sessions on import, so re-importing the same
 * file changes nothing.
 *
 * It has to describe the whole session, not just its marks. Keying on date and
 * results alone made every session with no measured result — a gym session, a
 * technique session, anything with just a workout attached, which is most of a
 * training year — collide with every other one on that date: import a Tuesday
 * with a morning and an afternoon session and only the morning arrived. It
 * also has to include the discipline, for the same reason the personal-best
 * key does: 100m flat and 100m hurdles are not the same 100m.
 *
 * Two sessions identical in all of this really are indistinguishable, and
 * treating the second as already-present is the safe way to be wrong.
 */
export function sessionSignature(s: SignableSession): string {
  const perfs = s.performances
    .map(
      (p) =>
        `${p.discipline ?? ""}:${p.distance ?? ""}:${p.event ?? ""}:${Number(p.result).toFixed(2)}`,
    )
    .sort()
    .join(",");
  // Two unnamed workouts on the same day are still two different sessions, so
  // the reps go into the signature as well as the name.
  const workout = s.workout
    ? `${s.workout.name ?? ""}~${(s.workout.blocks ?? []).map((b) => b.ripetute ?? "").join("~")}`
    : "";
  return [
    day(s.date),
    s.endDate ? day(s.endDate) : "",
    s.type ?? "",
    (s.luogo ?? "").trim().toLowerCase(),
    (s.note ?? "").trim(),
    workout,
    perfs,
  ].join("|");
}

export type ImportReport = {
  sessions: { imported: number; skipped: number };
  workoutTemplates: { imported: number; skipped: number };
  goals: { imported: number; skipped: number };
  apiKeys: { imported: number; skipped: number };
  settings: boolean;
};

export async function importData(userId: string, data: ExportFile): Promise<ImportReport> {
  const report: ImportReport = {
    sessions: { imported: 0, skipped: 0 },
    workoutTemplates: { imported: 0, skipped: 0 },
    goals: { imported: 0, skipped: 0 },
    apiKeys: { imported: 0, skipped: 0 },
    settings: false,
  };

  // Sessions — dedup by fidalId and by content signature.
  const existing = await listSessions(userId);
  const existingSignatures = new Set(existing.map(sessionSignature));
  const existingFidalIds = new Set(existing.map((s) => s.fidalId).filter(Boolean));

  for (const s of data.sessions) {
    const dup =
      (s.fidalId && existingFidalIds.has(s.fidalId)) || existingSignatures.has(sessionSignature(s));
    if (dup) {
      report.sessions.skipped++;
      continue;
    }
    await createSession(userId, s, { fidalId: s.fidalId ?? null, recompute: false });
    existingSignatures.add(sessionSignature(s));
    report.sessions.imported++;
  }
  if (report.sessions.imported > 0) await recomputePersonalBests(userId);

  // Workout templates — dedup by (name, category).
  const existingTemplates = await db
    .select({ name: workoutTemplates.name, category: workoutTemplates.category })
    .from(workoutTemplates)
    .where(eq(workoutTemplates.userId, userId));
  const templateKeys = new Set(existingTemplates.map((t) => `${t.name}|${t.category ?? ""}`));
  for (const t of data.workoutTemplates) {
    const key = `${t.name}|${t.category ?? ""}`;
    if (templateKeys.has(key)) {
      report.workoutTemplates.skipped++;
      continue;
    }
    await db.insert(workoutTemplates).values({ userId, ...t });
    templateKeys.add(key);
    report.workoutTemplates.imported++;
  }

  // Goals — dedup by event key.
  const existingGoals = await db.select().from(goals).where(eq(goals.userId, userId));
  const goalKeys = new Set(
    existingGoals.map((g) => `${g.discipline}|${g.distance ?? ""}|${g.event ?? ""}`),
  );
  for (const g of data.goals) {
    const key = `${g.discipline}|${g.distance ?? ""}|${g.event ?? ""}`;
    if (goalKeys.has(key)) {
      report.goals.skipped++;
      continue;
    }
    await db.insert(goals).values({ ...g, userId, target: g.target.toString() });
    goalKeys.add(key);
    report.goals.imported++;
  }

  // API keys — dedup by hash (unique). Importing restores keys clients already hold.
  const existingKeys = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  const hashSet = new Set(existingKeys.map((k) => k.keyHash));
  for (const k of data.apiKeys) {
    if (hashSet.has(k.keyHash)) {
      report.apiKeys.skipped++;
      continue;
    }
    await db.insert(apiKeys).values({
      userId,
      label: k.label,
      keyHash: k.keyHash,
      prefix: k.prefix,
      revokedAt: k.revokedAt ? new Date(k.revokedAt) : null,
      createdAt: new Date(k.createdAt),
    });
    hashSet.add(k.keyHash);
    report.apiKeys.imported++;
  }

  // Settings — merge non-null values.
  if (data.settings) {
    await db
      .insert(userSettings)
      .values({
        userId,
        fidalUrl: data.settings.fidalUrl,
        seasonStartMonth: data.settings.seasonStartMonth,
        defaultDistances: data.settings.defaultDistances ?? undefined,
        ...(isLocale(data.settings.locale) ? { locale: data.settings.locale } : {}),
        ...(isValidTimeZone(data.settings.timezone) ? { timezone: data.settings.timezone } : {}),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          fidalUrl: data.settings.fidalUrl,
          seasonStartMonth: data.settings.seasonStartMonth,
          // Also on the update path: importing into an account that already
          // has a settings row is the normal case (registering creates one),
          // so leaving this out of the update meant the default distances were
          // exported faithfully and then never restored.
          ...(data.settings.defaultDistances
            ? { defaultDistances: data.settings.defaultDistances }
            : {}),
          ...(isLocale(data.settings.locale) ? { locale: data.settings.locale } : {}),
          ...(isValidTimeZone(data.settings.timezone) ? { timezone: data.settings.timezone } : {}),
          updatedAt: new Date(),
        },
      });
    report.settings = true;
  }

  return report;
}
