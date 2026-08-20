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

/** The distances one row of reps describes: "3 x 30m" → [30, 30, 30]. */
function distancesInRow(ripetute: string | null | undefined): number[] {
  const text = (ripetute ?? "").replace(/×/g, "x");
  if (!text.trim()) return [];

  // "6 x 30m", "4x60 m", "2 x 120m in scioltezza"
  const repeated = text.match(/(\d{1,3})\s*x\s*(\d{1,5})\s*m\b/i);
  if (repeated) {
    const count = Number(repeated[1]);
    const metres = Number(repeated[2]);
    if (count > 0 && metres > 0) return Array.from({ length: count }, () => metres);
    return [];
  }

  // A single distance on its own: "150m", "60 m lanciati".
  const single = text.match(/(?:^|[^\dx])(\d{1,5})\s*m\b/i);
  if (single) {
    const metres = Number(single[1]);
    if (metres > 0) return [metres];
  }
  return [];
}

/**
 * How many times a block's own label says to repeat it.
 *
 * A label is usually just the block's number — "1", "2" — but it also carries
 * the set count when the whole group repeats: a block labelled "3 x 2" holding
 * 60m, 80m and 100m means three times through those three. Only an explicit
 * multiplier counts, because a label of "3" is the third block, not three sets
 * of it, and guessing wrong there would silently triple someone's session.
 */
function groupRepeats(label: string | null | undefined): number {
  const m = (label ?? "").replace(/×/g, "x").match(/^\s*(\d{1,2})\s*x/i);
  return m ? Math.max(1, Number(m[1])) : 1;
}

/**
 * The distances a workout's reps describe, one entry per rep.
 *
 * Deliberately narrow about what counts as a run: only "N x Dm" and a bare "Dm".
 * A gym block reads "Squat 4 x 5" and a warm-up reads "20' easy running" —
 * neither is a set of measured runs, and inventing rows for them would mean
 * deleting them by hand every time, which is worse than not offering the button.
 *
 * Rows with no label continue the block above them (that is what the empty
 * label means in a workout), so a group is a labelled row plus its followers,
 * and the group's label can multiply the lot.
 */
export function repsFromWorkout(
  blocks: Array<{ label?: string | null; ripetute?: string | null }> | null | undefined,
): number[] {
  if (!blocks) return [];

  // Split into groups: a labelled row opens one, unlabelled rows join it.
  const groups: { repeats: number; distances: number[] }[] = [];
  for (const block of blocks) {
    const labelled = !!(block.label ?? "").trim();
    if (labelled || groups.length === 0) {
      groups.push({ repeats: groupRepeats(block.label), distances: [] });
    }
    groups[groups.length - 1].distances.push(...distancesInRow(block.ripetute));
  }

  const out: number[] = [];
  for (const group of groups) {
    if (group.distances.length === 0) continue;
    for (let set = 0; set < group.repeats; set++) {
      for (const metres of group.distances) {
        if (out.length >= MAX_ROWS) return out;
        out.push(metres);
      }
    }
  }
  return out;
}

/**
 * What the form actually submits: rows you started and never filled in.
 *
 * Both editors hand you an empty row on purpose — the quick table lays out
 * every rep of the workout so you can time the ones you ran, and Enter in the
 * links list opens the next line. Rows left blank are not mistakes to report
 * back, they are lines you didn't need, so they are dropped before validation
 * rather than rejected by it. The schema stays strict for the API, where an
 * empty result or a link with no address really is bad input.
 *
 * A link row used to survive this far and fail on links.N.url, which nothing on
 * the page renders: the form refused to save and said nothing at all.
 */
export function dropBlankRows<
  P extends { result?: unknown },
  L extends { url?: unknown },
  T extends { performances?: P[] | null; links?: L[] | null },
>(values: T): T & { performances: P[]; links: L[] } {
  const filled = (v: unknown) => `${v ?? ""}`.trim() !== "";
  return {
    ...values,
    performances: (values.performances ?? []).filter((p) => filled(p?.result)),
    links: (values.links ?? []).filter((l) => filled(l?.url)),
  };
}
