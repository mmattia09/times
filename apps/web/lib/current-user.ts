import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Server-side: returns the current Better Auth session, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Server-side: returns the current user, redirecting to /login if absent. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}
