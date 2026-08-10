"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/client";

export type SessionRow = {
  id: string;
  date: string;
  type: "training" | "competition";
  tempo: string | null;
  livello: string | null;
  luogo: string | null;
  organizzatore: string | null;
  tipo: string | null;
  note: string | null;
  performances: string;
};

/** Enum columns hold the raw DB value; show the translation when there is one. */
function enumLabel(labels: Record<string, string>, value: string | null): string {
  if (!value) return "—";
  return labels[value] ?? value;
}

/**
 * The same sessions, as a list you can actually read on a phone.
 *
 * Eight columns in a sideways-scrolling table means no row is legible without
 * dragging it into view, and the results — the reason you opened the page —
 * are the part that falls off the right edge. So below md the row becomes a
 * block: date and kind on one line, what you did underneath, venue last.
 */
function SessionCards({ rows }: { rows: SessionRow[] }) {
  const router = useRouter();
  const { t, dict } = useI18n();
  return (
    <ul className="divide-y md:hidden">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => router.push(`/sessions/${r.id}`)}
            className="w-full space-y-1 px-4 py-3 text-left transition-colors active:bg-secondary/60"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{r.date}</span>
              <Badge variant={r.type === "competition" ? "default" : "muted"}>
                {r.type === "competition" ? t("common.competition") : t("common.training")}
              </Badge>
              {r.luogo && (
                <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
                  {r.luogo}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{r.performances}</p>
            {(r.livello || r.tipo) && (
              <p className="text-xs text-muted-foreground">
                {[
                  r.livello ? enumLabel(dict.enums.livello, r.livello) : null,
                  r.tipo ? enumLabel(dict.enums.tipo, r.tipo) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SessionsTable({ rows }: { rows: SessionRow[] }) {
  const router = useRouter();
  const { t, dict } = useI18n();
  return (
    <>
    <SessionCards rows={rows} />
    <Table className="hidden md:table">
      <TableHeader>
        <TableRow>
          <TableHead>{t("common.date")}</TableHead>
          <TableHead>{t("common.type")}</TableHead>
          <TableHead>{t("sessions.performances")}</TableHead>
          <TableHead>{t("sessions.timingShort")}</TableHead>
          <TableHead>{t("common.level")}</TableHead>
          <TableHead>{t("common.place")}</TableHead>
          <TableHead>{t("sessions.organiserShort")}</TableHead>
          <TableHead>{t("common.environment")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            className="cursor-pointer"
            onClick={() => router.push(`/sessions/${r.id}`)}
          >
            <TableCell className="font-medium">{r.date}</TableCell>
            <TableCell>
              <Badge variant={r.type === "competition" ? "default" : "muted"}>
                {r.type === "competition" ? t("common.competition") : t("common.training")}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[16rem] truncate">{r.performances}</TableCell>
            <TableCell className="text-muted-foreground">
              {enumLabel(dict.enums.tempo, r.tempo)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {enumLabel(dict.enums.livello, r.livello)}
            </TableCell>
            <TableCell className="text-muted-foreground">{r.luogo ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">
              {enumLabel(dict.enums.organizzatore, r.organizzatore)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {enumLabel(dict.enums.tipo, r.tipo)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  );
}
