import {
  backupManifestSchema,
  describePlan,
  planRestore,
  userIdFromFileName,
  type ExistingUser,
} from "@/lib/restore";

/**
 * Restoring a folder means deciding, for each file, whose it is. Getting that
 * wrong pours one athlete's season into another athlete's account, which no
 * amount of clicking undoes — so a file nobody can attribute is skipped, never
 * guessed at.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

const mattia: ExistingUser = { id: "abc123def456", email: "one@example.com" };
const other: ExistingUser = { id: "zzz999yyy888", email: "two@example.com" };

const manifest = (users: Array<Record<string, unknown>>) =>
  backupManifestSchema.parse({ takenAt: "2026-08-11T00:00:00Z", users });

// ── File names ──────────────────────────────────────────────────────────────

check("a backup file is named after the account", userIdFromFileName("abc123def456.json") === "abc123def456");
check("the manifest is not one of them", userIdFromFileName("manifest.json") === null);
check("something else isn't an id", userIdFromFileName("notes.txt") === null);
check("a path is refused", userIdFromFileName("../../etc/passwd.json") === null);

// ── Matching ────────────────────────────────────────────────────────────────

const m = manifest([{ file: "abc123def456.json", id: "abc123def456", user: "one@example.com", name: "One", isAdmin: true }]);

let plans = planRestore(m, ["manifest.json", "abc123def456.json"], [mattia]);
check("an existing account is imported into", plans.length === 1 && plans[0].action === "import", JSON.stringify(plans));
check("and matched to the right id", plans[0].action === "import" && plans[0].userId === "abc123def456");
check("the manifest itself is never restored", !plans.some((p) => p.file === "manifest.json"));

// The whole point of the email: after restoring onto a fresh instance the same
// person has a different id, so ids alone would never match again.
plans = planRestore(m, ["abc123def456.json"], [{ id: "brand-new-id", email: "one@example.com" }]);
check(
  "a moved instance still matches by email",
  plans[0].action === "import" && plans[0].userId === "brand-new-id",
  JSON.stringify(plans[0]),
);
check("email matching ignores case", planRestore(manifest([{ file: "x.json", user: "ONE@Example.com" }]), ["x.json"], [mattia])[0].action === "import");

// Nobody with that email: the account has to be made, with what the manifest knows.
plans = planRestore(m, ["abc123def456.json"], []);
check("a missing account is created", plans[0].action === "create", JSON.stringify(plans[0]));
check("with its name", plans[0].action === "create" && plans[0].name === "One");
check("and its admin flag", plans[0].action === "create" && plans[0].isAdmin === true);

// An older backup, before the manifest carried accounts: the id in the file
// name is still exact on the instance it came from.
plans = planRestore(manifest([{ file: "abc123def456.json" }]), ["abc123def456.json"], [mattia]);
check(
  "an old manifest still matches by file name",
  plans[0].action === "import" && plans[0].userId === "abc123def456",
  JSON.stringify(plans[0]),
);

// No manifest at all.
plans = planRestore(null, ["abc123def456.json"], [mattia]);
check("no manifest still matches by file name", plans[0].action === "import");

// The dangerous case: a file whose account is unknown and unnamed. Guessing
// here would put someone else's training in the only account that exists.
plans = planRestore(null, ["abc123def456.json"], [other]);
check(
  "an unattributable file is skipped, not given to whoever is there",
  plans[0].action === "skip",
  JSON.stringify(plans[0]),
);
plans = planRestore(manifest([{ file: "abc123def456.json" }]), ["abc123def456.json"], [other]);
check("even with a manifest that names no email", plans[0].action === "skip");

// ── The whole folder ────────────────────────────────────────────────────────

const folder = manifest([
  { file: "abc123def456.json", id: "abc123def456", user: "one@example.com" },
  { file: "newperson0001.json", id: "newperson0001", user: "three@example.com" },
  { file: "orphan000001.json" },
]);
plans = planRestore(folder, ["manifest.json", "abc123def456.json", "newperson0001.json", "orphan000001.json", "notes.txt"], [mattia]);
check("non-json files are left alone", !plans.some((p) => p.file === "notes.txt"));
check("three files planned", plans.length === 3, String(plans.length));
check(
  "one import, one create, one skip",
  describePlan(plans) === "3 file(s): 1 into existing accounts, 1 account(s) to create, 1 skipped",
  describePlan(plans),
);
check("the order is stable", plans.map((p) => p.file).join(",") === "abc123def456.json,newperson0001.json,orphan000001.json", plans.map((p) => p.file).join(","));

// ── The manifest shape ─────────────────────────────────────────────────────

check("a manifest needs its file names", !backupManifestSchema.safeParse({ users: [{ id: "x" }] }).success);
check("everything else is optional", backupManifestSchema.safeParse({ users: [{ file: "a.json" }] }).success);
check("a null name is allowed", backupManifestSchema.safeParse({ users: [{ file: "a.json", name: null }] }).success);
check("junk is refused", !backupManifestSchema.safeParse({ users: "all of them" }).success);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
