import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SessionForm } from "@/components/forms/session-form";
import { requireUser } from "@/lib/current-user";
import { getSessionById } from "@/lib/services";
import { toSessionInitial } from "@/lib/session-initial";
import { getT } from "@/lib/i18n/server";

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { id } = await params;
  const session = await getSessionById(user.id, id);
  if (!session) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("sessions.editSession")} />
      <SessionForm sessionId={id} initial={toSessionInitial(session)} />
    </div>
  );
}
