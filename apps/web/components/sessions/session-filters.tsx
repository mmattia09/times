"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RUN_DISTANCES } from "@/lib/athletics";
import { useI18n } from "@/lib/i18n/client";

const ALL = "__all__";

export function SessionFilters({ seasons }: { seasons: { key: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`/sessions?${next.toString()}`);
  }

  const filter = (key: string, placeholder: string, options: { value: string; label: string }[]) => (
    <Select value={params.get(key) ?? ALL} onValueChange={(v) => set(key, v)}>
      <SelectTrigger className="h-8 w-auto min-w-[7.5rem] text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const hasFilters = ["season", "type", "organizzatore", "distance", "livello", "tipo"].some((k) =>
    params.get(k),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filter(
        "season",
        t("sessions.allSeasons"),
        seasons.map((s) => ({ value: s.key, label: s.label })),
      )}
      {filter("type", t("sessions.filterType"), [
        { value: "training", label: t("common.training") },
        { value: "competition", label: t("common.competition") },
      ])}
      {filter(
        "distance",
        t("sessions.filterDistance"),
        RUN_DISTANCES.map((d) => ({ value: String(d), label: `${d}m` })),
      )}
      {filter("organizzatore", t("sessions.filterOrganiser"), [
        { value: "fidal", label: t("enums.organizzatore.fidal") },
        { value: "csi", label: t("enums.organizzatore.csi") },
        { value: "altro", label: t("enums.organizzatore.altro") },
      ])}
      {filter("livello", t("sessions.filterLevel"), [
        { value: "regionale", label: t("enums.livello.regionale") },
        { value: "provinciale", label: t("enums.livello.provinciale") },
        { value: "nazionale", label: t("enums.livello.nazionale") },
        { value: "internazionale", label: t("enums.livello.internazionale") },
      ])}
      {filter("tipo", t("sessions.filterEnvironment"), [
        { value: "outdoor", label: t("enums.tipo.outdoor") },
        { value: "indoor", label: t("enums.tipo.indoor") },
      ])}
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push("/sessions")}>
          {t("sessions.clearFilters")}
        </Button>
      )}
    </div>
  );
}
