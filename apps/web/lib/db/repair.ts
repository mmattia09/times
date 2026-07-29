import { and, eq, isNotNull, like } from "drizzle-orm";
import { db } from "./index";
import { performances, sessions } from "./schema";
import { mapSpecialitaToEvent, resultUnit } from "../athletics";
import { recomputePersonalBests } from "../records";

/**
 * Repairs races the FIDAL sync imported wrongly, on boot, once.
 *
 * Two bugs put bad rows in people's logs:
 *  - every field result was stored as published, in metres, while the app keeps
 *    jumps in centimetres — a 1,49 high jump became 1.49 cm;
 *  - "salto in lungo", "salto triplo" and "salto con l'asta" were all filed as
 *    high jump, because the check was a substring match and "salto" contains
 *    "alto".
 *
 * Only rows the sync itself created are touched, and the session note keeps the
 * specialità FIDAL published, so the correct event can simply be re-derived
 * rather than guessed. Idempotent: a repaired row no longer matches.
 */
const NOTE_PREFIX = "FIDAL · ";

type Fix = {
  performanceId: string;
  userId: string;
  set: Partial<{ discipline: "jump" | "throw" | "sprint"; distance: number | null; event: string | null; result: string }>;
  before: string;
  after: string;
};

/** A stored row as it comes back from the join. */
export type ImportedRow = {
  performanceId: string;
  userId: string;
  discipline: string;
  distance: number | null;
  event: string | null;
  result: string;
  note: string | null;
};

/**
 * What, if anything, is wrong with one imported row. Pure, so the rules can be
 * checked without a database standing behind them.
 */
export function planFix(r: ImportedRow): Fix | null {
  const specialita = (r.note ?? "").slice(NOTE_PREFIX.length).trim();
  const ev = mapSpecialitaToEvent(specialita);
  if (!ev) return null;

  const set: Fix["set"] = {};
  const misfiled =
    ev.discipline !== r.discipline || ev.distance !== r.distance || ev.event !== r.event;
  if (misfiled) {
    set.discipline = ev.discipline as Fix["set"]["discipline"];
    set.distance = ev.distance;
    set.event = ev.event;
  }

  // A jump is stored in centimetres, so anything under 30 was written in
  // metres — no jump on record is under 30 cm, and none reaches 30 m.
  const result = Number(r.result);
  if (resultUnit(ev) === "cm" && result > 0 && result < 30) {
    set.result = String(Math.round(result * 100));
  }

  if (Object.keys(set).length === 0) return null;
  return {
    performanceId: r.performanceId,
    userId: r.userId,
    set,
    before: `${r.discipline}/${r.distance ?? "-"}/${r.event ?? "-"} ${r.result}`,
    after: `${ev.discipline}/${ev.distance ?? "-"}/${ev.event ?? "-"} ${set.result ?? r.result}`,
  };
}

export async function repairFidalImports(): Promise<number> {
  const rows = await db
    .select({
      performanceId: performances.id,
      userId: performances.userId,
      discipline: performances.discipline,
      distance: performances.distance,
      event: performances.event,
      result: performances.result,
      note: sessions.note,
    })
    .from(performances)
    .innerJoin(sessions, eq(performances.sessionId, sessions.id))
    .where(and(isNotNull(sessions.fidalId), like(sessions.note, `${NOTE_PREFIX}%`)));

  const fixes = rows.map(planFix).filter((f): f is Fix => f !== null);

  if (fixes.length === 0) return 0;

  for (const fix of fixes) {
    await db
      .update(performances)
      .set({ ...fix.set, updatedAt: new Date() })
      .where(eq(performances.id, fix.performanceId));
    console.log(`  fixed ${fix.before}  →  ${fix.after}`);
  }

  // The results moved, so the records built on them have to be rebuilt.
  for (const userId of new Set(fixes.map((f) => f.userId))) {
    await recomputePersonalBests(userId);
  }

  return fixes.length;
}

async function main() {
  const fixed = await repairFidalImports();
  console.log(
    fixed === 0
      ? "Nothing to repair."
      : `Repaired ${fixed} imported result${fixed === 1 ? "" : "s"}.`,
  );
  process.exit(0);
}

// Only run standalone; importing the function elsewhere shouldn't start it.
if (process.argv[1]?.includes("repair")) {
  main().catch((err) => {
    console.error("Repair failed:", err);
    process.exit(1);
  });
}
