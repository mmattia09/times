import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SessionForm } from "@/components/forms/session-form";
import { requireUser } from "@/lib/current-user";
import { getSessionById } from "@/lib/services";
import { toDateInputValue } from "@/lib/format";
import type { SessionInput } from "@/lib/validation";

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const session = await getSessionById(user.id, id);
  if (!session) notFound();

  const initial: Partial<SessionInput> = {
    date: toDateInputValue(session.date),
    endDate: session.endDate ? toDateInputValue(session.endDate) : null,
    type: session.type,
    tempo: session.tempo,
    livello: session.livello,
    luogo: session.luogo,
    organizzatore: session.organizzatore,
    tipo: session.tipo,
    note: session.note,
    workout: session.workout ?? null,
    performances: session.performances.map((p) => ({
      discipline: p.discipline,
      distance: p.distance,
      event: p.event,
      result: Number(p.result),
      wind: p.wind != null ? Number(p.wind) : null,
      lane: p.lane,
      position: p.position,
      heat: p.heat,
    })),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Modifica sessione" />
      <SessionForm sessionId={id} initial={initial} />
    </div>
  );
}
