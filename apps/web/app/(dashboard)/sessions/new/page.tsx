import { PageHeader } from "@/components/layout/page-header";
import { SessionForm } from "@/components/forms/session-form";
import { requireUser } from "@/lib/current-user";
import { getSessionById } from "@/lib/services";
import { toRepeatInitial } from "@/lib/session-initial";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { t } = await getT();
  const { from } = await searchParams;
  return { title: from ? t("sessions.repeatTitle") : t("sessions.newSession") };
}

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { t } = await getT();
  const { from } = await searchParams;

  // ?from=<id> repeats an earlier session: same setup, today's date, no results.
  const source = from ? await getSessionById((await requireUser()).id, from) : null;
  const initial = source ? toRepeatInitial(source) : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={source ? t("sessions.repeatTitle") : t("sessions.newSession")}
        description={source ? t("sessions.repeatDescription") : t("sessions.newSessionDescription")}
      />
      <SessionForm initial={initial} />
    </div>
  );
}
