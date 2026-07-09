"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Report = {
  sessions: { imported: number; skipped: number };
  workoutTemplates: { imported: number; skipped: number };
  goals: { imported: number; skipped: number };
  apiKeys: { imported: number; skipped: number };
  settings: boolean;
};

/** Export/import controls shown inside the Settings "Dati" card. */
export function DataTransferCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function onImportFile(file: File) {
    setImporting(true);
    setReport(null);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch("/api/internal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Import non riuscito",
          description: json.message ?? "File non valido.",
        });
        return;
      }
      setReport(json.data);
      toast({ title: "Import completato", description: `${json.data.sessions.imported} sessioni importate.` });
    } catch {
      toast({ variant: "destructive", title: "Errore", description: "Il file non è un JSON valido." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href="/api/internal/export" download>
            <Download className="h-4 w-4" /> Esporta tutto (JSON)
          </a>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
          }}
        />
        <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {importing ? "Import in corso…" : "Importa JSON"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        L&apos;export contiene tutto: sessioni, prestazioni, schede, obiettivi, impostazioni e chiavi
        API (solo hash — mai le password). L&apos;import è idempotente: ciò che esiste già viene
        saltato. Via API: <code>GET /api/v1/export</code> · <code>POST /api/v1/import</code>.
      </p>

      {report && (
        <div className="rounded-md border p-3 text-sm">
          <p className="mb-2 font-medium">Risultato import</p>
          <ul className="space-y-1 text-muted-foreground">
            <ReportRow label="Sessioni" r={report.sessions} />
            <ReportRow label="Schede" r={report.workoutTemplates} />
            <ReportRow label="Obiettivi" r={report.goals} />
            <ReportRow label="Chiavi API" r={report.apiKeys} />
            <li>
              Impostazioni:{" "}
              {report.settings ? <Badge variant="success">aggiornate</Badge> : <Badge variant="muted">non presenti</Badge>}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportRow({ label, r }: { label: string; r: { imported: number; skipped: number } }) {
  return (
    <li>
      {label}: <span className="text-foreground">{r.imported} importate</span>
      {r.skipped > 0 && <> · {r.skipped} saltate (già presenti)</>}
    </li>
  );
}
