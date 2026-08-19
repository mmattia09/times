/**
 * A season's worth of invented data, for the README screenshots.
 *
 * The app ships empty, so every screenshot needs something to show. Doing that
 * by hand means the images can never be reproduced — and the one thing that
 * must never end up in them is real training data, which is exactly what is in
 * the database you develop against. So: a script, a separate database, and an
 * athlete who doesn't exist.
 *
 *   createdb times_demo && DATABASE_URL=…/times_demo pnpm db:migrate
 *   DATABASE_URL=…/times_demo pnpm tsx scripts/demo-data.ts
 *
 * It deletes everything belonging to the demo athlete before writing, so it can
 * be run again, and it refuses to touch a database that isn't on this machine.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  goals,
  performances,
  sessions,
  userSettings,
  users,
  workoutTemplates,
  type SessionLink,
  type WorkoutBlock,
} from "@/lib/db/schema";
import { recomputePersonalBests } from "@/lib/records";

// Not a safety net so much as a locked door: this script is destructive, and a
// DATABASE_URL pointing anywhere but this machine is a mistake, never a plan.
const url = process.env.DATABASE_URL ?? "";
const host = url.match(/@([^:/]+)/)?.[1] ?? "";
if (!/^(localhost|127\.0\.0\.1|::1|db)$/.test(host)) {
  console.error(`Refusing to write demo data to a non-local database (host: ${host || "?"}).`);
  process.exit(1);
}

const DEMO_EMAIL = "demo@example.com";

/** UTC midnight, the way the app stores a calendar day. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const block = (
  label: string | null,
  ripetute: string,
  recupero: string | null = null,
  ritmo: string | null = null,
): WorkoutBlock => ({ label, ripetute, recupero, pausa: null, ritmo, note: null });

const TEMPLATES = [
  {
    name: "Block starts",
    category: "technique",
    description: "Reaction and first contacts. Early in the week, always on fresh legs.",
    blocks: [
      block("warm-up", "20' easy running + mobility", null, "easy"),
      block("1", "6 x 30m from blocks", "5'", "max"),
      block("2", "4 x 60m from blocks", "6'", "max"),
      block("cool-down", "10' easy running"),
    ],
  },
  {
    name: "Short speed endurance",
    category: "endurance",
    description: "The 200m session. Heavy — never the day before a race.",
    blocks: [
      block("warm-up", "25' + strides"),
      block("1", "3 x 150m", "8'", "95%"),
      block("2", "2 x 120m", "10'", "95%"),
      block("cool-down", "15' + stretching"),
    ],
  },
  {
    name: "Pure speed",
    category: "speed",
    description: "Low volume, all quality. Recoveries genuinely long.",
    blocks: [
      block("warm-up", "20' + drills"),
      block("1", "4 x 60m flying", "7'", "max"),
      block("2", "3 x 80m", "8'", "max"),
    ],
  },
  {
    name: "Long jump — run-up",
    category: "technique",
    description: "Measuring the run-up, take-offs at race rhythm.",
    blocks: [
      block("warm-up", "20' + hip mobility"),
      block("1", "6 full run-ups, no take-off"),
      block("2", "8 take-offs from 6 steps", "3'"),
      block("3", "4 full jumps", "5'"),
    ],
  },
  {
    name: "Strength — gym",
    category: "strength",
    description: "Winter block. Loads as a percentage of the one-rep max.",
    blocks: [
      block("1", "Squat 4 x 5", "3'", "80%"),
      block("2", "Deadlift 4 x 4", "3'", "75%"),
      block("3", "Lunges 3 x 8 per leg", "2'"),
      block("4", "Core 3 x 40''", "1'"),
    ],
  },
  {
    name: "Pre-race taper",
    category: "speed",
    description: "Two days out. Meant to feel fast, not to tire you.",
    blocks: [
      block("warm-up", "15' easy running"),
      block("1", "3 x 30m flying", "4'", "sharp"),
      block("2", "2 x 60m relaxed", "5'", "90%"),
    ],
  },
];

type Perf = {
  discipline: "sprint" | "jump" | "test";
  distance?: number | null;
  event?: string | null;
  result: number;
  wind?: number | null;
  lane?: number | null;
  position?: number | null;
  heat?: string | null;
};

type DemoSession = {
  date: string;
  endDate?: string;
  type: "training" | "competition";
  luogo?: string;
  tipo?: "indoor" | "outdoor";
  tempo?: "elettronico" | "cronometro" | "manuale";
  livello?: "provinciale" | "regionale" | "nazionale" | "internazionale";
  organizzatore?: "fidal" | "csi" | "altro";
  note?: string;
  template?: number;
  links?: SessionLink[];
  perfs?: Perf[];
};

/**
 * One athlete's year: an indoor winter over 60m, an outdoor season over 100
 * and 200, long jump alongside, and the training in between. The results
 * improve over the year the way a season actually goes — unevenly, with a bad
 * meeting in the middle.
 */
const SESSIONS: DemoSession[] = [
  // ── Autumn: base work ───────────────────────────────────────────────────
  { date: "2025-10-07", type: "training", luogo: "Padova", tipo: "outdoor", template: 4 },
  { date: "2025-10-14", type: "training", luogo: "Padova", tipo: "outdoor", template: 4 },
  { date: "2025-10-21", type: "training", luogo: "Padova", tipo: "outdoor", template: 1 },
  { date: "2025-11-04", type: "training", luogo: "Padova", tipo: "indoor", template: 4 },
  {
    date: "2025-11-18",
    type: "training",
    luogo: "Padova",
    tipo: "indoor",
    template: 0,
    perfs: [{ discipline: "test", event: "lungo_fermo", result: 268 }],
  },
  { date: "2025-12-02", type: "training", luogo: "Padova", tipo: "indoor", template: 2 },
  {
    date: "2025-12-16",
    type: "training",
    luogo: "Padova",
    tipo: "indoor",
    template: 0,
    note: "Timed run at the end of the session, out of the blocks.",
    perfs: [{ discipline: "sprint", distance: 60, result: 7.31 }],
  },

  // ── Winter: the indoor season ───────────────────────────────────────────
  {
    date: "2026-01-17",
    type: "competition",
    luogo: "Ancona",
    tipo: "indoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "fidal",
    note: "First race of the indoor season. Tight start, the rest was fine.",
    perfs: [
      { discipline: "sprint", distance: 60, result: 7.24, lane: 4, position: 3, heat: "heat 2" },
      { discipline: "sprint", distance: 60, result: 7.19, lane: 5, position: 2, heat: "B final" },
    ],
  },
  { date: "2026-01-27", type: "training", luogo: "Padova", tipo: "indoor", template: 5 },
  {
    date: "2026-02-07",
    type: "competition",
    luogo: "Ancona",
    tipo: "indoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "fidal",
    perfs: [
      { discipline: "sprint", distance: 60, result: 7.12, lane: 3, position: 2, heat: "heat 1" },
      { discipline: "jump", event: "lungo", result: 612, position: 4 },
    ],
    links: [{ url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", label: "Final — video" }],
  },
  { date: "2026-02-17", type: "training", luogo: "Padova", tipo: "indoor", template: 2 },
  {
    date: "2026-02-21",
    endDate: "2026-02-22",
    type: "competition",
    luogo: "Ancona",
    tipo: "indoor",
    tempo: "elettronico",
    livello: "nazionale",
    organizzatore: "fidal",
    note: "National indoor championships. Two days: 60m Saturday, long jump Sunday.",
    perfs: [
      { discipline: "sprint", distance: 60, result: 7.06, lane: 4, position: 1, heat: "heat 3" },
      { discipline: "sprint", distance: 60, result: 7.04, lane: 4, position: 5, heat: "final" },
      { discipline: "jump", event: "lungo", result: 638, position: 6 },
    ],
  },

  // ── Spring: back outdoors ───────────────────────────────────────────────
  { date: "2026-03-10", type: "training", luogo: "Padova", tipo: "outdoor", template: 0 },
  { date: "2026-03-17", type: "training", luogo: "Padova", tipo: "outdoor", template: 2 },
  {
    date: "2026-03-24",
    type: "training",
    luogo: "Padova",
    tipo: "outdoor",
    template: 3,
    note: "Run-up sorted out: 18 steps, clean take-off.",
  },
  { date: "2026-03-31", type: "training", luogo: "Padova", tipo: "outdoor", template: 1 },
  {
    date: "2026-04-11",
    type: "competition",
    luogo: "Trieste",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "fidal",
    note: "Outdoor opener. Cold, and a headwind in every heat.",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.42, wind: -1.2, lane: 5, position: 3, heat: "heat 1" },
      { discipline: "sprint", distance: 200, result: 23.18, wind: -0.8, lane: 6, position: 4 },
    ],
  },
  { date: "2026-04-14", type: "training", luogo: "Padova", tipo: "outdoor", template: 5 },
  { date: "2026-04-21", type: "training", luogo: "Padova", tipo: "outdoor", template: 2 },
  {
    date: "2026-04-25",
    type: "competition",
    luogo: "Firenze",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "fidal",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.28, wind: 0.4, lane: 4, position: 2, heat: "heat 2" },
      { discipline: "jump", event: "lungo", result: 645, wind: 1.1, position: 3 },
    ],
    links: [
      { url: "https://www.strava.com/activities/1234567890", label: null },
      { url: "https://www.instagram.com/p/CxxxxxxxxxX/", label: "Meeting photos" },
    ],
  },
  { date: "2026-05-05", type: "training", luogo: "Padova", tipo: "outdoor", template: 0 },
  {
    date: "2026-05-09",
    type: "competition",
    luogo: "Grosseto",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "nazionale",
    organizzatore: "fidal",
    note: "Wind over the limit in the final: good time, not record-legal.",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.21, wind: 1.8, lane: 4, position: 2, heat: "heat 1" },
      { discipline: "sprint", distance: 100, result: 11.05, wind: 2.6, lane: 4, position: 1, heat: "final" },
    ],
  },
  { date: "2026-05-19", type: "training", luogo: "Padova", tipo: "outdoor", template: 2 },
  {
    date: "2026-05-23",
    type: "competition",
    luogo: "Bolzano",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "csi",
    note: "Bad day, empty legs from the gun.",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.48, wind: 0.2, lane: 3, position: 6 },
      { discipline: "sprint", distance: 200, result: 23.34, wind: -0.4, lane: 3, position: 5 },
    ],
  },
  { date: "2026-05-26", type: "training", luogo: "Padova", tipo: "outdoor", template: 4 },
  { date: "2026-06-02", type: "training", luogo: "Padova", tipo: "outdoor", template: 3 },
  {
    date: "2026-06-06",
    type: "competition",
    luogo: "Rieti",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "nazionale",
    organizzatore: "fidal",
    note: "A clean race at last: 11.18 with legal wind.",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.18, wind: 1.4, lane: 5, position: 2, heat: "final" },
      { discipline: "jump", event: "lungo", result: 658, wind: 0.9, position: 2 },
    ],
  },
  { date: "2026-06-09", type: "training", luogo: "Padova", tipo: "outdoor", template: 5 },
  { date: "2026-06-16", type: "training", luogo: "Padova", tipo: "outdoor", template: 0 },
  {
    date: "2026-06-20",
    endDate: "2026-06-21",
    type: "competition",
    luogo: "Rieti",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "nazionale",
    organizzatore: "fidal",
    note: "National championships. 100m Saturday, 200m Sunday.",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.12, wind: 0.7, lane: 4, position: 1, heat: "heat 2" },
      { discipline: "sprint", distance: 100, result: 11.09, wind: 1.2, lane: 4, position: 4, heat: "final" },
      { discipline: "sprint", distance: 200, result: 22.86, wind: 0.5, lane: 5, position: 3, heat: "final" },
    ],
    links: [{ url: "https://www.tiktok.com/@atletica/video/7300000000000000000", label: null }],
  },
  { date: "2026-06-30", type: "training", luogo: "Padova", tipo: "outdoor", template: 2 },
  {
    date: "2026-07-04",
    type: "competition",
    luogo: "Firenze",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "fidal",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.15, wind: -0.3, lane: 4, position: 2 },
      { discipline: "jump", event: "lungo", result: 651, wind: 0.6, position: 3 },
    ],
  },
  { date: "2026-07-07", type: "training", luogo: "Padova", tipo: "outdoor", template: 0 },
  { date: "2026-07-14", type: "training", luogo: "Padova", tipo: "outdoor", template: 5 },
  {
    date: "2026-07-18",
    type: "competition",
    luogo: "Padova",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "regionale",
    organizzatore: "fidal",
    note: "Home meeting. PB over 200m, and a long jump one centimetre off the record.",
    perfs: [
      { discipline: "sprint", distance: 200, result: 22.74, wind: 1.0, lane: 4, position: 1, heat: "final" },
      { discipline: "jump", event: "lungo", result: 657, wind: 1.3, position: 1 },
    ],
  },
  {
    date: "2026-07-21",
    type: "training",
    luogo: "Padova",
    tipo: "outdoor",
    template: 0,
    perfs: [
      { discipline: "test", event: "lungo_fermo", result: 284 },
      { discipline: "test", event: "sargent", result: 58 },
    ],
  },
  { date: "2026-07-28", type: "training", luogo: "Padova", tipo: "outdoor", template: 2 },
  {
    date: "2026-08-01",
    type: "competition",
    luogo: "Grosseto",
    tipo: "outdoor",
    tempo: "elettronico",
    livello: "nazionale",
    organizzatore: "fidal",
    note: "Last one before the break: PB over 100m.",
    perfs: [
      { discipline: "sprint", distance: 100, result: 11.02, wind: 1.1, lane: 4, position: 1, heat: "final" },
      { discipline: "sprint", distance: 200, result: 22.81, wind: 0.3, lane: 5, position: 2 },
    ],
  },
  { date: "2026-08-04", type: "training", luogo: "Padova", tipo: "outdoor", template: 5 },
];

const GOALS = [
  { discipline: "sprint" as const, distance: 100, event: null, target: "10.90", note: "Qualifying mark for the nationals." },
  { discipline: "sprint" as const, distance: 200, event: null, target: "22.50", note: null },
  { discipline: "sprint" as const, distance: 60, event: null, target: "7.00", note: "Under 7 indoors." },
  { discipline: "jump" as const, distance: null, event: "lungo", target: "680", note: null },
];

async function main(): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!user) {
    console.error(`No ${DEMO_EMAIL} user. Run db:seed with ADMIN_EMAIL=${DEMO_EMAIL} first.`);
    process.exit(1);
  }
  const userId = user.id;

  await db.update(users).set({ name: "Demo Athlete" }).where(eq(users.id, userId));
  await db.insert(userSettings).values({ userId }).onConflictDoNothing();
  await db.update(userSettings).set({ locale: "en", theme: "system" }).where(eq(userSettings.userId, userId));

  // Rerunnable: performances and personal bests go with their sessions.
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(workoutTemplates).where(eq(workoutTemplates.userId, userId));
  await db.delete(goals).where(eq(goals.userId, userId));

  const templateIds = await Promise.all(
    TEMPLATES.map(async (tpl) => {
      const [row] = await db.insert(workoutTemplates).values({ userId, ...tpl }).returning({ id: workoutTemplates.id });
      return row.id;
    }),
  );

  for (const s of SESSIONS) {
    const tpl = s.template != null ? TEMPLATES[s.template] : null;
    const [row] = await db
      .insert(sessions)
      .values({
        userId,
        date: day(s.date),
        endDate: s.endDate ? day(s.endDate) : null,
        type: s.type,
        luogo: s.luogo ?? null,
        tipo: s.tipo ?? null,
        tempo: s.tempo ?? null,
        livello: s.livello ?? null,
        organizzatore: s.organizzatore ?? null,
        note: s.note ?? null,
        links: s.links ?? [],
        workout: tpl
          ? { templateId: templateIds[s.template as number], name: tpl.name, blocks: tpl.blocks }
          : null,
      })
      .returning({ id: sessions.id });

    for (const [order, p] of (s.perfs ?? []).entries()) {
      await db.insert(performances).values({
        sessionId: row.id,
        userId,
        sortOrder: order,
        discipline: p.discipline,
        distance: p.distance ?? null,
        event: p.event ?? null,
        result: p.result.toFixed(2),
        wind: p.wind != null ? p.wind.toFixed(2) : null,
        lane: p.lane ?? null,
        position: p.position ?? null,
        heat: p.heat ?? null,
      });
    }
  }

  await db.insert(goals).values(GOALS.map((g) => ({ userId, ...g })));
  await recomputePersonalBests(userId);

  const perfCount = SESSIONS.reduce((n, s) => n + (s.perfs?.length ?? 0), 0);
  console.log(
    `Demo data written: ${SESSIONS.length} sessions, ${perfCount} performances, ` +
      `${TEMPLATES.length} workouts, ${GOALS.length} goals.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
