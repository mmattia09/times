import { compareVersions, isVersion, newestRelease, releasesNewerThan } from "@/lib/updates";

/**
 * The update check tells an admin whether to pull a new image. Two ways for it
 * to be worse than useless: saying "up to date" when it isn't, and saying an
 * update exists when there isn't one. Both come down to comparing versions and
 * reading GitHub's answer, and neither needs the network to check.
 */

let failures = 0;
const check = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail && !ok ? `  ← ${detail}` : ""}`);
};

// ── Comparing ───────────────────────────────────────────────────────────────

check("equal versions compare equal", compareVersions("1.6.0", "1.6.0") === 0);
check("a newer patch is newer", compareVersions("1.6.1", "1.6.0") > 0);
check("a newer minor is newer", compareVersions("1.7.0", "1.6.9") > 0);
check("a newer major is newer", compareVersions("2.0.0", "1.99.99") > 0);
check("the leading v is ignored", compareVersions("v1.6.0", "1.6.0") === 0);

// The reason this isn't a string comparison: "1.10.0" < "1.9.0" as text, and
// the first double-digit release is the one nobody is watching for.
check("1.10.0 is newer than 1.9.0", compareVersions("1.10.0", "1.9.0") > 0);
check("1.6.10 is newer than 1.6.9", compareVersions("1.6.10", "1.6.9") > 0);

check("a plain x.y.z is a version", isVersion("1.6.0"));
check("a branch name is not", !isVersion("main"));
check("a prerelease tag is not", !isVersion("1.6.0-rc1"));
check("an empty string is not", !isVersion(""));

// ── Reading GitHub's answer ─────────────────────────────────────────────────

const release = (tag: string, over: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `${tag} — something`,
  body: "Fixed\n- a thing",
  html_url: `https://github.com/mmattia09/times/releases/tag/${tag}`,
  published_at: "2026-08-10T00:00:00Z",
  draft: false,
  prerelease: false,
  ...over,
});

const payload = [release("v1.7.0"), release("v1.6.0"), release("v1.5.0")];

check("the newest release is found", newestRelease(payload) === "1.7.0", String(newestRelease(payload)));

const newer = releasesNewerThan("1.5.0", payload);
check("only newer releases are listed", newer.map((r) => r.version).join(",") === "1.7.0,1.6.0", newer.map((r) => r.version).join(","));
check("newest first", newer[0]?.version === "1.7.0");
check("the notes come along", newer[0]?.notes.includes("a thing"));

check(
  "being on the newest release lists nothing",
  releasesNewerThan("1.7.0", payload).length === 0,
);
check(
  "being ahead of every release lists nothing",
  releasesNewerThan("2.0.0", payload).length === 0,
);
check(
  "no version of our own lists everything, so a dev build still shows a changelog",
  releasesNewerThan(null, payload).length === 3,
);

// Drafts and prereleases are not something to tell an admin to upgrade to.
const withDrafts = [release("v1.8.0", { draft: true }), release("v1.7.1", { prerelease: true }), ...payload];
check(
  "drafts and prereleases are ignored",
  newestRelease(withDrafts) === "1.7.0",
  String(newestRelease(withDrafts)),
);

// Tags that aren't versions at all (a branch build, a one-off) can't be compared.
check(
  "a tag that isn't a version is skipped",
  releasesNewerThan("1.6.0", [release("nightly"), release("v1.7.0")]).length === 1,
);

// The link is only ever followed to github.com — a payload is data from
// somewhere else, and this one ends up in an href.
const spoofed = releasesNewerThan("1.6.0", [
  release("v1.7.0", { html_url: "https://evil.example.com/phish" }),
]);
check(
  "a link outside github.com is replaced, not followed",
  spoofed[0]?.url.startsWith("https://github.com/"),
  spoofed[0]?.url,
);

// Anything unexpected in the shape must come back as "nothing to report"
// rather than throwing: the settings page has to render either way.
check("a non-array payload is empty", releasesNewerThan("1.6.0", { message: "rate limited" }).length === 0);
check("null is empty", releasesNewerThan("1.6.0", null).length === 0);
check("junk entries are skipped", releasesNewerThan("1.6.0", [null, 42, "x"]).length === 0);
check(
  "a release with no body is kept, with empty notes",
  releasesNewerThan("1.6.0", [release("v1.7.0", { body: null })])[0]?.notes === "",
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
