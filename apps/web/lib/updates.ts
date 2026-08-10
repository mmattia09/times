/**
 * Whether a newer Times has been released, and what changed in it.
 *
 * This is the one thing in the app that talks to anywhere other than the
 * athlete's own instance and (if configured) FIDAL, so it is worth being plain
 * about it: the server asks github.com for the release list of this project.
 * That tells GitHub the instance's address exists and roughly when it is
 * running — nothing about the user or their data leaves. UPDATE_CHECKS=false
 * turns it off entirely, and then the settings card just reports the version
 * it is running.
 *
 * The request is made by the server, not the browser: one instance asking once
 * every few hours rather than every admin's phone asking on every page load,
 * and no reader's own address handed to GitHub.
 */

/** Releases of this project. Public API, no token, 60 requests an hour per IP. */
const RELEASES_URL = "https://api.github.com/repos/mmattia09/times/releases?per_page=10";

/** GitHub asks for one, and an honest one costs nothing. */
const USER_AGENT = "times-selfhosted-update-check";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6_000;

export type Release = {
  /** The tag with its "v" removed: "1.6.0". */
  version: string;
  name: string;
  notes: string;
  url: string;
  publishedAt: string | null;
};

export type UpdateStatus = {
  /** What this instance is running, or null for a build that isn't a release. */
  current: string | null;
  /** The newest release found, or null when the check couldn't run. */
  latest: string | null;
  /** True only when we know both versions and ours is older. */
  behind: boolean;
  /** Releases newer than the running one, newest first. Empty when up to date. */
  newer: Release[];
  /** Why there is nothing to report, when there isn't. */
  state: "ok" | "disabled" | "unknown-version" | "unreachable";
  checkedAt: string;
};

/** The version this build is, baked in by the Docker build. */
export function currentVersion(): string | null {
  const raw = process.env.APP_VERSION?.trim();
  if (!raw) return null;
  const v = raw.replace(/^v/i, "");
  return isVersion(v) ? v : null;
}

export function updateChecksEnabled(): boolean {
  return process.env.UPDATE_CHECKS?.trim().toLowerCase() !== "false";
}

/** A plain x.y.z, which is all this project ever tags. */
export function isVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

/**
 * Compare two x.y.z versions numerically. Negative when a is older.
 *
 * String comparison gets this wrong the moment a number reaches double digits
 * — "1.10.0" sorts before "1.9.0" — which is exactly when nobody is testing
 * the update check any more.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map(Number);
  const pb = b.replace(/^v/i, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** The GitHub release shape, as much of it as we use. */
type GithubRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

/**
 * Keep the releases that are real, tagged x.y.z, and newer than `current`.
 * Pure, so the decision can be checked without the network.
 */
export function releasesNewerThan(current: string | null, raw: unknown): Release[] {
  if (!Array.isArray(raw)) return [];
  const releases: Release[] = [];
  for (const item of raw as GithubRelease[]) {
    if (!item || typeof item !== "object") continue;
    if (item.draft === true || item.prerelease === true) continue;
    const tag = typeof item.tag_name === "string" ? item.tag_name.replace(/^v/i, "") : "";
    if (!isVersion(tag)) continue;
    if (current && compareVersions(tag, current) <= 0) continue;
    releases.push({
      version: tag,
      name: typeof item.name === "string" && item.name ? item.name : tag,
      notes: typeof item.body === "string" ? item.body : "",
      url:
        typeof item.html_url === "string" && item.html_url.startsWith("https://github.com/")
          ? item.html_url
          : `https://github.com/mmattia09/times/releases/tag/v${tag}`,
      publishedAt: typeof item.published_at === "string" ? item.published_at : null,
    });
  }
  return releases.sort((a, b) => compareVersions(b.version, a.version));
}

/** The newest release in the payload, whether or not it is newer than ours. */
export function newestRelease(raw: unknown): string | null {
  const all = releasesNewerThan(null, raw);
  return all[0]?.version ?? null;
}

let cache: { at: number; status: UpdateStatus } | null = null;

/**
 * Ask GitHub, at most once every few hours per instance.
 *
 * A failure here is never an error the admin has to deal with: no network, a
 * rate limit, GitHub being down — all of it just means "couldn't check", and
 * the page still says which version is running.
 */
export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  const current = currentVersion();

  if (!updateChecksEnabled()) {
    return {
      current,
      latest: null,
      behind: false,
      newer: [],
      state: "disabled",
      checkedAt: new Date().toISOString(),
    };
  }

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.status;

  let status: UpdateStatus;
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const body: unknown = await res.json();
    const latest = newestRelease(body);
    const newer = releasesNewerThan(current, body);
    status = {
      current,
      latest,
      behind: current != null && latest != null && compareVersions(current, latest) < 0,
      newer,
      // Without a version of our own we can still show what the newest release
      // is; we just can't claim this instance is behind it.
      state: current == null ? "unknown-version" : "ok",
      checkedAt: new Date().toISOString(),
    };
  } catch {
    status = {
      current,
      latest: null,
      behind: false,
      newer: [],
      state: "unreachable",
      checkedAt: new Date().toISOString(),
    };
  }

  cache = { at: Date.now(), status };
  return status;
}
