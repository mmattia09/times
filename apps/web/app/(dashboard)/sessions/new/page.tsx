import { PageHeader } from "@/components/layout/page-header";
import { SessionForm } from "@/components/forms/session-form";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("sessions.newSession") };
}
export default async function NewSessionPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("sessions.newSession")} description={t("sessions.newSessionDescription")} />
      <SessionForm />
    </div>
  );
}
