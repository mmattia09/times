import { getSession } from "@/lib/current-user";
import { buildExport } from "@/lib/data-transfer";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const data = await buildExport(session.user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="athletics-export-${stamp}.json"`,
    },
  });
}
