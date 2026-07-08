import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/current-user";
import { db } from "@/lib/db";
import { workoutTemplates } from "@/lib/db/schema";
import { workoutTemplateInputSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const data = await db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.userId, session.user.id))
    .orderBy(asc(workoutTemplates.category), asc(workoutTemplates.name));
  return Response.json({ data });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = workoutTemplateInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db
    .insert(workoutTemplates)
    .values({ userId: session.user.id, ...parsed.data })
    .returning({ id: workoutTemplates.id });
  return Response.json({ id: row.id }, { status: 201 });
}
