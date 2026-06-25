import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, userSettings } from "@/lib/db/schema";
import {
  fetchFidalProfile,
  parseFidalResults,
  toImportItems,
  type FidalImportItem,
} from "@/lib/fidal";
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
  if (!url) throw new Error("Nessun URL FIDAL configurato nelle impostazioni.");

  const html = await fetchFidalProfile(url);
  const rows = parseFidalResults(html);
  return { url, items: toImportItems(rows) };
}

function partition(items: FidalImportItem[], existingIds: Set<string>) {
  const newItems = items.filter((i) => !existingIds.has(i.fidalId));
  const skipped = items.filter((i) => existingIds.has(i.fidalId));
  const fmt = (i: FidalImportItem) => ({
    fidalId: i.fidalId,
    date: i.date.toISOString().slice(0, 10),
    specialita: i.specialita,
    prestazione: i.prestazione,
  });
  return { newItems: newItems.map(fmt), skipped: skipped.map(fmt) };
}

async function existingFidalIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ fidalId: sessions.fidalId })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), inArray(sessions.fidalId, ids)));
  return new Set(rows.map((r) => r.fidalId).filter((x): x is string => !!x));
}

/** Dry run: what would be imported vs skipped. */
export async function previewFidalSync(userId: string): Promise<FidalPreview> {
  const { url, items } = await loadItemsForUser(userId);
  const existing = await existingFidalIds(
    userId,
    items.map((i) => i.fidalId),
  );
  const { newItems, skipped } = partition(items, existing);
  return { url, total: items.length, newItems, skipped };
}

/** Commit import: insert only new items, update lastFidalSyncAt. */
export async function commitFidalSync(userId: string): Promise<{ imported: number; skipped: number }> {
  const { items } = await loadItemsForUser(userId);
  const existing = await existingFidalIds(
    userId,
    items.map((i) => i.fidalId),
  );

  let imported = 0;
  for (const item of items) {
    if (existing.has(item.fidalId)) continue;
    await createSession(userId, item.session, item.fidalId);
    imported++;
  }

  await db
    .update(userSettings)
    .set({ lastFidalSyncAt: new Date() })
    .where(eq(userSettings.userId, userId));

  return { imported, skipped: items.length - imported };
}
