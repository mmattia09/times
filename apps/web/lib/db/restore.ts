/**
 * Restore a whole backup folder — every account — from inside the container:
 *
 *   docker compose exec app node restore.cjs 2026-08-11
 *   docker compose exec app node restore.cjs            (the newest folder)
 *   docker compose exec app node restore.cjs 2026-08-11 --dry-run
 *
 * Deliberately a command and not a button. This is the tool for the day the
 * server is gone: it has to work when nobody can sign in, and a mass restore is
 * not something a browser session should be able to trigger.
 *
 * It only ever adds. Importing is deduplicated by content, so running this
 * twice changes nothing the second time, and pointing it at a backup on an
 * instance that has moved on merges rather than overwrites — nothing existing
 * is deleted or replaced.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { authSessions, userSettings, users } from "./schema";
import { auth } from "../auth";
import { exportFileSchema, importData } from "../data-transfer";
import { latestRun, runFolderName } from "../backup";
import { backupManifestSchema, describePlan, planRestore, type BackupManifest } from "../restore";

const log = (message: string) => console.log(`[restore] ${message}`);

function backupDir(): string {
  return process.env.BACKUP_DIR?.trim() || "/backups";
}

/** A password nobody knows, so the account exists but is closed until set. */
function unusablePassword(): string {
  return `restored-${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

async function readManifest(folder: string): Promise<BackupManifest | null> {
  try {
    const raw = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8"));
    const parsed = backupManifestSchema.safeParse(raw);
    if (!parsed.success) {
      log("manifest.json isn't readable — falling back to matching accounts by file name");
      return null;
    }
    return parsed.data;
  } catch {
    log("no manifest.json — falling back to matching accounts by file name");
    return null;
  }
}

/**
 * Create the account a backup came from, closed until an admin gives it a
 * password. An export carries no credentials on purpose, so there is nothing to
 * restore here and nothing to guess: the account is made, flagged as needing a
 * new password, and left signed out.
 */
async function createAccount(email: string, name: string | null, isAdmin: boolean): Promise<string> {
  await auth.api.signUpEmail({
    body: { email, name: name ?? email.split("@")[0], password: unusablePassword() },
  });
  const [created] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!created) throw new Error(`account for ${email} was not created`);
  await db
    .update(users)
    .set({ emailVerified: true, isAdmin, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, created.id));
  await db.insert(userSettings).values({ userId: created.id }).onConflictDoNothing();
  // Signing up opens a session; nobody is holding it.
  await db.delete(authSessions).where(eq(authSessions.userId, created.id));
  return created.id;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const wanted = args.find((a) => !a.startsWith("--"));

  const dir = backupDir();
  let folderName = wanted;
  if (!folderName) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const newest = latestRun(entries.filter((e) => e.isDirectory()).map((e) => e.name));
    if (!newest) {
      log(`no backups in ${dir}. Nothing to restore.`);
      process.exit(1);
    }
    folderName = runFolderName(newest);
    log(`no folder given — using the newest, ${folderName}`);
  }

  const folder = join(dir, folderName);
  const files = await readdir(folder).catch(() => null);
  if (!files) {
    log(`can't read ${folder}. Available: ${dir}`);
    process.exit(1);
  }

  const manifest = await readManifest(folder);
  const existing = await db.select({ id: users.id, email: users.email }).from(users);
  const plans = planRestore(manifest, files, existing);

  log(`${folder} — ${describePlan(plans)}`);
  for (const plan of plans) {
    if (plan.action === "import") log(`  ${plan.file} → ${plan.email}`);
    else if (plan.action === "create") log(`  ${plan.file} → create ${plan.email}`);
    else log(`  ${plan.file} → skipped: nothing says which account it belongs to`);
  }

  if (dryRun) {
    log("--dry-run: nothing was written.");
    process.exit(0);
  }

  let restored = 0;
  const created: string[] = [];
  for (const plan of plans) {
    if (plan.action === "skip") continue;
    try {
      const raw = JSON.parse(await readFile(join(folder, plan.file), "utf8"));
      const parsed = exportFileSchema.safeParse(raw);
      if (!parsed.success) {
        log(`  ${plan.file}: not a Times export — skipped`);
        continue;
      }

      let userId: string;
      if (plan.action === "create") {
        userId = await createAccount(plan.email, plan.name, plan.isAdmin);
        created.push(plan.email);
      } else {
        userId = plan.userId;
      }

      const report = await importData(userId, parsed.data);
      log(
        `  ${plan.file}: ${report.sessions.imported} session(s) restored, ` +
          `${report.sessions.skipped} already there, ` +
          `${report.workoutTemplates.imported} workout(s), ${report.goals.imported} goal(s)`,
      );
      restored++;
    } catch (err) {
      log(`  ${plan.file}: failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log(`done: ${restored} of ${plans.length} file(s) restored.`);
  if (created.length > 0) {
    log(
      `accounts created without a password: ${created.join(", ")}. ` +
        `Give each one a password from the admin area — their data is already there.`,
    );
  }
  process.exit(0);
}

void main();
