import {
  BACKUP_SCHEDULES,
  intervalDays,
  isBackupDue,
  latestRun,
  parseSchedule,
  runFolderDate,
  runFolderName,
} from "@/lib/backup";

/**
 * A backup that silently stops happening is worse than no backup, because the
 * admin believes there is one. So the rules worth pinning down are: an instance
 * that said nothing gets no backups and no errors, a typo in the schedule never
 * reads as "every day", and a restart neither forgets the last run nor repeats
 * it.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ── Reading the setting ─────────────────────────────────────────────────────

check("nothing set means off", parseSchedule(undefined) === "off");
check("an empty value means off", parseSchedule("") === "off");
check("blank space means off", parseSchedule("   ") === "off");
check("off means off", parseSchedule("off") === "off");
check("case doesn't matter", parseSchedule("Weekly") === "weekly");
check("padding doesn't matter", parseSchedule(" monthly ") === "monthly");

// A typo must not fall back to some default that quietly backs up — or worse,
// quietly doesn't while looking valid.
check("a typo is refused, not guessed", parseSchedule("wekly") === null);
check("an interval we don't offer is refused", parseSchedule("hourly") === null);
check("true is not a schedule", parseSchedule("true") === null);

for (const s of BACKUP_SCHEDULES) {
  check(`"${s}" is accepted`, parseSchedule(s) === s);
}

check("off has no interval", intervalDays("off") === null);
check("daily is a day", intervalDays("daily") === 1);
check("weekly is seven", intervalDays("weekly") === 7);
check("biweekly is a fortnight", intervalDays("biweekly") === 14);
check("yearly is a year", intervalDays("yearly") === 365);

// ── When a backup is due ───────────────────────────────────────────────────

check("off is never due", !isBackupDue("off", null));
check("off stays off even after a year", !isBackupDue("off", day("2025-01-01"), day("2026-06-01")));
check("never having run is due now", isBackupDue("weekly", null));

check(
  "a week and a day later is due",
  isBackupDue("weekly", day("2026-08-01"), day("2026-08-09")),
);
check(
  "exactly a week later is due",
  isBackupDue("weekly", day("2026-08-01"), day("2026-08-08")),
);
check(
  "six days later is not",
  !isBackupDue("weekly", day("2026-08-01"), day("2026-08-07")),
);
check(
  "the same day is not — a restart must not back up again",
  !isBackupDue("daily", day("2026-08-11"), day("2026-08-11")),
);
check(
  "the next day is",
  isBackupDue("daily", day("2026-08-11"), day("2026-08-12")),
);
check(
  "a monthly backup waits 30 days",
  !isBackupDue("monthly", day("2026-08-01"), day("2026-08-30")) &&
    isBackupDue("monthly", day("2026-08-01"), day("2026-08-31")),
);

// ── Reading the directory back ─────────────────────────────────────────────

check("a run folder is named for its day", runFolderName(day("2026-08-11")) === "2026-08-11");
check("and reads back as that day", runFolderDate("2026-08-11")?.getTime() === day("2026-08-11").getTime());

// Whatever else lives in the directory is not a backup and must not be read as
// one — mistaking it for a recent run would mean never backing up again.
check("a stray file name is not a run", runFolderDate("notes.txt") === null);
check("an almost-date is not a run", runFolderDate("2026-8-1") === null);
check("an impossible date is not a run", runFolderDate("2026-13-45") === null);

check("no folders means never run", latestRun([]) === null);
check("only strays means never run", latestRun(["lost+found", "README"]) === null);
check(
  "the newest folder wins, whatever order they arrive in",
  latestRun(["2026-01-05", "2026-08-11", "2025-12-31"])?.getTime() === day("2026-08-11").getTime(),
);
check(
  "strays alongside real runs are ignored",
  latestRun(["tmp", "2026-08-11", ".DS_Store"])?.getTime() === day("2026-08-11").getTime(),
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
