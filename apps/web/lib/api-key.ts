import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

const KEY_PREFIX = "ath_live_";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generate a new API key. The raw value is shown to the user exactly once. */
export function generateApiKey(): { raw: string; keyHash: string; prefix: string } {
  const raw = KEY_PREFIX + randomBytes(24).toString("base64url");
  return { raw, keyHash: hashKey(raw), prefix: raw.slice(0, 16) };
}

/**
 * Authenticate a request to /api/v1/* via `Authorization: Bearer <key>`.
 * Returns the owning userId, or null if missing/invalid/revoked.
 */
export async function authenticateApiKey(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const keyHash = hashKey(match[1].trim());
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  if (!row || row.revokedAt) return null;

  // Best-effort last-used timestamp.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});

  return row.userId;
}

/** Standard 401 response for the v1 API. */
export function unauthorized(): Response {
  return Response.json(
    { error: "unauthorized", message: "Missing or invalid API key" },
    { status: 401 },
  );
}
