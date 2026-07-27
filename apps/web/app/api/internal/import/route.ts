import { requireApiUser } from "@/lib/current-user";
import { exportFileSchema, importData } from "@/lib/data-transfer";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = exportFileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "bad_request", message: "errors.importBadFile", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const report = await importData(auth.user.id, parsed.data);
  return Response.json({ data: report });
}
