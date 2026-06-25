import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { generateApiKey } from "@/lib/api-key";
import { apiKeyInputSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const data = await db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .orderBy(desc(apiKeys.createdAt));
  return Response.json({ data });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = apiKeyInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { raw, keyHash, prefix } = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({ userId: session.user.id, label: parsed.data.label, keyHash, prefix })
    .returning({ id: apiKeys.id });

  // The raw key is returned exactly once.
  return Response.json({ id: row.id, key: raw, prefix }, { status: 201 });
}
