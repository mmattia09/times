"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RUN_DISTANCES } from "@/lib/athletics";
import { useI18n } from "@/lib/i18n/client";

const ALL = "__all__";

export function SessionFilters({ seasons }: { seasons: { key: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const queryParam = params.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);

  // Keep the box in step with the URL (back button, "clear filters").
  useEffect(() => setQuery(queryParam), [queryParam]);

  // Debounced so typing doesn't fire a navigation per keystroke.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current || query === queryParam) return;
    const id = setTimeout(() => set("q", query.trim()), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`/sessions?${next.toString()}`);
  }

  const filter = (key: string, placeholder: string, options: { value: string; label: string }[]) => {
    const value = params.get(key) ?? ALL;
    // Radix only fills the trigger once the items mount, so the server would
    // render six blank boxes. Passing the label as children avoids that flash.
    const label = options.find((o) => o.value === value)?.label ?? placeholder;
    return (
    <Select value={value} onValueChange={(v) => set(key, v)}>
      <SelectTrigger className="h-8 w-auto min-w-[7.5rem] text-xs">
        <SelectValue>{label}</SelectValue>
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
  };

  const hasFilters = ["season", "type", "organizzatore", "distance", "livello", "tipo", "q"].some(
    (k) => params.get(k),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            typed.current = true;
            setQuery(e.target.value);
          }}
          placeholder={t("sessions.searchPlaceholder")}
          aria-label={t("sessions.searchPlaceholder")}
          className="h-8 w-44 pl-8 pr-7 text-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              typed.current = true;
              setQuery("");
            }}
            aria-label={t("sessions.clearFilters")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
