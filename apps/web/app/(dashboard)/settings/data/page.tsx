"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type Report = {
  sessions: { imported: number; skipped: number };
  workoutTemplates: { imported: number; skipped: number };
  goals: { imported: number; skipped: number };
  apiKeys: { imported: number; skipped: number };
  settings: boolean;
};

export default function DataSettingsPage() {
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
    <div className="mx-auto max-w-3xl">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <PageHeader
        title="Dati"
        description="Esporta o importa tutti i tuoi dati. Cambiare istanza è: esporta → registrati → importa."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Esporta</CardTitle>
            <CardDescription>
              Un unico file JSON con tutto: sessioni e prestazioni, schede allenamento, obiettivi,
              impostazioni e chiavi API (solo hash — le password non vengono mai esportate).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/internal/export" download>
                <Download className="h-4 w-4" /> Esporta tutto (JSON)
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importa</CardTitle>
            <CardDescription>
              Carica un export JSON di athletics-tracker. L&apos;import è idempotente: sessioni,
              schede, obiettivi e chiavi già presenti vengono saltati, mai duplicati.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Upload className="h-4 w-4" /> {importing ? "Import in corso…" : "Scegli file JSON"}
            </Button>

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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Via API</CardTitle>
            <CardDescription>
              Per migrazioni scriptate: <code>GET /api/v1/export</code> e{" "}
              <code>POST /api/v1/import</code> con la tua chiave API (
              <code>Authorization: Bearer …</code>).
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
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
