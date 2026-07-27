import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "./index";
import { accounts, userSettings, users } from "./schema";
import { auth } from "../auth";

/**
 * Provisioning script (runs on container start). The app ships with no data:
 * this only ensures the owner account exists and matches the ADMIN_EMAIL /
 * ADMIN_PASSWORD environment variables. Changing those and restarting re-syncs
 * the owner's credentials — they can't be changed from the UI. Everyone else
 * registers (or is created from the admin area) and self-manages in the app.
 *
 * Keyed on isOwner, not isAdmin: the owner can grant admin to other people,
 * and overwriting one of *their* accounts from the environment would be a
 * spectacular way to lose someone's login.
 */
async function provisionAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "changeme";

  const [owner] = await db.select().from(users).where(eq(users.isOwner, true)).limit(1);

  if (!owner) {
    // First boot: create the admin (Better Auth hashes the password + creates
    // the credential account), then flag it and normalise the email.
    await auth.api.signUpEmail({ body: { email, name: "Admin", password } });
    await db
      .update(users)
      .set({ isAdmin: true, isOwner: true, email, emailVerified: true })
      .where(eq(users.email, email));
    // Ensure a settings row exists.
    await db.insert(userSettings).values({ userId: await ownerId(email) }).onConflictDoNothing();
    console.log(`Owner account created: ${email}`);
    return;
  }

  // Existing owner: re-apply email + password from the environment.
  await db
    .update(users)
    .set({ email, emailVerified: true, isAdmin: true, updatedAt: new Date() })
    .where(eq(users.id, owner.id));
  await db
    .update(accounts)
    .set({ password: await hashPassword(password), updatedAt: new Date() })
    .where(and(eq(accounts.userId, owner.id), eq(accounts.providerId, "credential")));
  await db.insert(userSettings).values({ userId: owner.id }).onConflictDoNothing();
  console.log(`Owner synced from env: ${email}`);
}

async function ownerId(email: string): Promise<string> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!row) throw new Error("Owner user not found after creation");
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
