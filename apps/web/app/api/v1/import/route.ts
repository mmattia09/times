import { authenticateApiKey, unauthorized } from "@/lib/api-key";
import { exportFileSchema, importData } from "@/lib/data-transfer";

export async function POST(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = exportFileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const report = await importData(userId, parsed.data);
  return Response.json({ data: report });
}
