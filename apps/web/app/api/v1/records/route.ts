import { authenticateApiKey, unauthorized } from "@/lib/api-key";
import { getRecords } from "@/lib/services";

export async function GET(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) return unauthorized();
  const data = await getRecords(userId);
  return Response.json({ data });
}
