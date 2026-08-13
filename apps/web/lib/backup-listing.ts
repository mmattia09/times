import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { backupManifestSchema } from "@/lib/restore";
import { intervalDays, latestRun, parseSchedule, runFolderDate } from "@/lib/backup";

/**
 * What is actually on the backup volume, for the admin page to show.
 *
 * Read-only on purpose. A schedule you can't see the result of is a schedule you
 * have to trust, and trusting it is exactly what goes wrong: the value of this
 * is being able to glance at the page and see that last Sunday's backup is
 * really there, with the right number of sessions in it. Restoring stays a
 * command in the container — see lib/db/restore.ts.
 */

export type BackupRun = {
  /** The folder name, which is its date: "2026-08-11". */
  name: string;
  takenAt: string | null;
  users: number;
  sessions: number;
  /** True when the folder has no manifest — an old backup, still restorable. */
  incomplete: boolean;
};

export type BackupOverview = {
  /** What BACKUP_SCHEDULE says, or null when it says something we don't know. */
  schedule: ReturnType<typeof parseSchedule>;
  directory: string;
  runs: BackupRun[];
  /** When the next one is due, if a schedule is set and any have run. */
  nextDue: string | null;
  /** Set when the directory itself couldn't be read. */
  error: string | null;
};

export function backupDirectory(): string {
  return process.env.BACKUP_DIR?.trim() || "/backups";
}

async function readRun(dir: string, name: string): Promise<BackupRun> {
  try {
    const raw = JSON.parse(await readFile(join(dir, name, "manifest.json"), "utf8"));
    const parsed = backupManifestSchema.safeParse(raw);
    if (!parsed.success) return { name, takenAt: null, users: 0, sessions: 0, incomplete: true };
    return {
      name,
      takenAt: parsed.data.takenAt ?? null,
      users: parsed.data.users.length,
      sessions: parsed.data.users.reduce((n, u) => n + (u.sessions ?? 0), 0),
      incomplete: false,
    };
  } catch {
    // No manifest: a backup from before there was one, or a folder someone put
    // there. Counted, flagged, and left alone.
    return { name, takenAt: null, users: 0, sessions: 0, incomplete: true };
  }
}

export async function getBackupOverview(): Promise<BackupOverview> {
  const schedule = parseSchedule(process.env.BACKUP_SCHEDULE);
  const directory = backupDirectory();

  let names: string[];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    names = entries
      .filter((e) => e.isDirectory() && runFolderDate(e.name) !== null)
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch (err) {
    const code = (err as { code?: string }).code;
    return {
      schedule,
      directory,
      runs: [],
      nextDue: null,
      // ENOENT before the first run is the normal state, not a problem worth
      // colouring red on the page.
      error: code === "ENOENT" ? null : (code ?? "unreadable"),
    };
  }

  const runs = await Promise.all(names.slice(0, 20).map((name) => readRun(directory, name)));

  const last = latestRun(names);
  const days = schedule ? intervalDays(schedule) : null;
  const nextDue =
    last && days != null ? new Date(last.getTime() + days * 86_400_000).toISOString() : null;

  return { schedule, directory, runs, nextDue, error: null };
}
