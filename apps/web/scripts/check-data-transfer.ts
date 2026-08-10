import { EXPORT_VERSION, exportFileSchema, sessionSignature } from "@/lib/data-transfer";

/**
 * The export file is the only backup this app has.
 *
 * Everything else can be re-derived — records are recomputed, FIDAL can be
 * synced again — but if an export can't be imported back, or importing it
 * quietly drops half a training year, the data is gone and nobody finds out
 * until they look for a session that isn't there. So the rules that matter
 * here are: the same file imported twice changes nothing, two different
 * sessions are never mistaken for one, and a file we don't understand is
 * refused rather than half-read.
 *
 * Both are pure decisions, so they are checked without a database.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

// ── Signature: the same session must sign the same, always ──────────────────

const race = {
  date: "2026-06-06T00:00:00.000Z",
  type: "competition",
  luogo: "Rieti",
  performances: [
    { discipline: "sprint", distance: 100, event: null, result: 11.18 },
    { discipline: "jump", distance: null, event: "lungo", result: 658 },
  ],
};

check("a session signs the same twice", sessionSignature(race) === sessionSignature(race));

// The database hands back Dates and strings for numerics; the file has strings
// and numbers. Both must reach the same signature or every re-import doubles.
check(
  "a row from the database matches the same session from the file",
  sessionSignature({
    date: new Date("2026-06-06T00:00:00.000Z"),
    type: "competition",
    luogo: "Rieti",
    performances: [
      { discipline: "sprint", distance: 100, event: null, result: "11.18" },
      { discipline: "jump", distance: null, event: "lungo", result: "658.00" },
    ],
  }) === sessionSignature(race),
);

check(
  "the order results were listed in doesn't matter",
  sessionSignature({ ...race, performances: [...race.performances].reverse() }) ===
    sessionSignature(race),
);

// ── Signature: different sessions must not collide ──────────────────────────

// The bug this replaced: keyed on date and marks alone, every session with no
// measured result collided with every other one that day, so a morning and an
// afternoon session became one.
const morning = {
  date: "2026-03-10T00:00:00.000Z",
  type: "training",
  workout: { name: "Block starts", blocks: [{ ripetute: "6 x 30m" }] },
  performances: [],
};
const afternoon = {
  date: "2026-03-10T00:00:00.000Z",
  type: "training",
  workout: { name: "Strength — gym", blocks: [{ ripetute: "Squat 4 x 5" }] },
  performances: [],
};
check(
  "two workouts on the same day are two sessions",
  sessionSignature(morning) !== sessionSignature(afternoon),
  sessionSignature(morning),
);

check(
  "two unnamed workouts on the same day are still two sessions",
  sessionSignature({ ...morning, workout: { name: null, blocks: [{ ripetute: "4 x 60m" }] } }) !==
    sessionSignature({ ...morning, workout: { name: null, blocks: [{ ripetute: "3 x 150m" }] } }),
);

check(
  "a race and a training session on the same empty day differ",
  sessionSignature({ date: "2026-03-10", type: "training", performances: [] }) !==
    sessionSignature({ date: "2026-03-10", type: "competition", performances: [] }),
);

check(
  "the same mark at two venues differs",
  sessionSignature({ ...race, luogo: "Grosseto" }) !== sessionSignature(race),
);

check(
  "venue case and padding are not a difference",
  sessionSignature({ ...race, luogo: "  rieti " }) === sessionSignature(race),
);

// 100m flat and 100m hurdles are not the same 100m — the personal-best key
// already knows this, and the import key has to agree.
check(
  "the discipline is part of the key",
  sessionSignature({
    ...race,
    performances: [{ discipline: "hurdles", distance: 100, event: null, result: 11.18 }],
  }) !==
    sessionSignature({
      ...race,
      performances: [{ discipline: "sprint", distance: 100, event: null, result: 11.18 }],
    }),
);

check(
  "a multi-day competition differs from the single day it starts on",
  sessionSignature({ ...race, endDate: "2026-06-07" }) !== sessionSignature(race),
);

check(
  "a different note is a different session",
  sessionSignature({ ...race, note: "windy" }) !== sessionSignature({ ...race, note: "cold" }),
);

// ── The file itself ─────────────────────────────────────────────────────────

const file = (over: Record<string, unknown> = {}) => ({
  app: "athletics-tracker",
  version: EXPORT_VERSION,
  exportedAt: "2026-08-10T00:00:00.000Z",
  settings: null,
  goals: [],
  workoutTemplates: [],
  apiKeys: [],
  sessions: [],
  ...over,
});

check("an export of this version is accepted", exportFileSchema.safeParse(file()).success);

// A file from a newer Times may hold fields this version drops on the floor.
// Importing what we recognise and discarding the rest looks like success and
// isn't, so it has to be refused.
const tooNew = exportFileSchema.safeParse(file({ version: EXPORT_VERSION + 1 }));
check("a file from a newer version is refused", !tooNew.success);
check(
  "and says why, so the message can be 'update the app'",
  !tooNew.success && tooNew.error.issues.some((i) => i.message === "errors.importTooNew"),
  !tooNew.success ? JSON.stringify(tooNew.error.issues.map((i) => i.message)) : "",
);

check("version 0 is refused", !exportFileSchema.safeParse(file({ version: 0 })).success);
check(
  "another app's JSON is refused",
  !exportFileSchema.safeParse(file({ app: "something-else" })).success,
);

// A session whose period ends before it starts is a period nothing can draw;
// the form refuses it, so the file has to as well.
check(
  "a session ending before it starts is refused",
  !exportFileSchema.safeParse(
    file({
      sessions: [{ date: "2026-06-06", endDate: "2026-06-01", performances: [] }],
    }),
  ).success,
);

check(
  "a plain session with no results is accepted",
  exportFileSchema.safeParse(file({ sessions: [{ date: "2026-06-06", performances: [] }] })).success,
);

// Nothing else bounds this: 20 000 sessions were capped, the results inside
// them were not, so one session could carry millions.
check(
  "an absurd number of results in one session is refused",
  !exportFileSchema.safeParse(
    file({
      sessions: [
        {
          date: "2026-06-06",
          performances: Array.from({ length: 201 }, () => ({
            discipline: "sprint",
            distance: 100,
            result: 11.2,
          })),
        },
      ],
    }),
  ).success,
);

// An export taken before links, workouts or a locale existed must still import:
// the whole point is reading the file you saved two versions ago.
const old = exportFileSchema.safeParse(
  file({
    sessions: [{ date: "2026-06-06", performances: [{ discipline: "sprint", distance: 100, result: 11.2 }] }],
    settings: { fidalUrl: null, seasonStartMonth: 10, defaultDistances: [60, 100] },
  }),
);
check("an older export still imports", old.success, old.success ? "" : JSON.stringify(old.error.issues));
check(
  "and its missing links default to none",
  old.success && Array.isArray(old.data.sessions[0].links) && old.data.sessions[0].links.length === 0,
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
