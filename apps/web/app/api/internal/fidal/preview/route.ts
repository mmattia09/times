import { requireApiUser } from "@/lib/current-user";
import { previewFidalSync } from "@/lib/fidal-sync";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const data = await previewFidalSync(auth.user.id);
    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "fidal_error", message: (err as Error).message }, { status: 502 });
  }
}
