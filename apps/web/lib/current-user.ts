import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Server-side: returns the current Better Auth session, or null.
 * Cached per request — the root layout, the segment layout, generateMetadata
 * and the page all ask for it, and that should be one lookup, not four.
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Account flags that gate access, in one cached lookup. */
export const getAccountState = cache(
  async (): Promise<{ isAdmin: boolean; isOwner: boolean; mustChangePassword: boolean }> => {
    const session = await getSession();
    if (!session?.user) return { isAdmin: false, isOwner: false, mustChangePassword: false };
    const [row] = await db
      .select({
        isAdmin: users.isAdmin,
        isOwner: users.isOwner,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    return {
      isAdmin: row?.isAdmin ?? false,
      isOwner: row?.isOwner ?? false,
      mustChangePassword: row?.mustChangePassword ?? false,
    };
  },
);

/** Server-side: returns the current user, redirecting to /login if absent. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}

/**
 * Session guard for the internal API. Returns the user, or the Response to
 * hand straight back: 401 without a session, and 403 while a forced password
 * change is pending — otherwise the temporary password an admin handed out
 * would still open the whole API, and blocking only the pages would be
 * security theatre.
 */
export async function requireApiUser(): Promise<
  { user: { id: string; email: string } } | { error: Response }
> {
  const session = await getSession();
  if (!session?.user) {
    return { error: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const { mustChangePassword } = await getAccountState();
  if (mustChangePassword) {
    return {
      error: Response.json(
        { error: "password_change_required", message: "errors.passwordChangeRequired" },
        { status: 403 },
      ),
    };
  }
  return { user: { id: session.user.id, email: session.user.email } };
}
