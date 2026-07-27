import { requireApiUser } from "@/lib/current-user";
import { getLuoghi } from "@/lib/services";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const data = await getLuoghi(auth.user.id);
  return Response.json({ data });
}
