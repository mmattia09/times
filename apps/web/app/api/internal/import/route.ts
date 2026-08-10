import { requireApiUser } from "@/lib/current-user";
import { exportFileSchema, importData } from "@/lib/data-transfer";
import { logEvent } from "@/lib/log";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = exportFileSchema.safeParse(body);
  if (!parsed.success) {
    // A schema message that is itself a translation key names a reason worth
    // telling apart — "this file is from a newer Times" is a different problem
    // from "this isn't an export", and only one of them is the file's fault.
    const named = parsed.error.issues.find((i) => i.message.startsWith("errors."));
    return Response.json(
      {
        error: "bad_request",
        message: named?.message ?? "errors.importBadFile",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const report = await importData(auth.user.id, parsed.data);
  logEvent("data.imported", { user: auth.user.id, sessions: report.sessions.imported, skipped: report.sessions.skipped });
  return Response.json({ data: report });
}
