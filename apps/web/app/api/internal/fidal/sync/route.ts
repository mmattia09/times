import { requireApiUser } from "@/lib/current-user";
import { commitFidalSync } from "@/lib/fidal-sync";
import { logEvent } from "@/lib/log";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const data = await commitFidalSync(auth.user.id);
    logEvent("fidal.sync", { user: auth.user.id, imported: data.imported, skipped: data.skipped });
    return Response.json({ data });
  } catch (err) {
    logEvent("fidal.failed", { user: auth.user.id, action: "sync", reason: (err as Error).message });
    return Response.json({ error: "fidal_error", message: (err as Error).message }, { status: 502 });
  }
}
