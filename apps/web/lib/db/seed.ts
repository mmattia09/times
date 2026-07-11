import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "./index";
import { accounts, userSettings, users } from "./schema";
import { auth } from "../auth";

/**
 * Provisioning script (runs on container start). The app ships with no data:
 * this only ensures the single admin account exists and matches the
 * ADMIN_EMAIL / ADMIN_PASSWORD environment variables. Changing those and
 * restarting re-syncs the admin's credentials — the admin can't change them
 * from the UI. Everyone else registers and self-manages through the app.
 */
async function provisionAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "changeme";

  const [admin] = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);

  if (!admin) {
    // First boot: create the admin (Better Auth hashes the password + creates
    // the credential account), then flag it and normalise the email.
    await auth.api.signUpEmail({ body: { email, name: "Admin", password } });
    await db
      .update(users)
      .set({ isAdmin: true, email, emailVerified: true })
      .where(eq(users.email, email));
    // Ensure a settings row exists.
    await db.insert(userSettings).values({ userId: (await adminId(email)) }).onConflictDoNothing();
    console.log(`Admin created: ${email}`);
    return;
  }

  // Existing admin: re-apply email + password from the environment.
  await db
    .update(users)
    .set({ email, emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, admin.id));
  await db
    .update(accounts)
    .set({ password: await hashPassword(password), updatedAt: new Date() })
    .where(and(eq(accounts.userId, admin.id), eq(accounts.providerId, "credential")));
  await db.insert(userSettings).values({ userId: admin.id }).onConflictDoNothing();
  console.log(`Admin synced from env: ${email}`);
}

async function adminId(email: string): Promise<string> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!row) throw new Error("Admin user not found after creation");
  return row.id;
}

provisionAdmin()
  .then(() => {
    console.log("Provisioning complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Provisioning failed:", err);
    process.exit(1);
  });
