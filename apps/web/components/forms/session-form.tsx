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
import { LinkIcon } from "@/components/sessions/link-icon";
import { toast } from "@/hooks/use-toast";
import { enqueue, isOffline } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";
import type { WorkoutTemplate } from "@/lib/db/schema";
import { RUN_DISTANCES, disciplineOptions, eventOptionsFor, isTimed } from "@/lib/athletics";
import { useI18n } from "@/lib/i18n/client";
import { sessionInputCheckedSchema, type SessionInput } from "@/lib/validation";
import { localTodayInputValue } from "@/lib/format";
import type { SessionFormInitial } from "@/lib/session-initial";
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
    case "test":
      return { distance: null, event: "lungo_fermo" };
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
  initial?: SessionFormInitial;
}) {
  const router = useRouter();
  const { t, dict } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [luoghi, setLuoghi] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(sessionInputCheckedSchema),
    defaultValues: {
      date: initial?.date ?? localTodayInputValue(),
      endDate: initial?.endDate ?? null,
      type: initial?.type ?? "training",
      tempo: initial?.tempo ?? null,
      livello: initial?.livello ?? null,
      luogo: initial?.luogo ?? null,
      organizzatore: initial?.organizzatore ?? null,
      tipo: initial?.tipo ?? null,
      note: initial?.note ?? null,
      workout: initial?.workout ?? null,
      links: initial?.links ?? [],
      // Starts empty: a session may record just the date(s) you trained.
      performances: initial?.performances ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "performances" });
  const links = useFieldArray({ control: form.control, name: "links" });
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
    let res: Response;
    try {
      res = await fetch(
        sessionId ? `/api/internal/sessions/${sessionId}` : "/api/internal/sessions",
        {
          method: sessionId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
    } catch (err) {
      setSubmitting(false);
      // No network. A new session is kept on the device and sent later; an
      // edit is not, because it would need the session that is already there.
      if (!sessionId && isOffline(err)) {
        enqueue(values);
        toast({ title: t("offline.queued"), description: t("offline.queuedDescription") });
        router.push("/sessions");
        router.refresh();
        return;
      }
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.saveFailed"),
      });
      return;
    }
    setSubmitting(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.saveFailed") });
      return;
    }
    const json = await res.json();
    toast({ title: t("common.saved"), description: t("sessions.savedOk") });
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
      <h2 className="text-sm font-semibold">{t("sessions.details")}</h2>
      <Card>
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          {/* Type toggle */}
          <div className="flex items-center gap-4 sm:col-span-2">
            <Label>{t("common.type")}</Label>
            <div className="inline-flex rounded-md border p-0.5">
              {(["training", "competition"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => form.setValue("type", option)}
                  className={cn(
                    "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                    type === option ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {option === "training" ? t("common.training") : t("common.competition")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">{t("common.date")}</Label>
            <Input id="date" type="date" {...form.register("date")} />
            {errors.date && <p className="text-xs text-destructive">{t(errors.date.message ?? "")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endDate">{t("sessions.endDate", { optional: t("common.optional") })}</Label>
            <Input id="endDate" type="date" min={form.watch("date") || undefined} {...form.register("endDate")} />
            <p className="text-xs text-muted-foreground">{t("sessions.endDateHint")}</p>
            {errors.endDate && <p className="text-xs text-destructive">{t(errors.endDate.message ?? "")}</p>}
          </div>

          <EnumSelect
            label={t("common.timing")}
            value={form.watch("tempo")}
            onChange={(v) => form.setValue("tempo", v as FormValues["tempo"])}
            options={[
              { value: "elettronico", label: t("enums.tempo.elettronico") },
              { value: "cronometro", label: t("enums.tempo.cronometro") },
              { value: "manuale", label: t("enums.tempo.manuale") },
            ]}
          />

          <div className="space-y-1.5">
            <Label htmlFor="luogo">{t("common.place")}</Label>
            <Input id="luogo" list="luoghi" placeholder={t("sessions.placePlaceholder")} {...form.register("luogo")} />
            <datalist id="luoghi">
              {luoghi.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          {type === "competition" && (
            <>
              <EnumSelect
                label={t("common.level")}
                value={form.watch("livello")}
                onChange={(v) => form.setValue("livello", v as FormValues["livello"])}
                options={[
                  { value: "regionale", label: t("enums.livello.regionale") },
                  { value: "provinciale", label: t("enums.livello.provinciale") },
                  { value: "nazionale", label: t("enums.livello.nazionale") },
                  { value: "internazionale", label: t("enums.livello.internazionale") },
                ]}
              />
              <EnumSelect
                label={t("common.organiser")}
                value={form.watch("organizzatore")}
                onChange={(v) => form.setValue("organizzatore", v as FormValues["organizzatore"])}
                options={[
                  { value: "fidal", label: t("enums.organizzatore.fidal") },
                  { value: "csi", label: t("enums.organizzatore.csi") },
                  { value: "altro", label: t("enums.organizzatore.altro") },
                ]}
              />
            </>
          )}

          <EnumSelect
            label={t("common.environment")}
            value={form.watch("tipo")}
            onChange={(v) => form.setValue("tipo", v as FormValues["tipo"])}
            options={[
              { value: "outdoor", label: t("enums.tipo.outdoor") },
              { value: "indoor", label: t("enums.tipo.indoor") },
            ]}
          />

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">{t("common.notes")}</Label>
            <Textarea id="note" placeholder={t("sessions.notesPlaceholder")} {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Workout (scheda allenamento) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("sessions.workoutSection")}</h2>
          {workout && (
            <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("workout", null)}>
              <Trash2 className="h-4 w-4" /> {t("common.remove")}
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
              <SelectValue placeholder={t("sessions.attachWorkout")} />
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
            {t("sessions.noWorkoutsYet")}
          </p>
        )}
      </div>

      {/* Links — a Strava activity, a video, a start list. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {t("sessions.links")}{" "}
            <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => links.append({ url: "", label: null })}
          >
            <Plus className="h-4 w-4" /> {t("common.add")}
          </Button>
        </div>
        {links.fields.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-4">
              {links.fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <span className="mb-2.5 shrink-0 text-muted-foreground">
                    <LinkIcon url={form.watch(`links.${index}.url`) ?? ""} />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_12rem]">
                    <div className="space-y-1.5">
                      <Label className="sr-only">{t("sessions.linkUrl")}</Label>
                      <Input
                        type="url"
                        inputMode="url"
                        placeholder={t("sessions.linkUrlPlaceholder")}
                        {...form.register(`links.${index}.url`)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="sr-only">{t("sessions.linkLabel")}</Label>
                      <Input
                        placeholder={t("sessions.linkLabelPlaceholder")}
                        {...form.register(`links.${index}.label`)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("common.remove")}
                    onClick={() => links.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {typeof errors.links?.message === "string" && (
                <p className="text-xs text-destructive">{t(errors.links.message)}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performances */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {t("sessions.performancesOptional")}{" "}
            <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ discipline: "sprint", distance: 100, event: null, result: 0, wind: null, lane: null, position: null, heat: null })
            }
          >
            <Plus className="h-4 w-4" /> {t("common.add")}
          </Button>
        </div>
        {typeof errors.performances?.message === "string" && (
          <p className="text-xs text-destructive">{t(errors.performances.message)}</p>
        )}

        {fields.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {t("sessions.noPerformancesHint")}
            </CardContent>
          </Card>
        ) : (
          fields.map((field, idx) => (
            <PerformanceRow
              key={field.id}
              index={idx}
              form={form}
              onRemove={() => remove(idx)}
              canRemove
            />
          ))
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto text-xs text-muted-foreground">{t("common.saveShortcut")}</span>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("common.saving") : sessionId ? t("sessions.updateSession") : t("sessions.createSession")}
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
          {/* Radix fills the trigger only after the items mount; naming the
              label here keeps the server render from showing an empty box. */}
          <SelectValue>{options.find((o) => o.value === value)?.label ?? "—"}</SelectValue>
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
  const { t, dict } = useI18n();
  const discipline = form.watch(`performances.${index}.discipline`);
  const isJump = discipline === "jump";
  const isThrow = discipline === "throw";
  const isRelay = discipline === "relay";
  const isCombined = discipline === "combined";
  const isTest = discipline === "test";
  const timed = isTimed(discipline);
  const eventOptions = eventOptionsFor(discipline, dict);
  const resultErr = form.formState.errors.performances?.[index]?.result;

  const resultLabel = isThrow
    ? t("sessions.resultM")
    : isJump || isTest
      ? t("sessions.resultCm")
      : isCombined
        ? t("sessions.resultPoints")
        : t("sessions.resultSeconds");

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>{t("common.discipline")}</Label>
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
              <SelectValue>
                {disciplineOptions(dict).find((o) => o.value === discipline)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {disciplineOptions(dict).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {eventOptions ? (
          <div className="space-y-1.5">
            <Label>{t("common.event")}</Label>
            <Select
              value={form.watch(`performances.${index}.event`) ?? ""}
              onValueChange={(v) => form.setValue(`performances.${index}.event`, v)}
            >
              <SelectTrigger>
                <SelectValue>
                  {eventOptions.find(
                    (o) => o.event === form.watch(`performances.${index}.event`),
                  )?.label}
                </SelectValue>
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
            <Label>{t("common.event")}</Label>
            <Input placeholder={t("events.proveMultiple")} {...form.register(`performances.${index}.event`)} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>{t("common.distance")} (m)</Label>
            <Input
              type="number"
              list={`distances-${index}`}
              placeholder={t("sessions.metres")}
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
          <Label>{t("common.result")} {resultLabel}</Label>
          <Input type="number" step="0.01" {...form.register(`performances.${index}.result`)} />
          {resultErr && <p className="text-xs text-destructive">{t(resultErr.message ?? "")}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>{t("common.wind")} (m/s)</Label>
          <Input type="number" step="0.1" placeholder={t("sessions.optionalShort")} {...form.register(`performances.${index}.wind`)} />
        </div>

        <div className="space-y-1.5">
          <Label>{t("common.lane")}</Label>
          <Input type="number" placeholder={t("sessions.optionalShort")} {...form.register(`performances.${index}.lane`)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("common.position")}</Label>
          <Input type="number" placeholder={t("sessions.optionalShort")} {...form.register(`performances.${index}.position`)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("common.heat")}</Label>
          <Input placeholder={t("sessions.finalExample")} {...form.register(`performances.${index}.heat`)} />
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
            <Trash2 className="h-4 w-4" /> {t("common.remove")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
