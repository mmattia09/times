import { asc, eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { goalInputSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const data = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, auth.user.id))
    .orderBy(asc(goals.distance));
  return Response.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = goalInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db
    .insert(goals)
    .values({ userId: auth.user.id, ...parsed.data, target: parsed.data.target.toString() })
    .returning({ id: goals.id });
  return Response.json({ id: row.id }, { status: 201 });
}
