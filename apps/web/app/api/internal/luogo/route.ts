import { getSession } from "@/lib/current-user";
import { getLuoghi } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const data = await getLuoghi(session.user.id);
  return Response.json({ data });
}
