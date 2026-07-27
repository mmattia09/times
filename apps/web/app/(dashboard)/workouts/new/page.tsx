import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/workouts/template-form";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("workouts.newTitle") };
}
export default async function NewTemplatePage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("workouts.newTitle")} description={t("workouts.newDescription")} />
      <TemplateForm />
    </div>
  );
}
