import { disciplineForDistance, dropBlankRows, repsFromWorkout } from "@/lib/quick-entry";
import { sessionInputSchema } from "@/lib/validation";

/**
 * The quick table fills itself from the workout attached to the session, so the
 * parsing has to be conservative: a wrong row is a row you delete by hand every
 * single time, and enough of those and the button is worse than no button.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

/** Rows with no label of their own, i.e. one block each. */
const reps = (...ripetute: string[]) =>
  repsFromWorkout(ripetute.map((r, i) => ({ label: String(i + 1), ripetute: r })));

/** Rows exactly as a workout holds them: label, then continuation rows. */
const rows = (...blocks: Array<[string | null, string]>) =>
  repsFromWorkout(blocks.map(([label, ripetute]) => ({ label, ripetute })));

// ── What counts as a set of runs ────────────────────────────────────────────

check("6 x 30m is six rows of 30", reps("6 x 30m").join(",") === "30,30,30,30,30,30", reps("6 x 30m").join(","));
check("the × sign works too", reps("4 × 60m").join(",") === "60,60,60,60");
check("no spaces is fine", reps("3x150m").join(",") === "150,150,150");
check("a space before the m is fine", reps("2 x 120 m").join(",") === "120,120");
check("trailing words are ignored", reps("4 x 60m dai blocchi").join(",") === "60,60,60,60");
check("a bare distance is one row", reps("150m").join(",") === "150");
check("blocks add up in order", reps("2 x 30m", "1 x 60m").join(",") === "30,30,60");

// ── What must not become rows ──────────────────────────────────────────────

check("a gym block is not runs", reps("Squat 4 x 5").length === 0, reps("Squat 4 x 5").join(","));
check("minutes are not metres", reps("20' corsa lenta").length === 0);
check("a drill count is not a distance", reps("8 stacchi da 6 appoggi").length === 0);
check("an empty block gives nothing", reps("", "   ").length === 0);
check("no workout gives nothing", repsFromWorkout(null).length === 0);
check("undefined reps give nothing", repsFromWorkout([{ ripetute: null }]).length === 0);

// A misread "200 x 400m" must not produce 200 rows.
check("an absurd count is capped", reps("200 x 400m").length === 24, String(reps("200 x 400m").length));

// ── Groups, and blocks done more than once ─────────────────────────────────

// The shape a real workout has: a labelled row, then rows continuing it.
check(
  "unlabelled rows continue the block above",
  rows(["1", "60m"], [null, "80m"], [null, "100m"]).join(",") === "60,80,100",
  rows(["1", "60m"], [null, "80m"], [null, "100m"]).join(","),
);

// "3 x 2" on the block, holding 60/80/100 → three times through the three.
const pyramid = rows(["1", "3 x 30m"], ["3 x 2", "60m"], [null, "80m"], [null, "100m"]);
check(
  "a block label that multiplies repeats the whole group",
  pyramid.join(",") === "30,30,30,60,80,100,60,80,100,60,80,100",
  pyramid.join(","),
);
check("which is 3 + 3 × 3 rows", pyramid.length === 12, String(pyramid.length));

check(
  "the × sign works in the label too",
  rows(["2 × 3", "150m"], [null, "300m"]).join(",") === "150,300,150,300",
);

// A plain number is the block's position, not a set count: tripling someone's
// session because their third block is called "3" would be silent and wrong.
check(
  "a bare number in the label is not a multiplier",
  rows(["3", "150m"]).join(",") === "150",
  rows(["3", "150m"]).join(","),
);
check("a word label is not a multiplier", rows(["piramidale", "100m"]).join(",") === "100");

// A group whose rows hold nothing measurable contributes nothing, even ×3.
check("an empty group stays empty however many sets", rows(["3 x", "20' easy"]).length === 0);

// The cap still applies across repeated groups.
check("repeats can't blow past the cap", rows(["20 x", "100m"], [null, "200m"]).length === 24);

// ── Where a distance belongs ───────────────────────────────────────────────

check("60m is a sprint", disciplineForDistance(60) === "sprint");
check("400m is still a sprint", disciplineForDistance(400) === "sprint");
check("800m is middle distance", disciplineForDistance(800) === "middle_distance");
check("1500m is middle distance", disciplineForDistance(1500) === "middle_distance");
check("3000m is long distance", disciplineForDistance(3000) === "long_distance");

// ── Rows started and left empty ────────────────────────────────────────────

// Both editors hand out empty rows on purpose, so both must be able to throw
// them away — a blank one used to fail validation on a field the page doesn't
// render, and the form refused to save without saying why.

const cleaned = dropBlankRows({
  performances: [
    { distance: 60, result: "7.12" },
    { distance: 100, result: "   " },
    { distance: 150, result: "" },
  ],
  links: [
    { url: "https://strava.com/x", label: null },
    { url: "", label: "un'etichetta senza indirizzo" },
    { url: "  ", label: null },
  ],
});

check("a timed rep is kept", cleaned.performances.length === 1, String(cleaned.performances.length));
check("an untimed rep is dropped", cleaned.performances.every((p) => p.result.trim() !== ""));
check("a link with an address is kept", cleaned.links.length === 1, String(cleaned.links.length));
check("a link row with no address is dropped", cleaned.links.every((l) => l.url.trim() !== ""));
check("a label without an address goes too", !cleaned.links.some((l) => l.label?.includes("senza")));

// Absent arrays are the create form before you touch anything.
const empty = dropBlankRows({});
check("nothing in, nothing out", empty.performances.length === 0 && empty.links.length === 0);

// The whole point: what survives the cleaning is what the schema accepts.
const blankLinkLeftBehind = {
  date: "2026-08-20",
  type: "training" as const,
  links: [{ url: "", label: null }],
  performances: [],
};
check(
  "a blank link row is rejected by the schema",
  !sessionInputSchema.safeParse(blankLinkLeftBehind).success,
);
check(
  "and passes once the form has cleaned it",
  sessionInputSchema.safeParse(dropBlankRows(blankLinkLeftBehind)).success,
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
