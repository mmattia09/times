/**
 * Which origins may talk to the auth endpoints.
 *
 * Better Auth refuses any request whose Origin isn't one it trusts — that check
 * is what stops another site from driving someone's session. The default is
 * just baseURL, which breaks the moment the app is reachable by more than one
 * name: a tunnel hostname, a reverse proxy, and the LAN address you use from
 * the track are all the same instance.
 *
 * So: the configured public URL, anything listed in TRUSTED_ORIGINS, and — for
 * a self-hosted app — the private addresses of your own network. A page on the
 * public internet cannot claim an origin like http://192.168.1.10:3000, so
 * accepting those costs nothing and saves the "why can't I log in by IP" dance.
 */

/**
 * Hosts only reachable from inside a network you already control.
 *
 * The address ranges are matched as addresses, not as text: "192.168.1.40" is
 * a private host, "192.168.1.40.evil.com" is a domain someone can register and
 * has no business being trusted for merely starting with the same digits.
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h === "::1") return true;
  // Reserved suffixes: none of these can be registered on the public internet.
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".home.arpa")) return true;

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (ipv4.slice(1).some((n) => Number(n) > 255)) return false;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    return false;
  }

  // Unique local IPv6 (fc00::/7). Only a literal address contains a colon.
  if (h.includes(":") && /^f[cd][0-9a-f]{2}:/.test(h)) return true;
  return false;
}

/** Normalise to scheme://host[:port], or null if it isn't a URL. */
function toOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).origin;
  } catch {
    return null;
  }
}

/** Origins from the environment: the public URL plus anything listed. */
export function configuredOrigins(): string[] {
  const out = new Set<string>();
  for (const value of [
    process.env.BETTER_AUTH_URL ?? "",
    ...(process.env.TRUSTED_ORIGINS ?? "").split(","),
  ]) {
    const origin = toOrigin(value);
    if (origin) out.add(origin);
  }
  return [...out];
}

/**
 * Decide whether one request's Origin is acceptable. Called per request so the
 * answer can depend on where the request actually came from.
 */
export function trustedOriginsFor(request: Request): string[] {
  const trusted = new Set(configuredOrigins());

  // The origin this request claims, and the host it arrived on. Behind a proxy
  // or a tunnel these are the public name, which is exactly what we want to
  // compare — not the container's own address.
  for (const candidate of [
    request.headers.get("origin"),
    forwardedOrigin(request),
  ]) {
    const origin = candidate ? toOrigin(candidate) : null;
    if (!origin) continue;
    try {
      if (isPrivateHost(new URL(origin).hostname)) trusted.add(origin);
    } catch {
      // Not a URL we can reason about; leave it untrusted.
    }
  }

  return [...trusted];
}

/** The public origin a proxy says the request came in on. */
function forwardedOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
