import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const profileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
});

/**
 * Update the current user's name/email. Self-host without a mailer, so we write
 * the users table directly (login looks up by email; sessions key on the user
 * id, so this is safe). The admin account is env-managed and rejected here.
 */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [me] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (me?.isAdmin) {
    return Response.json(
      { error: "forbidden", message: "L'account admin si gestisce dal file .env." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
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
      .where(and(eq(users.email, email), ne(users.id, session.user.id)))
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

  await db.update(users).set(update).where(eq(users.id, session.user.id));
  return Response.json({ ok: true });
}
