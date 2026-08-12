import { z } from "zod";

/**
 * Reading a backup folder back in, for every account at once.
 *
 * Settings → Import restores one account, which is the right shape when a
 * person wants their own data back. It is the wrong shape for the day the
 * server is gone: then there is a folder of files, no accounts to import them
 * into, and nobody logged in to do it. So this reads the whole folder, works
 * out which file belongs to which account, and says what it intends to do
 * before doing it.
 *
 * Deciding is separated from doing so the decisions can be checked without a
 * database — the same split as lib/db/repair.ts.
 */

/** A backup's manifest. Everything past `file` is optional: older backups. */
export const backupManifestSchema = z.object({
  takenAt: z.string().optional(),
  users: z.array(
    z.object({
      file: z.string().min(1),
      /** The account this came from, when the backup recorded it. */
      id: z.string().optional(),
      user: z.string().optional(),
      name: z.string().nullable().optional(),
      isAdmin: z.boolean().optional(),
      sessions: z.number().optional(),
    }),
  ),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;

/** An account already on this instance, as much as matching needs. */
export type ExistingUser = { id: string; email: string };

export type RestorePlan =
  | { file: string; action: "import"; userId: string; email: string }
  | { file: string; action: "create"; email: string; name: string | null; isAdmin: boolean }
  | { file: string; action: "skip"; reason: "no-account-known" };

/** A user id is what the backup names its files after: "<id>.json". */
export function userIdFromFileName(file: string): string | null {
  // The manifest sits in the same folder and its name would otherwise pass for
  // an id. planRestore filters it out first; this is so the function can't be
  // wrong on its own.
  if (file === "manifest.json") return null;
  const m = file.match(/^([A-Za-z0-9_-]{8,64})\.json$/);
  return m ? m[1] : null;
}

/**
 * What to do with each file in the folder.
 *
 * Matching is by email first and id second. Email is what survives moving to a
 * new instance — ids are generated per install, so after a restore onto a fresh
 * database the same person has a different one — but a backup from before the
 * manifest recorded emails still has the id in the file name, and on the same
 * instance that is exact.
 *
 * A file we can't attribute is skipped rather than guessed at: importing one
 * person's season into another person's account is not a mistake you can undo
 * by hand.
 */
export function planRestore(
  manifest: BackupManifest | null,
  files: string[],
  existing: ExistingUser[],
): RestorePlan[] {
  const byEmail = new Map(existing.map((u) => [u.email.trim().toLowerCase(), u]));
  const byId = new Map(existing.map((u) => [u.id, u]));
  const entries = new Map((manifest?.users ?? []).map((u) => [u.file, u]));

  const plans: RestorePlan[] = [];
  for (const file of files.filter((f) => f !== "manifest.json" && f.endsWith(".json")).sort()) {
    const entry = entries.get(file);
    const email = entry?.user?.trim().toLowerCase() ?? null;
    const id = entry?.id ?? userIdFromFileName(file);

    const match = (email ? byEmail.get(email) : undefined) ?? (id ? byId.get(id) : undefined);
    if (match) {
      plans.push({ file, action: "import", userId: match.id, email: match.email });
      continue;
    }
    if (email) {
      plans.push({
        file,
        action: "create",
        email,
        name: entry?.name ?? null,
        isAdmin: entry?.isAdmin ?? false,
      });
      continue;
    }
    // No email anywhere and no account with that id: nothing says whose this is.
    plans.push({ file, action: "skip", reason: "no-account-known" });
  }
  return plans;
}

/** A one-line summary of the intent, for the log before anything is written. */
export function describePlan(plans: RestorePlan[]): string {
  const n = (action: RestorePlan["action"]) => plans.filter((p) => p.action === action).length;
  return `${plans.length} file(s): ${n("import")} into existing accounts, ${n("create")} account(s) to create, ${n("skip")} skipped`;
}
