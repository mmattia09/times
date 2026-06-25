import { authenticateApiKey, unauthorized } from "@/lib/api-key";
import { previewFidalSync } from "@/lib/fidal-sync";

export async function GET(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) return unauthorized();
  try {
    const data = await previewFidalSync(userId);
    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "fidal_error", message: (err as Error).message }, { status: 502 });
  }
}
