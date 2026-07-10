import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteSessionButton } from "@/components/sessions/delete-session-button";
import { WorkoutTable } from "@/components/workouts/workout-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/current-user";
import { getSessionById } from "@/lib/services";
import { eventLabel, formatResult, isWindLegal } from "@/lib/athletics";
import { formatDateLong, formatOrganizzatore } from "@/lib/format";

function meta(label: string, value?: string | null) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm capitalize">{value}</dd>
    </div>
  );
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const session = await getSessionById(user.id, id);
  if (!session) notFound();

  const dateLabel = session.endDate
    ? `${formatDateLong(session.date)} → ${formatDateLong(session.endDate)}`
    : formatDateLong(session.date);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={dateLabel}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/sessions/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Modifica
          </Link>
        </Button>
        <DeleteSessionButton sessionId={id} />
      </PageHeader>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant={session.type === "competition" ? "default" : "muted"}>
              {session.type === "competition" ? "Gara" : "Allenamento"}
            </Badge>
            {session.tipo && <Badge variant="secondary">{session.tipo}</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {meta("Luogo", session.luogo)}
            {meta("Cronometraggio", session.tempo)}
            {meta("Livello", session.livello)}
            {meta("Organizzatore", formatOrganizzatore(session.organizzatore))}
          </dl>
          {session.note && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{session.note}</p>
          )}
        </CardContent>
      </Card>

      {session.workout && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">
            Scheda allenamento{session.workout.name ? ` — ${session.workout.name}` : ""}
          </h2>
          <Card>
            <CardContent className="p-0">
              <WorkoutTable blocks={session.workout.blocks} />
            </CardContent>
          </Card>
        </>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Prestazioni</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Specialità</TableHead>
                <TableHead>Risultato</TableHead>
                <TableHead>Vento</TableHead>
                <TableHead>Corsia</TableHead>
                <TableHead>Pos.</TableHead>
                <TableHead>Turno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {session.performances.map((p) => {
                const wind = p.wind != null ? Number(p.wind) : null;
                const windy = !isWindLegal(p, wind);
                return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {eventLabel(p)}
                    {p.isPersonalBest && (
                      <Badge variant="success" className="ml-2">
                        PB
                      </Badge>
                    )}
                    {windy && (
                      <Badge variant="muted" className="ml-2" title="Vento oltre +2.0 m/s: non valida come record">
                        ventosa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatResult(p.result, p)}
                    {windy && <sup className="ml-0.5 text-muted-foreground">w</sup>}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {wind != null ? `${wind > 0 ? "+" : ""}${wind.toFixed(1)}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{p.lane ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{p.position ?? "—"}</TableCell>
                  <TableCell>{p.heat ?? "—"}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
