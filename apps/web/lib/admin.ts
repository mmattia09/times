import "server-only";
import { and, count, desc, eq, gt, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  apiKeys,
  authSessions,
  goals,
  performances,
  personalBests,
  sessions,
  users,
  workoutTemplates,
} from "@/lib/db/schema";
import { getAccountState, requireApiUser } from "@/lib/current-user";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  /** Still owes a password change after an admin set one. */
  mustChangePassword: boolean;
  createdAt: Date;
  /** Sessions logged, not login sessions. */
  sessionCount: number;
  performanceCount: number;
  /** Newest session date, i.e. how recently they actually trained. */
  lastLoggedAt: Date | null;
  /** Newest login session still valid — null when signed out everywhere. */
  activeUntil: Date | null;
};

/** The signed-in user's role — see getAccountState for the cached lookup. */
export async function getRole(): Promise<{ isAdmin: boolean; isOwner: boolean }> {
  const { isAdmin, isOwner } = await getAccountState();
  return { isAdmin, isOwner };
}

/** Guard for API routes. Returns the caller, or a Response to hand straight back. */
export async function requireAdminApi(): Promise<
  { userId: string; isOwner: boolean } | { error: Response }
> {
  const caller = await requireApiUser();
  if ("error" in caller) return { error: caller.error };
  const { isAdmin, isOwner } = await getAccountState();
  if (!isAdmin) {
    // 404, not 403: an ordinary user has no business knowing this exists.
    return { error: Response.json({ error: "not_found" }, { status: 404 }) };
  }
  return { userId: caller.user.id, isOwner };
}

/**
 * Everyone on the instance, with the numbers that make the list useful:
 * how much they have logged and whether they are still signed in anywhere.
 * Aggregates run as subqueries so a user with no data still shows up.
 */
export async function listUsers(): Promise<AdminUser[]> {
  const now = new Date();

  const logged = db
    .select({
      userId: sessions.userId,
      total: count().as("total"),
      last: max(sessions.date).as("last"),
    })
    .from(sessions)
    .groupBy(sessions.userId)
    .as("logged");

  const perfs = db
    .select({ userId: performances.userId, total: count().as("perf_total") })
    .from(performances)
    .groupBy(performances.userId)
    .as("perfs");

  const live = db
    .select({ userId: authSessions.userId, until: max(authSessions.expiresAt).as("until") })
    .from(authSessions)
    .where(gt(authSessions.expiresAt, now))
    .groupBy(authSessions.userId)
    .as("live");

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
      isOwner: users.isOwner,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      sessionCount: logged.total,
      lastLoggedAt: logged.last,
      performanceCount: perfs.total,
      activeUntil: live.until,
    })
    .from(users)
    .leftJoin(logged, eq(logged.userId, users.id))
    .leftJoin(perfs, eq(perfs.userId, users.id))
    .leftJoin(live, eq(live.userId, users.id))
    // Owner first, then admins, then newest sign-ups.
    .orderBy(desc(users.isOwner), desc(users.isAdmin), desc(users.createdAt));

  return rows.map((r) => ({
    ...r,
    sessionCount: Number(r.sessionCount ?? 0),
    performanceCount: Number(r.performanceCount ?? 0),
  }));
}

export type AdminUserDetail = AdminUser & {
  personalBestCount: number;
  workoutCount: number;
  goalCount: number;
  apiKeyCount: number;
  activeLogins: number;
};

/** One user, with the full breakdown shown on their detail page. */
export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const [base] = (await listUsers()).filter((u) => u.id === id);
  if (!base) return null;

  const one = async (table: typeof personalBests | typeof workoutTemplates | typeof goals) =>
    db
      .select({ n: count() })
      .from(table)
      .where(eq(table.userId, id))
      .then((r) => Number(r[0]?.n ?? 0));

  const [personalBestCount, workoutCount, goalCount, keyRows, loginRows] = await Promise.all([
    one(personalBests),
    one(workoutTemplates),
    one(goals),
    db
      .select({ n: count() })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, id), sql`${apiKeys.revokedAt} is null`)),
    db
      .select({ n: count() })
      .from(authSessions)
      .where(and(eq(authSessions.userId, id), gt(authSessions.expiresAt, new Date()))),
  ]);

  return {
    ...base,
    personalBestCount,
    workoutCount,
    goalCount,
    apiKeyCount: Number(keyRows[0]?.n ?? 0),
    activeLogins: Number(loginRows[0]?.n ?? 0),
  };
}

/** Instance-wide totals for the admin overview. */
export async function getInstanceStats(): Promise<{
  users: number;
  admins: number;
  sessions: number;
  performances: number;
}> {
  const [[u], [a], [s], [p]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(eq(users.isAdmin, true)),
    db.select({ n: count() }).from(sessions),
    db.select({ n: count() }).from(performances),
  ]);
  return {
    users: Number(u?.n ?? 0),
    admins: Number(a?.n ?? 0),
    sessions: Number(s?.n ?? 0),
    performances: Number(p?.n ?? 0),
  };
}
