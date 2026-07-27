import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Server-side: returns the current Better Auth session, or null.
 * Cached per request — the root layout, the segment layout, generateMetadata
 * and the page all ask for it, and that should be one lookup, not four.
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Server-side: returns the current user, redirecting to /login if absent. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}
