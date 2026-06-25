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

export function SessionsTable({ rows }: { rows: SessionRow[] }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Prestazioni</TableHead>
          <TableHead>Cron.</TableHead>
          <TableHead>Livello</TableHead>
          <TableHead>Luogo</TableHead>
          <TableHead>Org.</TableHead>
          <TableHead>Ambiente</TableHead>
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
                {r.type === "competition" ? "Gara" : "Allen."}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[16rem] truncate">{r.performances}</TableCell>
            <TableCell className="capitalize text-muted-foreground">{r.tempo ?? "—"}</TableCell>
            <TableCell className="capitalize text-muted-foreground">{r.livello ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{r.luogo ?? "—"}</TableCell>
            <TableCell className="uppercase text-muted-foreground">{r.organizzatore ?? "—"}</TableCell>
            <TableCell className="capitalize text-muted-foreground">{r.tipo ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
