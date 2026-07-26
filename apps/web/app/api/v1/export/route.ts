import { requireApiKey } from "@/lib/api-key";
import { buildExport } from "@/lib/data-transfer";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const data = await buildExport(userId);
  return Response.json(data);
}
