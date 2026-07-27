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

export function SessionsTable({ rows }: { rows: SessionRow[] }) {
  const router = useRouter();
  const { t, dict } = useI18n();
  return (
    <Table>
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
                {r.type === "competition" ? t("common.competitionShort") : t("common.trainingShort")}
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
  );
}
