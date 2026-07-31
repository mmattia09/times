import { configuredOrigins, trustedOriginsFor } from "@/lib/origins";

/** A request as it arrives through a tunnel, a proxy, or straight off the LAN. */
const req = (headers: Record<string, string>) =>
  new Request("http://internal:3000/api/auth/sign-in/email", { method: "POST", headers });

const cases: Array<{ what: string; env: Record<string, string>; headers: Record<string, string>; origin: string; trusted: boolean }> = [
  {
    what: "cloudflare tunnel, public URL configured",
    env: { BETTER_AUTH_URL: "https://times.example.com" },
    headers: { origin: "https://times.example.com", "x-forwarded-host": "times.example.com", "x-forwarded-proto": "https" },
    origin: "https://times.example.com",
    trusted: true,
  },
  {
    what: "same instance, opened by LAN address",
    env: { BETTER_AUTH_URL: "https://times.example.com" },
    headers: { origin: "http://192.168.1.40:3000", host: "192.168.1.40:3000" },
    origin: "http://192.168.1.40:3000",
    trusted: true,
  },
  {
    what: "LAN address on another private range",
    env: { BETTER_AUTH_URL: "https://times.example.com" },
    headers: { origin: "http://10.0.0.5:3000", host: "10.0.0.5:3000" },
    origin: "http://10.0.0.5:3000",
    trusted: true,
  },
  {
    what: "localhost during development",
    env: {},
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    origin: "http://localhost:3000",
    trusted: true,
  },
  {
    what: "a hostname on the home network",
    env: { BETTER_AUTH_URL: "https://times.example.com" },
    headers: { origin: "http://nas.local:3000", host: "nas.local:3000" },
    origin: "http://nas.local:3000",
    trusted: true,
  },
  {
    what: "second public name, listed in TRUSTED_ORIGINS",
    env: { BETTER_AUTH_URL: "https://times.example.com", TRUSTED_ORIGINS: "https://times.example.org" },
    headers: { origin: "https://times.example.org", "x-forwarded-host": "times.example.org", "x-forwarded-proto": "https" },
    origin: "https://times.example.org",
    trusted: true,
  },
  {
    what: "another site trying to drive the session",
    env: { BETTER_AUTH_URL: "https://times.example.com" },
    headers: { origin: "https://evil.example.com", "x-forwarded-host": "times.example.com", "x-forwarded-proto": "https" },
    origin: "https://evil.example.com",
    trusted: false,
  },
  {
    what: "a public host that merely looks private",
    env: { BETTER_AUTH_URL: "https://times.example.com" },
    headers: { origin: "https://192.168.1.40.evil.com", host: "192.168.1.40.evil.com" },
    origin: "https://192.168.1.40.evil.com",
    trusted: false,
  },
  {
    what: "no public URL set at all, unknown public origin",
    env: {},
    headers: { origin: "https://somewhere.example.com", host: "somewhere.example.com" },
    origin: "https://somewhere.example.com",
    trusted: false,
  },
];

let failures = 0;
for (const c of cases) {
  for (const key of ["BETTER_AUTH_URL", "TRUSTED_ORIGINS"]) delete process.env[key];
  Object.assign(process.env, c.env);

  const trusted = trustedOriginsFor(req(c.headers));
  const got = trusted.includes(c.origin);
  const ok = got === c.trusted;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${got ? "accepted" : "refused "}  ${c.what}` +
      (ok ? "" : `\n         origin=${c.origin} trusted=${JSON.stringify(trusted)}`),
  );
}

// The configured list must never silently swallow a malformed value.
delete process.env.TRUSTED_ORIGINS;
process.env.BETTER_AUTH_URL = "https://times.example.com";
process.env.TRUSTED_ORIGINS = "https://a.example.com, b.example.com ,,not a url";
const configured = configuredOrigins();
const expected = ["https://times.example.com", "https://a.example.com", "https://b.example.com"];
const ok = expected.every((o) => configured.includes(o));
if (!ok) failures++;
console.log(`\n  ${ok ? "ok  " : "FAIL"} TRUSTED_ORIGINS parsing → ${JSON.stringify(configured)}`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
