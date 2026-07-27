import { requireApiUser } from "@/lib/current-user";
import { commitFidalSync } from "@/lib/fidal-sync";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const data = await commitFidalSync(auth.user.id);
    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "fidal_error", message: (err as Error).message }, { status: 502 });
  }
}
