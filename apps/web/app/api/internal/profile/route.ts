import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { logEvent } from "@/lib/log";

const profileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
});

/**
 * Update the current user's name/email. Self-host without a mailer, so we write
 * the users table directly (login looks up by email; sessions key on the user
 * id, so this is safe). The admin's credentials are env-managed: the admin may
 * change their display name here, but never the email.
 */
export async function PUT(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [me] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (me?.isAdmin && parsed.data.email != null) {
    return Response.json(
      { error: "forbidden", message: "L'email dell'admin si gestisce dal file .env." },
      { status: 403 },
    );
  }

  const update: { name?: string; email?: string; emailVerified?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (parsed.data.name != null) update.name = parsed.data.name;
  if (parsed.data.email != null) {
    const email = parsed.data.email.trim().toLowerCase();
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, auth.user.id)))
      .limit(1);
    if (taken) {
      return Response.json(
        { error: "email_taken", message: "Email già in uso." },
        { status: 409 },
      );
    }
    update.email = email;
    update.emailVerified = false;
  }

  await db.update(users).set(update).where(eq(users.id, auth.user.id));
  logEvent("settings.updated", { user: auth.user.id, what: Object.keys(update).filter((k) => k !== "updatedAt").join(",") });
  return Response.json({ ok: true });
}
