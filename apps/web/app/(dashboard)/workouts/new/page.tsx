import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/workouts/template-form";

export default function NewTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuova scheda" description="Blocchi, ripetute, recuperi e ritmi — come sulle tue tabelle." />
      <TemplateForm />
    </div>
  );
}
