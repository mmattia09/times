import type { WorkoutBlock } from "@/lib/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Renders workout blocks in the athlete's usual table layout. */
export function WorkoutTable({ blocks }: { blocks: WorkoutBlock[] }) {
  const hasNotes = blocks.some((b) => b.note);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Blocco</TableHead>
          <TableHead>Ripetute</TableHead>
          <TableHead>Recupero</TableHead>
          <TableHead>Pausa</TableHead>
          <TableHead>Ritmo</TableHead>
          {hasNotes && <TableHead>Note</TableHead>}
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
