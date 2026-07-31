"use client";

import type { WorkoutBlock } from "@/lib/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/client";

/**
 * Renders workout blocks in the athlete's usual table layout.
 *
 * A client component because it translates its own headers: the session detail
 * page is a server component, and rendering a hook there throws.
 */
export function WorkoutTable({ blocks }: { blocks: WorkoutBlock[] }) {
  const { t } = useI18n();
  const hasNotes = blocks.some((b) => b.note);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("workouts.blockCol")}</TableHead>
          <TableHead>{t("workouts.repsCol")}</TableHead>
          <TableHead>{t("workouts.recoveryCol")}</TableHead>
          <TableHead>{t("workouts.pauseCol")}</TableHead>
          <TableHead>{t("workouts.paceCol")}</TableHead>
          {hasNotes && <TableHead>{t("workouts.notesCol")}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {blocks.map((b, i) => (
          <TableRow key={i}>
            <TableCell className="text-muted-foreground">{b.label ?? ""}</TableCell>
            <TableCell className="font-medium">{b.ripetute}</TableCell>
            <TableCell className="text-muted-foreground">{b.recupero ?? ""}</TableCell>
            <TableCell className="text-muted-foreground">{b.pausa ?? ""}</TableCell>
            <TableCell className="text-muted-foreground">{b.ritmo ?? ""}</TableCell>
            {hasNotes && (
              <TableCell className="max-w-[18rem] whitespace-normal text-muted-foreground">
                {b.note ?? ""}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
