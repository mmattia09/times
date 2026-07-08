import { authenticateApiKey, unauthorized } from "@/lib/api-key";
import { buildExport } from "@/lib/data-transfer";

export async function GET(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) return unauthorized();
  const data = await buildExport(userId);
  return Response.json(data);
}
