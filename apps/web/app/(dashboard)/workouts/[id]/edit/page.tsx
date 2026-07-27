import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/workouts/template-form";
import { db } from "@/lib/db";
import { workoutTemplates } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("workouts.editTitle") };
}
export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { id } = await params;
  const [template] = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id)))
    .limit(1);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("workouts.editTitle")} />
      <TemplateForm template={template} />
    </div>
  );
}
