"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { seasonLabel } from "@/lib/season";
import { RUN_DISTANCES } from "@/lib/athletics";

const ALL = "__all__";

export function SessionFilters({ seasons }: { seasons: number[] }) {
  const router = useRouter();
  const params = useSearchParams();

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
        "Tutte le stagioni",
        seasons.map((s) => ({ value: String(s), label: seasonLabel(s) })),
      )}
      {filter("type", "Tipo", [
        { value: "training", label: "Allenamento" },
        { value: "competition", label: "Gara" },
      ])}
      {filter(
        "distance",
        "Distanza",
        RUN_DISTANCES.map((d) => ({ value: String(d), label: `${d}m` })),
      )}
      {filter("organizzatore", "Organizzatore", [
        { value: "fidal", label: "FIDAL" },
        { value: "csi", label: "CSI" },
        { value: "altro", label: "Altro" },
      ])}
      {filter("livello", "Livello", [
        { value: "regionale", label: "Regionale" },
        { value: "provinciale", label: "Provinciale" },
        { value: "nazionale", label: "Nazionale" },
        { value: "internazionale", label: "Internazionale" },
      ])}
      {filter("tipo", "Ambiente", [
        { value: "outdoor", label: "Outdoor" },
        { value: "indoor", label: "Indoor" },
      ])}
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push("/sessions")}>
          Azzera
        </Button>
      )}
    </div>
  );
}
