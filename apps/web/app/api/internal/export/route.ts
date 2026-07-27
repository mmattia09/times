import { requireApiUser } from "@/lib/current-user";
import { buildExport } from "@/lib/data-transfer";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const data = await buildExport(auth.user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="athletics-export-${stamp}.json"`,
    },
  });
}
