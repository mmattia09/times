import { requireApiKey } from "@/lib/api-key";
import { getRecords } from "@/lib/services";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const data = await getRecords(userId);
  return Response.json({ data });
}
