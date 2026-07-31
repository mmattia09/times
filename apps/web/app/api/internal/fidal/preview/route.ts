import { requireApiUser } from "@/lib/current-user";
import { previewFidalSync } from "@/lib/fidal-sync";
import { logEvent } from "@/lib/log";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const data = await previewFidalSync(auth.user.id);
    logEvent("fidal.preview", { user: auth.user.id, total: data.total, new: data.newItems.length, present: data.skipped.length });
    return Response.json({ data });
  } catch (err) {
    logEvent("fidal.failed", { user: auth.user.id, action: "preview", reason: (err as Error).message });
    return Response.json({ error: "fidal_error", message: (err as Error).message }, { status: 502 });
  }
}
