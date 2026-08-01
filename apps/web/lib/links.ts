/**
 * Recognising the services an athlete links a session to.
 *
 * The icon is decided from the hostname alone, so a link pasted with tracking
 * parameters or a share path still gets it right, and anything unrecognised
 * falls back to a plain link rather than guessing.
 */

export type LinkService = "strava" | "instagram" | "youtube" | "tiktok" | "generic";

/** Hostname suffixes that identify a service, longest match wins. */
const HOSTS: Array<{ service: LinkService; suffixes: string[]; name: string }> = [
  { service: "strava", suffixes: ["strava.com", "strava.app.link"], name: "Strava" },
  { service: "instagram", suffixes: ["instagram.com", "instagr.am"], name: "Instagram" },
  { service: "youtube", suffixes: ["youtube.com", "youtu.be", "youtube-nocookie.com"], name: "YouTube" },
  { service: "tiktok", suffixes: ["tiktok.com", "vm.tiktok.com"], name: "TikTok" },
];

/** The host, without www., or null when the value isn't a usable http(s) URL. */
export function linkHost(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function serviceFor(url: string): LinkService {
  const host = linkHost(url);
  if (!host) return "generic";
  for (const entry of HOSTS) {
    // Suffix match on a dot boundary: "notstrava.com" is not Strava.
    if (entry.suffixes.some((s) => host === s || host.endsWith(`.${s}`))) return entry.service;
  }
  return "generic";
}

/** What to show when the athlete didn't name the link themselves. */
export function defaultLabel(url: string): string {
  const service = serviceFor(url);
  const known = HOSTS.find((h) => h.service === service);
  return known?.name ?? linkHost(url) ?? url;
}
