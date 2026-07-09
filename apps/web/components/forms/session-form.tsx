"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkoutTable } from "@/components/workouts/workout-table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { WorkoutTemplate } from "@/lib/db/schema";
import {
  DISCIPLINES,
  JUMP_EVENTS,
  RELAY_EVENTS,
  RUN_DISTANCES,
  THROW_EVENTS,
  isTimed,
} from "@/lib/athletics";
import { sessionInputSchema, type SessionInput } from "@/lib/validation";
import type { Discipline } from "@/lib/db/schema";

const NONE = "__none__";

/** Default per-discipline event and distance when the discipline changes. */
function disciplineDefaults(d: Discipline): { distance: number | null; event: string | null } {
  switch (d) {
    case "jump":
      return { distance: null, event: "lungo" };
    case "throw":
      return { distance: null, event: "giavellotto" };
    case "relay":
      return { distance: null, event: "4x100" };
    case "combined":
      return { distance: null, event: "" };
    case "hurdles":
      return { distance: 100, event: null };
    case "middle_distance":
      return { distance: 800, event: null };
    case "long_distance":
      return { distance: 3000, event: null };
    case "walk":
      return { distance: 5000, event: null };
    default:
      return { distance: 100, event: null };
  }
}

type FormValues = SessionInput;

export function SessionForm({
  sessionId,
  initial,
}: {
  sessionId?: string;
  initial?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [luoghi, setLuoghi] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(sessionInputSchema),
    defaultValues: {
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
      endDate: initial?.endDate ?? null,
      type: initial?.type ?? "training",
      tempo: initial?.tempo ?? null,
      livello: initial?.livello ?? null,
      luogo: initial?.luogo ?? null,
      organizzatore: initial?.organizzatore ?? null,
      tipo: initial?.tipo ?? null,
      note: initial?.note ?? null,
      workout: initial?.workout ?? null,
      performances: initial?.performances ?? [
        { discipline: "sprint", distance: 100, event: null, result: 0, wind: null, lane: null, position: null, heat: null },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "performances" });
  const type = form.watch("type");

  useEffect(() => {
    fetch("/api/internal/luogo")
      .then((r) => r.json())
      .then((j) => setLuoghi(j.data ?? []))
      .catch(() => {});
    fetch("/api/internal/templates")
      .then((r) => r.json())
      .then((j) => setTemplates(j.data ?? []))
      .catch(() => {});
  }, []);

  const workout = form.watch("workout");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const res = await fetch(
      sessionId ? `/api/internal/sessions/${sessionId}` : "/api/internal/sessions",
      {
        method: sessionId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    setSubmitting(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Errore", description: "Salvataggio non riuscito." });
      return;
    }
    const json = await res.json();
    toast({ title: "Salvato", description: "Sessione salvata correttamente." });
    router.push(`/sessions/${sessionId ?? json.id}`);
    router.refresh();
  }

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        // ⌘/Ctrl+Invio salva; Invio da solo dentro un input non invia il form
        // a metà compilazione (comportamento coerente con l'editor delle schede).
        if (e.key !== "Enter") return;
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          form.handleSubmit(onSubmit)();
        } else if ((e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
        }
      }}
      className="space-y-6"
    >
      <div className="space-y-3">
      <h2 className="text-sm font-semibold">Dettagli</h2>
      <Card>
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          {/* Type toggle */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tipo</Label>
            <div className="inline-flex rounded-md border p-0.5">
              {(["training", "competition"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => form.setValue("type", t)}
                  className={cn(
                    "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                    type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {t === "training" ? "Allenamento" : "Gara"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" {...form.register("date")} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endDate">Data fine (opzionale)</Label>
            <Input id="endDate" type="date" {...form.register("endDate")} />
          </div>

          <EnumSelect
            label="Cronometraggio"
            value={form.watch("tempo")}
            onChange={(v) => form.setValue("tempo", v as FormValues["tempo"])}
            options={[
              { value: "elettronico", label: "Elettronico" },
              { value: "cronometro", label: "Cronometro" },
              { value: "manuale", label: "Manuale" },
            ]}
          />

          <div className="space-y-1.5">
            <Label htmlFor="luogo">Luogo</Label>
            <Input id="luogo" list="luoghi" placeholder="Es. Venezia" {...form.register("luogo")} />
            <datalist id="luoghi">
              {luoghi.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          {type === "competition" && (
            <>
              <EnumSelect
                label="Livello"
                value={form.watch("livello")}
                onChange={(v) => form.setValue("livello", v as FormValues["livello"])}
                options={[
                  { value: "regionale", label: "Regionale" },
                  { value: "provinciale", label: "Provinciale" },
                  { value: "nazionale", label: "Nazionale" },
                  { value: "internazionale", label: "Internazionale" },
                ]}
              />
              <EnumSelect
                label="Organizzatore"
                value={form.watch("organizzatore")}
                onChange={(v) => form.setValue("organizzatore", v as FormValues["organizzatore"])}
                options={[
                  { value: "fidal", label: "FIDAL" },
                  { value: "csi", label: "CSI" },
                  { value: "altro", label: "Altro" },
                ]}
              />
            </>
          )}

          <EnumSelect
            label="Ambiente"
            value={form.watch("tipo")}
            onChange={(v) => form.setValue("tipo", v as FormValues["tipo"])}
            options={[
              { value: "outdoor", label: "Outdoor" },
              { value: "indoor", label: "Indoor" },
            ]}
          />

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" placeholder="Dettagli, sensazioni, condizioni…" {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Workout (scheda allenamento) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Scheda allenamento</h2>
          {workout && (
            <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("workout", null)}>
              <Trash2 className="h-4 w-4" /> Rimuovi
            </Button>
          )}
        </div>
        {workout ? (
          <Card>
            <CardContent className="p-0">
              {workout.name && (
                <p className="border-b px-4 py-2 text-sm font-medium">{workout.name}</p>
              )}
              <WorkoutTable blocks={workout.blocks} />
            </CardContent>
          </Card>
        ) : templates.length > 0 ? (
          <Select
            value=""
            onValueChange={(id) => {
              const t = templates.find((x) => x.id === id);
              if (t) {
                form.setValue("workout", { templateId: t.id, name: t.name, blocks: t.blocks });
              }
            }}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Aggancia una scheda dalla libreria…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.category ? `${t.category} · ` : ""}
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nessuna scheda in libreria: creane una nella pagina Schede per agganciarla qui.
          </p>
        )}
      </div>

      {/* Performances */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Prestazioni</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ discipline: "sprint", distance: 100, event: null, result: 0, wind: null, lane: null, position: null, heat: null })
            }
          >
            <Plus className="h-4 w-4" /> Aggiungi
          </Button>
        </div>
        {typeof errors.performances?.message === "string" && (
          <p className="text-xs text-destructive">{errors.performances.message}</p>
        )}

        {fields.map((field, idx) => (
          <PerformanceRow
            key={field.id}
            index={idx}
            form={form}
            onRemove={() => (fields.length > 1 ? remove(idx) : null)}
            canRemove={fields.length > 1}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto text-xs text-muted-foreground">⌘Invio: salva</span>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Annulla
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvataggio…" : sessionId ? "Aggiorna sessione" : "Crea sessione"}
        </Button>
      </div>
    </form>
  );
}

function EnumSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PerformanceRow({
  index,
  form,
  onRemove,
  canRemove,
}: {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const discipline = form.watch(`performances.${index}.discipline`);
  const isJump = discipline === "jump";
  const isThrow = discipline === "throw";
  const isRelay = discipline === "relay";
  const isCombined = discipline === "combined";
  const timed = isTimed(discipline);
  const eventOptions = isJump ? JUMP_EVENTS : isThrow ? THROW_EVENTS : isRelay ? RELAY_EVENTS : null;
  const resultErr = form.formState.errors.performances?.[index]?.result;

  const resultLabel = isThrow ? "(m)" : isJump ? "(cm)" : isCombined ? "(punti)" : "(tempo, s)";

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Disciplina</Label>
          <Select
            value={discipline}
            onValueChange={(v) => {
              const d = v as Discipline;
              const def = disciplineDefaults(d);
              form.setValue(`performances.${index}.discipline`, d);
              form.setValue(`performances.${index}.distance`, def.distance);
              form.setValue(`performances.${index}.event`, def.event);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCIPLINES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {eventOptions ? (
          <div className="space-y-1.5">
            <Label>Specialità</Label>
            <Select
              value={form.watch(`performances.${index}.event`) ?? ""}
              onValueChange={(v) => form.setValue(`performances.${index}.event`, v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventOptions.map((o) => (
                  <SelectItem key={o.event} value={o.event}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : isCombined ? (
          <div className="space-y-1.5">
            <Label>Specialità</Label>
            <Input placeholder="es. Eptathlon" {...form.register(`performances.${index}.event`)} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Distanza (m)</Label>
            <Input
              type="number"
              list={`distances-${index}`}
              placeholder="metri"
              {...form.register(`performances.${index}.distance`)}
            />
            <datalist id={`distances-${index}`}>
              {RUN_DISTANCES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Risultato {resultLabel}</Label>
          <Input type="number" step="0.01" {...form.register(`performances.${index}.result`)} />
          {resultErr && <p className="text-xs text-destructive">{resultErr.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Vento (m/s)</Label>
          <Input type="number" step="0.1" placeholder="opz." {...form.register(`performances.${index}.wind`)} />
        </div>

        <div className="space-y-1.5">
          <Label>Corsia</Label>
          <Input type="number" placeholder="opz." {...form.register(`performances.${index}.lane`)} />
        </div>
        <div className="space-y-1.5">
          <Label>Posizione</Label>
          <Input type="number" placeholder="opz." {...form.register(`performances.${index}.position`)} />
        </div>
        <div className="space-y-1.5">
          <Label>Batteria / turno</Label>
          <Input placeholder="es. finale" {...form.register(`performances.${index}.heat`)} />
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={!canRemove}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" /> Rimuovi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
