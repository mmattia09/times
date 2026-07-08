import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SessionFilters } from "@/components/sessions/session-filters";
import { SessionsTable, type SessionRow } from "@/components/sessions/sessions-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import { eventLabel, formatResult, isWindLegal } from "@/lib/athletics";
import { formatDate } from "@/lib/format";
import { listSeasons, seasonKey, seasonLabel } from "@/lib/season";
import { listSessions, type SessionFilters as Filters } from "@/lib/services";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const filters: Filters = {
    season: sp.season || undefined,
    type: sp.type as Filters["type"],
    distance: sp.distance ? Number(sp.distance) : undefined,
    organizzatore: sp.organizzatore as Filters["organizzatore"],
    livello: sp.livello as Filters["livello"],
    tipo: sp.tipo as Filters["tipo"],
  };

  const [data, earliest] = await Promise.all([
    listSessions(user.id, filters),
    db
      .select({ date: sessions.date })
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(asc(sessions.date))
      .limit(1),
  ]);

  const seasons = earliest[0]
    ? listSeasons(earliest[0].date).map((s) => ({ key: seasonKey(s), label: seasonLabel(s) }))
    : [];

  const rows: SessionRow[] = data.map((s) => ({
    id: s.id,
    date: formatDate(s.date),
    type: s.type,
    tempo: s.tempo,
    livello: s.livello,
    luogo: s.luogo,
    organizzatore: s.organizzatore,
    tipo: s.tipo,
    note: s.note,
    performances: s.performances
      .map((p) => {
        const windy = !isWindLegal(p, p.wind != null ? Number(p.wind) : null);
        return `${eventLabel(p)} ${formatResult(p.result, p)}${windy ? "w" : ""}`;
      })
      .join(" · "),
  }));

  return (
    <>
      <PageHeader title="Sessioni" description={`${data.length} risultati`}>
        <Button asChild size="sm">
          <Link href="/sessions/new">
            <Plus className="h-4 w-4" /> Nuova
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SessionFilters seasons={seasons} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Nessuna sessione trovata.</p>
            <Button asChild size="sm">
              <Link href="/sessions/new">
                <Plus className="h-4 w-4" /> Aggiungi la prima
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <SessionsTable rows={rows} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
