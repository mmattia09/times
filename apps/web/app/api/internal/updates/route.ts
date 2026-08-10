import { requireAdminApi } from "@/lib/admin";
import { getUpdateStatus } from "@/lib/updates";

/**
 * Admin-only: whether a newer Times exists, and the release notes for the
 * versions in between. Behind requireAdminApi because it reaches out to
 * github.com — that is an outbound request made on behalf of whoever asks, so
 * it isn't something an ordinary account gets to trigger.
 *
 * `?refresh=1` skips the cache, for the button next to the version.
 */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const status = await getUpdateStatus(refresh);
  return Response.json({ data: status });
}
