import type { Discipline } from "@/lib/db/schema";

/**
 * Turning an attached workout into rows waiting for times.
 *
 * At the track the workout is already written down — "6 x 30m", "3 x 150m" —
 * and what you are actually doing is putting a time next to each rep. So the
 * reps become the rows, and you only type the numbers that don't already exist
 * on the page.
 */

/** Rows past this from one workout is a parse gone wrong, not a session. */
const MAX_ROWS = 24;

/**
 * The discipline a distance belongs to, so a quick row lands in the right
 * records: 400m and 800m are both "a run" to the person typing, but only one
 * of them is a sprint, and the personal-best key is per discipline.
 */
export function disciplineForDistance(metres: number): Discipline {
  if (metres <= 400) return "sprint";
  if (metres <= 1500) return "middle_distance";
  return "long_distance";
}

/**
 * The distances a workout's reps describe, one entry per rep.
 *
 * Deliberately narrow: only "N x Dm" and a bare "Dm" count. A gym block reads
 * "Squat 4 x 5" and a warm-up reads "20' easy running" — neither is a set of
 * measured runs, and inventing rows for them would mean deleting them by hand
 * every time, which is worse than not offering the button.
 */
export function repsFromWorkout(
  blocks: Array<{ ripetute?: string | null }> | null | undefined,
): number[] {
  if (!blocks) return [];
  const out: number[] = [];
  for (const block of blocks) {
    const text = (block.ripetute ?? "").replace(/×/g, "x");
    if (!text.trim()) continue;

    // "6 x 30m", "4x60 m", "2 x 120m in scioltezza"
    const repeated = text.match(/(\d{1,3})\s*x\s*(\d{1,5})\s*m\b/i);
    if (repeated) {
      const count = Number(repeated[1]);
      const metres = Number(repeated[2]);
      if (count > 0 && metres > 0) {
        for (let i = 0; i < count && out.length < MAX_ROWS; i++) out.push(metres);
      }
      continue;
    }

    // A single distance on its own: "150m", "60 m lanciati".
    const single = text.match(/(?:^|[^\dx])(\d{1,5})\s*m\b/i);
    if (single) {
      const metres = Number(single[1]);
      if (metres > 0 && out.length < MAX_ROWS) out.push(metres);
    }
  }
  return out;
}
