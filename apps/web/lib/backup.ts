/**
 * Scheduled backups of everything in the instance.
 *
 * A self-hosted app holds years of someone's training in one Postgres volume,
 * and the only copy that exists is the one the admin remembers to take. This
 * turns that into a setting: BACKUP_SCHEDULE=weekly and it happens.
 *
 * What it writes is the app's own JSON export, one file per user — the same
 * format Settings → Import reads, so restoring is a thing an admin can do
 * through the app without a database client, and it is the format whose
 * round trip is checked (see check-data-transfer).
 *
 * Off by default. An instance that says nothing about backups gets none, and
 * no errors about it either.
 */

export const BACKUP_SCHEDULES = [
  "off",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "bimonthly",
  "quarterly",
  "yearly",
] as const;

export type BackupSchedule = (typeof BACKUP_SCHEDULES)[number];

/**
 * How often each schedule comes round, in days.
 *
 * Plain day counts rather than calendar arithmetic: "monthly" is every 30 days,
 * which is predictable, has no edge cases around the 31st, and is what someone
 * setting a backup interval actually wants from it.
 */
const DAYS: Record<Exclude<BackupSchedule, "off">, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
  quarterly: 91,
  yearly: 365,
};

/** The schedule an env value asks for, or null if it isn't one of ours. */
export function parseSchedule(value: string | undefined | null): BackupSchedule | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "off";
  return (BACKUP_SCHEDULES as readonly string[]).includes(v) ? (v as BackupSchedule) : null;
}

export function intervalDays(schedule: BackupSchedule): number | null {
  return schedule === "off" ? null : DAYS[schedule];
}

/**
 * Whether a backup is due.
 *
 * The files on disk are the state: the newest one's date is when we last ran,
 * so there is nothing to keep in sync and a restarted container doesn't forget
 * or repeat itself. Never having run means due now.
 */
export function isBackupDue(
  schedule: BackupSchedule,
  lastRun: Date | null,
  now: Date = new Date(),
): boolean {
  const days = intervalDays(schedule);
  if (days == null) return false;
  if (!lastRun) return true;
  const elapsed = (now.getTime() - lastRun.getTime()) / 86_400_000;
  return elapsed >= days;
}

/** yyyy-MM-dd, the name a run's folder takes. */
export function runFolderName(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The date a run folder is named after, or null if the name isn't one of ours —
 * so anything else sitting in the directory is ignored rather than mistaken for
 * a backup that already happened.
 */
export function runFolderDate(name: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) return null;
  const d = new Date(`${name}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The most recent run among a directory's entries. */
export function latestRun(names: string[]): Date | null {
  const dates = names.map(runFolderDate).filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}
