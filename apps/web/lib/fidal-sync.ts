import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { performances, sessions, userSettings } from "@/lib/db/schema";
import {
  fetchFidalProfile,
  parseFidalResults,
  toImportItems,
  type FidalImportItem,
} from "@/lib/fidal";
import { recomputePersonalBests } from "@/lib/records";
import { createSession } from "@/lib/services";

export type FidalPreview = {
  url: string;
  total: number;
  newItems: Array<{ fidalId: string; date: string; specialita: string; prestazione: string }>;
  skipped: Array<{ fidalId: string; date: string; specialita: string; prestazione: string }>;
};

async function loadItemsForUser(userId: string): Promise<{ url: string; items: FidalImportItem[] }> {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const url = settings?.fidalUrl;
  if (!url) throw new Error("errors.fidalNotConfigured");

  const html = await fetchFidalProfile(url);
  const rows = parseFidalResults(html);
  return { url, items: toImportItems(rows) };
}

/**
 * What identifies a race when the FIDAL hash can't: the day, the event and the
 * mark. Two races that agree on all three are the same race — the alternative
 * reading, that you ran the identical time twice in one day in the same event,
 * is not one worth importing twice.
 */
function markKey(
  day: string,
  p: { discipline: string; distance: number | null; event: string | null; result: string },
): string {
  return [day, p.discipline, p.distance ?? "", p.event ?? "", p.result].join("|");
}

/** yyyy-MM-dd of a stored timestamp, in UTC — session dates are calendar days. */
function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type Existing = {
  /** Hashes of races imported by a previous sync. */
  fidalIds: Set<string>;
  /** Races already in the log by any other route, mapped to their session. */
  byMark: Map<string, { sessionId: string; hasFidalId: boolean }>;
};

/**
 * Everything already on file that a FIDAL row could be a duplicate of.
 *
 * Matching on the hash alone is not enough: it is only ever written by a sync,
 * so races entered by hand — or restored from a JSON export — look brand new
 * and the whole history offers itself for import again.
 */
async function loadExisting(userId: string, items: FidalImportItem[]): Promise<Existing> {
  if (items.length === 0) return { fidalIds: new Set(), byMark: new Map() };

  const times = items.map((i) => i.date.getTime());
  const from = new Date(Math.min(...times));
  const to = new Date(Math.max(...times));
  // Widen by a day at each end so a session stored at some other hour of its
  // calendar day still falls inside the window.
  from.setUTCDate(from.getUTCDate() - 1);
  to.setUTCDate(to.getUTCDate() + 1);

  const [hashRows, markRows] = await Promise.all([
    db
      .select({ fidalId: sessions.fidalId })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          inArray(
            sessions.fidalId,
            items.map((i) => i.fidalId),
          ),
        ),
      ),
    db
      .select({
        sessionId: sessions.id,
        date: sessions.date,
        fidalId: sessions.fidalId,
        discipline: performances.discipline,
        distance: performances.distance,
        event: performances.event,
        result: performances.result,
      })
      .from(sessions)
      .innerJoin(performances, eq(performances.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, userId),
          // FIDAL only publishes races, so only races can be duplicates of one.
          eq(sessions.type, "competition"),
          gte(sessions.date, from),
          lte(sessions.date, to),
        ),
      ),
  ]);

  return {
    fidalIds: new Set(hashRows.map((r) => r.fidalId).filter((x): x is string => !!x)),
    byMark: indexExisting(markRows),
  };
}

/** A row as the driver returns it: numeric columns arrive as strings. */
export type ExistingMarkRow = {
  sessionId: string;
  date: Date;
  fidalId: string | null;
  discipline: string;
  distance: number | null;
  event: string | null;
  result: string;
};

/** Index stored races by mark. Pure, so it can be checked without a database. */
export function indexExisting(rows: ExistingMarkRow[]): Existing["byMark"] {
  const byMark = new Map<string, { sessionId: string; hasFidalId: boolean }>();
  for (const r of rows) {
    const key = markKey(dayOf(r.date), r);
    if (!byMark.has(key)) {
      byMark.set(key, { sessionId: r.sessionId, hasFidalId: !!r.fidalId });
    }
  }
  return byMark;
}

/** The single performance a FIDAL row carries. */
function itemMarkKey(item: FidalImportItem): string {
  const p = item.session.performances[0];
  if (!p) return "";
  return markKey(dayOf(item.date), {
    discipline: p.discipline,
    distance: p.distance,
    event: p.event,
    // numeric(8,2) in the database, so compare at the precision it stores.
    result: Number(p.result).toFixed(2),
  });
}

type Classified = {
  toImport: FidalImportItem[];
  present: FidalImportItem[];
  /** Sessions to stamp with the hash, so the next sync matches directly. */
  backfill: Array<{ sessionId: string; fidalId: string }>;
};

export function classify(items: FidalImportItem[], existing: Existing): Classified {
  const toImport: FidalImportItem[] = [];
  const present: FidalImportItem[] = [];
  const backfill: Array<{ sessionId: string; fidalId: string }> = [];
  // A session carries at most one hash, so only the first match claims it.
  const claimed = new Set<string>();

  for (const item of items) {
    if (existing.fidalIds.has(item.fidalId)) {
      present.push(item);
      continue;
    }
    const match = existing.byMark.get(itemMarkKey(item));
    if (match) {
      present.push(item);
      if (!match.hasFidalId && !claimed.has(match.sessionId)) {
        claimed.add(match.sessionId);
        backfill.push({ sessionId: match.sessionId, fidalId: item.fidalId });
      }
      continue;
    }
    toImport.push(item);
  }

  return { toImport, present, backfill };
}

const fmt = (i: FidalImportItem) => ({
  fidalId: i.fidalId,
  date: dayOf(i.date),
  specialita: i.specialita,
  prestazione: i.prestazione,
});

/** Dry run: what would be imported vs skipped. */
export async function previewFidalSync(userId: string): Promise<FidalPreview> {
  const { url, items } = await loadItemsForUser(userId);
  const existing = await loadExisting(userId, items);
  const { toImport, present } = classify(items, existing);
  return {
    url,
    total: items.length,
    newItems: toImport.map(fmt),
    skipped: present.map(fmt),
  };
}

/** Commit import: insert only new items, update lastFidalSyncAt. */
export async function commitFidalSync(
  userId: string,
): Promise<{ imported: number; skipped: number }> {
  const { items } = await loadItemsForUser(userId);
  const existing = await loadExisting(userId, items);
  const { toImport, backfill } = classify(items, existing);

  // Link the races already on file to their FIDAL row first, so a sync that
  // fails halfway still leaves the next one with less to work out.
  for (const { sessionId, fidalId } of backfill) {
    await db
      .update(sessions)
      .set({ fidalId, updatedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  }

  for (const item of toImport) {
    // Defer PB recompute until all rows are inserted (one recompute, not N).
    await createSession(userId, item.session, { fidalId: item.fidalId, recompute: false });
  }
  if (toImport.length > 0) await recomputePersonalBests(userId);

  await db
    .update(userSettings)
    .set({ lastFidalSyncAt: new Date() })
    .where(eq(userSettings.userId, userId));

  return { imported: toImport.length, skipped: items.length - toImport.length };
}
