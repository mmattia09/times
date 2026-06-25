import { getSession } from "@/lib/current-user";
import { commitFidalSync } from "@/lib/fidal-sync";

export async function POST() {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await commitFidalSync(session.user.id);
    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "fidal_error", message: (err as Error).message }, { status: 502 });
  }
}
