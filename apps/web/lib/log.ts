/**
 * What happened on this instance, one line each, on stdout.
 *
 * Self-hosted means the logs are the only place to look when something is off:
 * who signed in, what got created, which sync ran, what an admin changed. Kept
 * to a readable line rather than JSON — this is read with `docker compose logs`,
 * not shipped to a log service — but with key=value pairs so grep still works.
 *
 * Never log a password, a token, or the contents of a session.
 */

export type LogEvent =
  | "boot"
  // Auth
  | "auth.signin"
  | "auth.signin.failed"
  | "auth.signup"
  | "auth.signout"
  | "auth.password.changed"
  | "auth.password.forced"
  | "auth.ratelimited"
  | "auth.origin.rejected"
  // The athlete's own data
  | "session.created"
  | "session.updated"
  | "session.deleted"
  | "workout.created"
  | "workout.updated"
  | "workout.deleted"
  | "goal.created"
  | "goal.deleted"
  | "apikey.created"
  | "apikey.revoked"
  | "settings.updated"
  // Import / export
  | "fidal.preview"
  | "fidal.sync"
  | "fidal.failed"
  | "data.exported"
  | "data.imported"
  | "data.repaired"
  // Admin
  | "admin.user.created"
  | "admin.user.deleted"
  | "admin.user.role"
  | "admin.user.password"
  | "admin.user.logins.revoked";

type Fields = Record<string, string | number | boolean | null | undefined>;

/** Quote only when a value would otherwise break the key=value reading. */
function render(value: string | number | boolean): string {
  const s = String(value);
  return /[\s"]/.test(s) ? JSON.stringify(s) : s;
}

/**
 * Emails identify a person; log enough to recognise the account without
 * printing the whole address into a file someone else may end up reading.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "-";
  const [local, domain] = email.split("@");
  if (!domain) return "-";
  const head = local.slice(0, 2);
  return `${head}${local.length > 2 ? "***" : ""}@${domain}`;
}

export function logEvent(event: LogEvent, fields: Fields = {}): void {
  const parts = [new Date().toISOString(), event];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=${render(value)}`);
  }
  // A single console.log keeps the line intact when several requests interleave.
  console.log(parts.join("  "));
}

/** Client address, as far as the proxy in front of us reports it. */
export function requestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "-";
}
