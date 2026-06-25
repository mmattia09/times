import { PageHeader } from "@/components/layout/page-header";
import { SessionForm } from "@/components/forms/session-form";

export default function NewSessionPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuova sessione" description="Registra un allenamento o una gara." />
      <SessionForm />
    </div>
  );
}
