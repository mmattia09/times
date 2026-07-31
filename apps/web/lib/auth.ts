import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import {
  accounts,
  authSessions,
  users,
  verifications,
} from "@/lib/db/schema";
import { configuredOrigins, trustedOriginsFor } from "@/lib/origins";

/**
 * Whether the session cookie is marked Secure.
 *
 * A Secure cookie is only kept by the browser over https, so an instance that
 * is *also* opened over plain http — the usual "type the server's address on
 * the LAN" case — would seem to log in and then have no session. Following
 * BETTER_AUTH_URL is the right default; SECURE_COOKIES=false is the switch for
 * reaching one instance both ways.
 */
function secureCookieSetting(): boolean | undefined {
  const setting = process.env.SECURE_COOKIES?.trim().toLowerCase();
  if (setting === "true") return true;
  if (setting === "false") return false;
  return undefined; // Let Better Auth decide from baseURL.
}

const useSecureCookies = secureCookieSetting();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // Resolved per request: one instance is legitimately reachable by its public
  // name, through a reverse proxy, and by its address on your own network.
  trustedOrigins: (request) => (request ? trustedOriginsFor(request) : configuredOrigins()),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: authSessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  ...(useSecureCookies === undefined ? {} : { advanced: { useSecureCookies } }),
});

export type AuthSession = typeof auth.$Infer.Session;
