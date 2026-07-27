import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createId } from "../id";

// ── Enums ─────────────────────────────────────────────────────────────────
export const sessionTypeEnum = pgEnum("session_type", ["training", "competition"]);
export const tempoEnum = pgEnum("tempo", ["elettronico", "cronometro", "manuale"]);
export const livelloEnum = pgEnum("livello", [
  "regionale",
  "provinciale",
  "nazionale",
  "internazionale",
]);
export const organizzatoreEnum = pgEnum("organizzatore", ["fidal", "csi", "altro"]);
export const tipoEnum = pgEnum("tipo", ["outdoor", "indoor"]);
export const disciplineEnum = pgEnum("discipline", [
  "sprint",
  "hurdles",
  "middle_distance",
  "long_distance",
  "relay",
  "walk",
  "jump",
  "throw",
  "combined",
  // Athletic tests (standing jumps, sargent…): measured, but not competition events.
  "test",
]);

// ── Auth: users + Better Auth tables ────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  /**
   * Access to the admin area. The owner always has it; anyone else is granted
   * it (and can have it taken away) from there.
   */
  isAdmin: boolean("is_admin").notNull().default(false),
  /**
   * The one account provisioned from ADMIN_EMAIL / ADMIN_PASSWORD. Its
   * credentials live in the environment, so the UI must never let it be
   * renamed, demoted or deleted — the environment would just recreate it.
   */
  isOwner: boolean("is_owner").notNull().default(false),
  /**
   * Set when an admin hands out a password: until the person replaces it the
   * app is closed to them, so a credential a third party knows can't be used
   * to keep training data open.
   */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Better Auth "session" table (renamed to auth_sessions to avoid clashing with
// the domain `sessions` table below).
export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Workouts ─────────────────────────────────────────────────────────────────
// A workout is a list of blocks matching the athlete's training tables:
// blocco / ripetute / recupero / pausa / ritmo / note. Values stay free-text
// ("4 x 60m", "passo", "200m surplex", "pb 400m") — that's how coaches write them.
export type WorkoutBlock = {
  label: string | null; // "1", "2 x 1", "piramidale" — empty = continuation row
  ripetute: string;
  recupero: string | null;
  pausa: string | null;
  ritmo: string | null;
  note: string | null;
};

export type SessionWorkout = {
  templateId: string | null;
  name: string | null;
  blocks: WorkoutBlock[];
};

// ── Domain: sessions ─────────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }).notNull(),
  // Multi-day competitions (e.g. CSI nazionali 6→8 Sep) keep an optional end.
  endDate: timestamp("end_date", { withTimezone: true }),
  type: sessionTypeEnum("type").notNull().default("training"),
  tempo: tempoEnum("tempo"),
  livello: livelloEnum("livello"),
  luogo: text("luogo"),
  organizzatore: organizzatoreEnum("organizzatore"),
  tipo: tipoEnum("tipo"),
  note: text("note"),
  // Hash of (date+distance+result) used to dedup FIDAL imports.
  fidalId: text("fidal_id").unique(),
  // Optional structured workout (snapshot — editing a template never rewrites history).
  workout: jsonb("workout").$type<SessionWorkout>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Domain: workout templates (the athlete's scheme library) ─────────────────
export const workoutTemplates = pgTable("workout_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"), // velocità, tecnica, partenza dai blocchi, resistenza…
  description: text("description"),
  blocks: jsonb("blocks").$type<WorkoutBlock[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Domain: goals (target per event, compared against the current PB) ────────
export const goals = pgTable("goals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  discipline: disciplineEnum("discipline").notNull(),
  distance: integer("distance"),
  event: varchar("event", { length: 32 }),
  target: numeric("target", { precision: 8, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Domain: performances ─────────────────────────────────────────────────────
export const performances = pgTable("performances", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  discipline: disciplineEnum("discipline").notNull().default("sprint"),
  // meters for runs (60,100,200,...; 2000 for cross country), null for field events.
  distance: integer("distance"),
  // Specific event label for field events: 'alto' | 'lungo' | 'giavellotto'. Null for runs.
  event: varchar("event", { length: 32 }),
  // seconds for runs, cm for jumps, m for throws (see README "units").
  result: numeric("result", { precision: 8, scale: 2 }).notNull(),
  wind: numeric("wind", { precision: 4, scale: 2 }),
  lane: integer("lane"),
  position: integer("position"),
  heat: varchar("heat", { length: 32 }),
  isPersonalBest: boolean("is_personal_best").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Domain: personal_bests (recomputed table) ────────────────────────────────
export const personalBests = pgTable(
  "personal_bests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    discipline: disciplineEnum("discipline").notNull(),
    distance: integer("distance"),
    event: varchar("event", { length: 32 }),
    result: numeric("result", { precision: 8, scale: 2 }).notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    performanceId: text("performance_id")
      .notNull()
      .references(() => performances.id, { onDelete: "cascade" }),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    // One PB per user per event key (discipline + distance + event) — discipline
    // is part of the key so e.g. 100m flat and 100m hurdles don't collide.
    pbKey: uniqueIndex("pb_user_event_key").on(t.userId, t.discipline, t.distance, t.event),
  }),
);

// ── API keys ─────────────────────────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  // sha-256 of the raw key; the raw key is shown to the user once.
  keyHash: text("key_hash").notNull().unique(),
  // first chars (e.g. "ath_live_a1b2") shown in the UI to identify the key.
  prefix: text("prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── User settings ─────────────────────────────────────────────────────────────
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fidalUrl: text("fidal_url"),
  lastFidalSyncAt: timestamp("last_fidal_sync_at", { withTimezone: true }),
  seasonStartMonth: integer("season_start_month").notNull().default(10),
  defaultDistances: jsonb("default_distances").$type<number[]>().default([60, 100, 200]),
  theme: text("theme").notNull().default("system"),
  /** UI language: it | en | de | es. */
  locale: text("locale").notNull().default("it"),
  /**
   * IANA zone for rendering timestamps (last sync, API-key activity). Null
   * means "follow the browser". Session dates are calendar days and never
   * depend on this.
   */
  timezone: text("timezone"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ─────────────────────────────────────────────────────────────────
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  performances: many(performances),
}));

export const performancesRelations = relations(performances, ({ one }) => ({
  session: one(sessions, { fields: [performances.sessionId], references: [sessions.id] }),
  user: one(users, { fields: [performances.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  apiKeys: many(apiKeys),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Performance = typeof performances.$inferSelect;
export type NewPerformance = typeof performances.$inferInsert;
export type PersonalBest = typeof personalBests.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type User = typeof users.$inferSelect;

export type Discipline = (typeof disciplineEnum.enumValues)[number];
export type SessionWithPerformances = Session & { performances: Performance[] };
