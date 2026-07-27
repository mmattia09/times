"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";

type Report = {
  sessions: { imported: number; skipped: number };
  workoutTemplates: { imported: number; skipped: number };
  goals: { imported: number; skipped: number };
  apiKeys: { imported: number; skipped: number };
  settings: boolean;
};

/** Export/import controls shown inside the Settings "Dati" card. */
export function DataTransferCard() {
  const { t } = useI18n();
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
          title: t("settings.importFailed"),
          description: t(json.message ?? "settings.invalidFile"),
        });
        return;
      }
      setReport(json.data);
      toast({ title: t("settings.importDone"), description: t("settings.importedSessions", { count: json.data.sessions.imported }) });
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("settings.invalidJson") });
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
            <Download className="h-4 w-4" /> {t("settings.exportAll")}
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
          <Upload className="h-4 w-4" /> {importing ? t("settings.importing") : t("settings.importJson")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
{t("settings.importNote")}
      </p>

      {report && (
        <div className="rounded-md border p-3 text-sm">
          <p className="mb-2 font-medium">{t("settings.importResult")}</p>
          <ul className="space-y-1 text-muted-foreground">
            <ReportRow label={t("nav.sessions")} r={report.sessions} t={t} />
            <ReportRow label={t("nav.workouts")} r={report.workoutTemplates} t={t} />
            <ReportRow label={t("records.goals")} r={report.goals} t={t} />
            <ReportRow label={t("settings.apiKeys")} r={report.apiKeys} t={t} />
            <li>
              {t("nav.settings")}:{" "}
              {report.settings ? <Badge variant="success">{t("settings.settingsUpdated")}</Badge> : <Badge variant="muted">{t("settings.settingsMissing")}</Badge>}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportRow({ label, r, t }: { label: string; r: { imported: number; skipped: number }; t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <li>
      {label}: <span className="text-foreground">{t("settings.importedLabel", { count: r.imported })}</span>
      {r.skipped > 0 && <> · {t("settings.skippedLabel", { count: r.skipped })}</>}
    </li>
  );
}
