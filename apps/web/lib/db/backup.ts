/**
 * The backup runner: bundled to a standalone CJS file and started by the
 * container's entrypoint. See lib/backup.ts for what a schedule means and why
 * the files themselves are the state.
 *
 *   node backup.cjs once   check, back up if due, exit
 *   node backup.cjs loop   the same, then every six hours
 *
 * Nothing here is allowed to take the app down with it: a directory that isn't
 * writable, a schedule nobody recognises, a database that went away — all of it
 * is a log line and a return, because a failed backup must not stop an athlete
 * logging a session.
 */
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./index";
import { users } from "./schema";
import { buildExport } from "../data-transfer";
import { isBackupDue, latestRun, parseSchedule, runFolderName } from "../backup";
import type { BackupManifest } from "../restore";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const log = (message: string) => console.log(`[backup] ${message}`);

/**
 * Something an admin can act on. `err.message` alone isn't enough: a database
 * that isn't there throws an AggregateError whose message is empty, which
 * printed as "failed:" and left nobody any the wiser.
 */
function describe(err: unknown): string {
  if (err instanceof AggregateError) {
    const causes = err.errors.map(describe).filter(Boolean);
    return causes.length > 0 ? causes.join("; ") : err.name;
  }
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    return err.message || code || err.name;
  }
  return String(err);
}

function backupDir(): string {
  return process.env.BACKUP_DIR?.trim() || "/backups";
}

/** Existing run folders, or null when the directory can't be read at all. */
async function existingRuns(dir: string): Promise<string[] | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") return []; // first run: nothing there yet
    log(`can't read ${dir} (${code ?? "unknown error"}) — skipping this check`);
    return null;
  }
}

/**
 * Write the run somewhere else and move it into place at the end.
 *
 * The folder's date is what says "this backup happened", so a run that dies
 * halfway must not leave one behind: it would count as done and the next
 * attempt would wait out the whole interval. The staging name isn't a date, so
 * a leftover from a crash is ignored rather than counted.
 */
async function takeBackup(dir: string): Promise<void> {
  const name = runFolderName();
  const staging = join(dir, `.partial-${name}`);
  const folder = join(dir, name);

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const everyone = await db
    .select({ id: users.id, email: users.email, name: users.name, isAdmin: users.isAdmin })
    .from(users);
  const written: BackupManifest["users"] = [];

  for (const person of everyone) {
    const data = await buildExport(person.id);
    const file = `${person.id}.json`;
    await writeFile(join(staging, file), JSON.stringify(data), "utf8");
    written.push({
      file,
      id: person.id,
      user: person.email,
      name: person.name,
      isAdmin: person.isAdmin,
      sessions: data.sessions.length,
    });
  }

  // Which file belongs to whom, and enough of the account to recreate it.
  // An export carries training data and deliberately no credentials, so
  // without this a restore onto an empty instance would have data and nobody
  // to give it to. Passwords are still never written here.
  const manifest: BackupManifest = { takenAt: new Date().toISOString(), users: written };
  await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  await rm(folder, { recursive: true, force: true });
  await rename(staging, folder);

  const sessions = written.reduce((n, w) => n + (w.sessions ?? 0), 0);
  log(`wrote ${written.length} user(s), ${sessions} session(s) to ${folder}`);
}

async function checkOnce(): Promise<void> {
  const raw = process.env.BACKUP_SCHEDULE;
  const schedule = parseSchedule(raw);

  if (schedule === null) {
    log(`BACKUP_SCHEDULE="${raw}" isn't a schedule — backups are off. Use one of: off, daily, weekly, biweekly, monthly, bimonthly, quarterly, yearly.`);
    return;
  }
  if (schedule === "off") return;

  const dir = backupDir();
  const runs = await existingRuns(dir);
  if (runs === null) return;

  const last = latestRun(runs);
  if (!isBackupDue(schedule, last)) return;

  try {
    await takeBackup(dir);
  } catch (err) {
    log(`failed: ${describe(err)} — will try again at the next check`);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] === "loop" ? "loop" : "once";
  const schedule = parseSchedule(process.env.BACKUP_SCHEDULE);

  if (schedule === "off") {
    // Silent on the normal path: an instance that never asked for backups
    // shouldn't have to read about them on every boot.
    process.exit(0);
  }

  await checkOnce();
  if (mode === "once") process.exit(0);

  log(`scheduled: ${schedule}, into ${backupDir()}`);
  setInterval(() => void checkOnce(), CHECK_EVERY_MS);
}

void main();
