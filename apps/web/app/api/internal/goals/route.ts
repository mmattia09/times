import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { goalInputSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const data = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, session.user.id))
    .orderBy(asc(goals.distance));
  return Response.json({ data });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = goalInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db
    .insert(goals)
    .values({ userId: session.user.id, ...parsed.data, target: parsed.data.target.toString() })
    .returning({ id: goals.id });
  return Response.json({ id: row.id }, { status: 201 });
}
