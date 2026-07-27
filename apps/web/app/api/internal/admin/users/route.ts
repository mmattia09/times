import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";
import { authSessions, userSettings, users } from "@/lib/db/schema";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(128),
  email: z.string().trim().toLowerCase().email("validation.emailInvalid"),
  // Better Auth's own minimum; the person changes it from Settings afterwards.
  password: z.string().min(8, "validation.passwordShort").max(128),
  isAdmin: z.boolean().default(false),
  /** Lock the account until they replace the password the admin chose. */
  mustChangePassword: z.boolean().default(true),
});

/**
 * Create an account on behalf of someone else. This is the only way to add a
 * user once DISABLE_REGISTRATION is on, so the admin sets an initial password
 * and passes it along out of band — there is no mail server to invite through.
 */
export async function POST(req: Request) {
  const auth_ = await requireAdminApi();
  if ("error" in auth_) return auth_.error;

  // Creating accounts is cheap to script; keep it to a sane rate per admin.
  if (!rateLimit(`admin-create:${clientIp(req)}`, 10, 60_000)) return tooManyRequests(60);

  const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, isAdmin, mustChangePassword } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    return Response.json(
      { error: "conflict", message: "errors.emailTaken" },
      { status: 409 },
    );
  }

  // Better Auth owns password hashing and the credential account row.
  await auth.api.signUpEmail({ body: { email, name, password } });

  const [created] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!created) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  await db
    .update(users)
    .set({ emailVerified: true, isAdmin, mustChangePassword, updatedAt: new Date() })
    .where(eq(users.id, created.id));
  await db.insert(userSettings).values({ userId: created.id }).onConflictDoNothing();
  // Signing up opens a login session, but nobody is holding it — the admin
  // filled this form, not the new user. Drop it so the account starts signed
  // out and the user list doesn't show them as online.
  await db.delete(authSessions).where(eq(authSessions.userId, created.id));

  return Response.json({ ok: true, id: created.id }, { status: 201 });
}
