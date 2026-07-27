import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Repeat } from "lucide-react";
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
import { getT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

function meta(label: string, value?: string | null) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm capitalize">{value}</dd>
    </div>
  );
}

/** One lookup per request, shared by generateMetadata and the page itself. */
const loadSession = cache(async (id: string) => {
  const user = await requireUser();
  return getSessionById(user.id, id);
});

/** The date the session covers — also its page title. */
function dateRange(
  session: { date: Date | string; endDate: Date | string | null },
  locale: Locale,
): string {
  return session.endDate
    ? `${formatDateLong(session.date, locale)} → ${formatDateLong(session.endDate, locale)}`
    : formatDateLong(session.date, locale);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { locale } = await getT();
  const session = await loadSession((await params).id);
  return { title: session ? dateRange(session, locale) : undefined };
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, dict, locale } = await getT();
  const { id } = await params;
  const session = await loadSession(id);
  if (!session) notFound();

  const dateLabel = dateRange(session, locale);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={dateLabel}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/sessions/new?from=${id}`}>
            <Repeat className="h-4 w-4" /> {t("sessions.repeat")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/sessions/${id}/edit`}>
            <Pencil className="h-4 w-4" /> {t("common.edit")}
          </Link>
        </Button>
        <DeleteSessionButton sessionId={id} />
      </PageHeader>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant={session.type === "competition" ? "default" : "muted"}>
              {session.type === "competition" ? t("common.competition") : t("common.training")}
            </Badge>
            {session.tipo && <Badge variant="secondary">{dict.enums.tipo[session.tipo]}</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {meta(t("common.place"), session.luogo)}
            {meta(t("common.timing"), session.tempo ? dict.enums.tempo[session.tempo] : null)}
            {meta(t("common.level"), session.livello ? dict.enums.livello[session.livello] : null)}
            {meta(t("common.organiser"), formatOrganizzatore(session.organizzatore, dict))}
          </dl>
          {session.note && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{session.note}</p>
          )}
        </CardContent>
      </Card>

      {session.workout && (
        <>
          <div className="mb-2 mt-6 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {t("sessions.workoutSection")}
              {session.workout.name ? ` — ${session.workout.name}` : ""}
            </h2>
            {session.workout.templateId && (
              <Link
                href={`/workouts/${session.workout.templateId}/edit`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("sessions.openInLibrary")}
              </Link>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <WorkoutTable blocks={session.workout.blocks} />
            </CardContent>
          </Card>
        </>
      )}

      {session.performances.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">{t("sessions.performances")}</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.event")}</TableHead>
                    <TableHead>{t("common.result")}</TableHead>
                    <TableHead>{t("common.wind")}</TableHead>
                    <TableHead>{t("common.lane")}</TableHead>
                    <TableHead>{t("common.position")}</TableHead>
                    <TableHead>{t("common.heat")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.performances.map((p) => {
                    const wind = p.wind != null ? Number(p.wind) : null;
                    const windy = !isWindLegal(p, wind);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {eventLabel(p, dict)}
                          {p.isPersonalBest && (
                            <Badge variant="success" className="ml-2">
                              PB
                            </Badge>
                          )}
                          {windy && (
                            <Badge
                              variant="muted"
                              className="ml-2"
                              title={t("sessions.windyTitle")}
                            >
                              {t("sessions.windy")}
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
        </>
      )}

      {session.performances.length === 0 && !session.workout && (
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("sessions.emptySessionNote")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
