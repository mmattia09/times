"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Usage = {
  id: string;
  date: string;
  endDate: string | null;
  type: "training" | "competition";
  luogo: string | null;
};

/** "Svolta N volte" summary for a scheda, expandable into the session list. */
export function TemplateUsage({ templateId }: { templateId: string }) {
  const [usage, setUsage] = useState<Usage[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/internal/templates/${templateId}/usage`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setUsage(j.data ?? []);
      })
      .catch(() => {
        if (alive) setUsage([]);
      });
    return () => {
      alive = false;
    };
  }, [templateId]);

  if (usage === null) return null;

  if (usage.length === 0) {
    return (
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Mai svolta — agganciala a una sessione per tenerne traccia.
      </p>
    );
  }

  const last = usage[0];

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-secondary/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Svolta {usage.length} {usage.length === 1 ? "volta" : "volte"} · ultima{" "}
          {formatDate(last.date)}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="divide-y border-t">
          {usage.map((u) => (
            <li key={u.id}>
              <Link
                href={`/sessions/${u.id}`}
                className="flex items-center justify-between gap-2 px-4 py-2 text-xs transition-colors hover:bg-secondary/40"
              >
                <span className="flex items-center gap-2">
                  <Badge variant={u.type === "competition" ? "default" : "muted"}>
                    {u.type === "competition" ? "Gara" : "Allen."}
                  </Badge>
                  {formatDate(u.date)}
                  {u.endDate && <> → {formatDate(u.endDate)}</>}
                </span>
                <span className="truncate text-muted-foreground">{u.luogo ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
