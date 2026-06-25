"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

type PreviewItem = { fidalId: string; date: string; specialita: string; prestazione: string };
type Preview = { total: number; newItems: PreviewItem[]; skipped: PreviewItem[] };

export function FidalSettings({
  initialUrl,
  lastSyncAt,
}: {
  initialUrl: string;
  lastSyncAt: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState<"" | "save" | "preview" | "sync">("");
  const [preview, setPreview] = useState<Preview | null>(null);

  async function save() {
    setBusy("save");
    const res = await fetch("/api/internal/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fidalUrl: url }),
    });
    setBusy("");
    if (!res.ok) {
      toast({ variant: "destructive", title: "Errore", description: "URL non valido o salvataggio fallito." });
      return;
    }
    toast({ title: "Salvato", description: "URL FIDAL aggiornato." });
    router.refresh();
  }

  async function testConnection() {
    setBusy("preview");
    setPreview(null);
    const res = await fetch("/api/internal/fidal/preview");
    setBusy("");
    const json = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Errore FIDAL", description: json.message ?? "Connessione fallita." });
      return;
    }
    setPreview(json.data);
    toast({
      title: "Anteprima pronta",
      description: `${json.data.newItems.length} nuovi · ${json.data.skipped.length} già importati`,
    });
  }

  async function syncNow() {
    setBusy("sync");
    const res = await fetch("/api/internal/fidal/sync", { method: "POST" });
    setBusy("");
    const json = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Errore FIDAL", description: json.message ?? "Sync fallita." });
      return;
    }
    toast({
      title: "Sincronizzato",
      description: `${json.data.imported} importati · ${json.data.skipped} saltati`,
    });
    setPreview(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fidal-url">URL profilo atleta FIDAL</Label>
        <div className="flex gap-2">
          <Input
            id="fidal-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.fidal.it/atleta/…"
          />
          <Button variant="outline" onClick={save} disabled={busy === "save" || !url}>
            <Save className="h-4 w-4" /> Salva
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={testConnection} disabled={!!busy || !url}>
          <RefreshCw className={`h-4 w-4 ${busy === "preview" ? "animate-spin" : ""}`} /> Testa connessione
        </Button>
        <Button onClick={syncNow} disabled={!!busy || !url}>
          <Download className="h-4 w-4" /> Sincronizza ora
        </Button>
        {lastSyncAt && (
          <span className="text-xs text-muted-foreground">
            Ultima sync: {formatDate(lastSyncAt, "d MMM yyyy, HH:mm")}
          </span>
        )}
      </div>

      {preview && (
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b p-3 text-sm">
            <span className="font-medium">Anteprima import</span>
            <span className="flex gap-2">
              <Badge variant="success">{preview.newItems.length} nuovi</Badge>
              <Badge variant="muted">{preview.skipped.length} già presenti</Badge>
            </span>
          </div>
          {preview.newItems.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nessun nuovo risultato da importare.</p>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto">
              {preview.newItems.map((i) => (
                <li key={i.fidalId} className="flex items-center justify-between p-2.5 text-sm">
                  <span className="text-muted-foreground">{i.date}</span>
                  <span className="font-medium">{i.specialita}</span>
                  <span className="tabular-nums">{i.prestazione}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
