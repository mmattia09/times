"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ListPlus, Plus, Trash2 } from "lucide-react";
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
import { useSubmitShortcut } from "@/hooks/use-submit-shortcut";
import { enqueue, isOffline } from "@/lib/offline-queue";
import { disciplineForDistance, repsFromWorkout } from "@/lib/quick-entry";
import { cn } from "@/lib/utils";
import type { WorkoutTemplate } from "@/lib/db/schema";
import {
  RUN_DISTANCES,
  disciplineOptions,
  eventLabel,
  eventOptionsFor,
  formatResult,
  isTimed,
  isWindAffected,
} from "@/lib/athletics";
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
    /**
     * Rows with no time are dropped, not rejected.
     *
     * The quick table lays out every rep of the workout, and you time some of
     * them — being made to delete the ones you didn't is the friction the table
     * exists to remove. The schema stays strict for the API, where an explicit
     * result that isn't a number really is an error; here the empty ones simply
     * never reach it.
     */
    resolver: (values, context, options) =>
      zodResolver(sessionInputCheckedSchema)(
        {
          ...values,
          performances: (values.performances ?? []).filter(
            (p) => `${p?.result ?? ""}`.trim() !== "",
          ),
        },
        context,
        options,
      ),
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

  /**
   * A blank row, not a guess.
   *
   * It used to arrive as 100m with a result of 0, which reads as data you have
   * to correct rather than fields you have to fill — and a "0" in the result
   * box is a mark nobody ran. Empty is coerced to 0 on submit and fails the
   * positive-number rule, which is exactly the error the person should see.
   */
  const blankPerformance = (distance: number | null = null) => ({
    discipline: distance ? disciplineForDistance(distance) : ("sprint" as const),
    distance,
    event: null,
    result: "" as unknown as number,
    wind: null,
    lane: null,
    position: null,
    heat: null,
  });

  const addPerformance = () => append(blankPerformance());

  // The reps of the attached workout, as distances waiting for a time.
  const workoutReps = useMemo(() => repsFromWorkout(workout?.blocks), [workout]);

  const fillFromWorkout = () => {
    for (const metres of workoutReps) append(blankPerformance(metres));
    setEntryMode("quick");
  };

  /**
   * Quick is the default because most sessions are a column of distances and a
   * column of times. A session that already carries a lane, a place, a heat or
   * a field event opens detailed instead — editing must never hide what is
   * already there behind a simpler view.
   */
  const [entryMode, setEntryMode] = useState<"quick" | "detailed">(() => {
    const initialPerfs = initial?.performances ?? [];
    const needsDetail = initialPerfs.some(
      (p) =>
        p.lane != null ||
        p.position != null ||
        !!p.heat ||
        p.wind != null ||
        !isTimed(p.discipline as Discipline),
    );
    return needsDetail ? "detailed" : "quick";
  });

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
      // No network: keep it on the device and send it later. A change is a PUT
      // that replaces the whole session, so it can wait exactly like a new one.
      if (isOffline(err)) {
        enqueue(values, sessionId ?? null);
        toast({ title: t("offline.queued"), description: t("offline.queuedDescription") });
        router.push(sessionId ? `/sessions/${sessionId}` : "/sessions");
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

  useSubmitShortcut(() => void form.handleSubmit(onSubmit)());

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        // Enter on its own inside a field must not submit a half-filled form.
        // ⌘/Ctrl+Enter is handled on the document — see useSubmitShortcut.
        if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
        if ((e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
      className="space-y-6"
    >
      <div className="space-y-3">
      <h2 className="text-sm font-semibold">{t("sessions.details")}</h2>
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:gap-5 sm:p-5">
          {/* Type toggle */}
          {/* Full-width on a phone: this is the first choice you make, and two
              half-screen targets beat two small ones next to a label. */}
          <div className="col-span-2 space-y-1.5 sm:flex sm:items-center sm:gap-4 sm:space-y-0">
            <Label>{t("common.type")}</Label>
            <div className="grid grid-cols-2 rounded-md border p-0.5 sm:inline-flex">
              {(["training", "competition"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => form.setValue("type", option)}
                  className={cn(
                    "rounded px-4 py-2 text-sm font-medium transition-colors sm:py-1.5",
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

          <EnumSelect
            label={t("common.environment")}
            value={form.watch("tipo")}
            onChange={(v) => form.setValue("tipo", v as FormValues["tipo"])}
            options={[
              { value: "outdoor", label: t("enums.tipo.outdoor") },
              { value: "indoor", label: t("enums.tipo.indoor") },
            ]}
          />

          <div className="col-span-2 space-y-1.5">
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

          <div className="col-span-2 space-y-1.5">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t("sessions.performancesOptional")}{" "}
            <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Two ways in, because there are two situations. A track session is
                a column of distances and a column of times and nothing else; a
                race has lanes, heats and wind. */}
            <div className="inline-flex rounded-md border p-0.5 text-xs">
              {(["quick", "detailed"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEntryMode(option)}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors",
                    entryMode === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {option === "quick" ? t("sessions.quickEntry") : t("sessions.detailedEntry")}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPerformance}>
              <Plus className="h-4 w-4" /> {t("common.add")}
            </Button>
          </div>
        </div>
        {typeof errors.performances?.message === "string" && (
          <p className="text-xs text-destructive">{t(errors.performances.message)}</p>
        )}

        {workoutReps.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={fillFromWorkout}>
            <ListPlus className="h-4 w-4" />
            {t("sessions.fillFromWorkout", { count: workoutReps.length })}
          </Button>
        )}

        {fields.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {t("sessions.noPerformancesHint")}
            </CardContent>
          </Card>
        ) : entryMode === "quick" ? (
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-[1fr_1fr_2.25rem] items-center gap-2 pb-1">
                <Label className="text-xs text-muted-foreground">
                  {t("common.distance")} (m)
                </Label>
                <Label className="text-xs text-muted-foreground">{t("sessions.timeSeconds")}</Label>
                <span />
              </div>
              <ul className="space-y-2">
                {fields.map((field, idx) => (
                  <li key={field.id} className="grid grid-cols-[1fr_1fr_2.25rem] items-center gap-2">
                    <QuickDistance index={idx} form={form} />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder={t("sessions.timeSecondsShort")}
                      aria-label={t("sessions.timeSeconds")}
                      {...form.register(`performances.${idx}.result`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(idx)}
                      aria-label={t("common.remove")}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={addPerformance}
              >
                <Plus className="h-4 w-4" /> {t("sessions.addResult")}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{t("sessions.quickEntryHint")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {fields.map((field, idx) => (
              <PerformanceRow
                key={field.id}
                index={idx}
                form={form}
                onRemove={() => remove(idx)}
                canRemove
                sessionType={type}
              />
            ))}
            {/* Also here: after filling one result you are at the bottom of the
                list, and scrolling back up to the heading to add the next one
                is the whole reason logging a race felt tedious. */}
            <Button type="button" variant="outline" className="w-full" onClick={addPerformance}>
              <Plus className="h-4 w-4" /> {t("sessions.addResult")}
            </Button>
          </>
        )}
      </div>

      {/* Pinned above the tab bar on a phone: with three results the form is
          several screens long, and the save button was at the far end of it. */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <span className="mr-auto hidden text-xs text-muted-foreground md:inline">
          {t("common.saveShortcut")}
        </span>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1 md:flex-none">
          {submitting ? t("common.saving") : sessionId ? t("sessions.updateSession") : t("sessions.createSession")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The distance cell of the quick table.
 *
 * It also decides the discipline, because the person typing is entering "400"
 * or "800" and thinking "a run" — but 800m is middle distance and 400m is a
 * sprint, and the personal-best key is per discipline. Getting that wrong here
 * would file the mark under the wrong event and never show it as a record.
 */
function QuickDistance({
  index,
  form,
}: {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const { t } = useI18n();
  const registration = form.register(`performances.${index}.distance`);
  return (
    <>
      <Input
        type="number"
        inputMode="numeric"
        list={`quick-distances-${index}`}
        placeholder={t("sessions.metres")}
        aria-label={t("common.distance")}
        {...registration}
        onChange={(e) => {
          void registration.onChange(e);
          const metres = Number(e.target.value);
          if (metres > 0) {
            form.setValue(`performances.${index}.discipline`, disciplineForDistance(metres));
          }
        }}
      />
      <datalist id={`quick-distances-${index}`}>
        {RUN_DISTANCES.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </>
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

/**
 * One result inside a session.
 *
 * On a phone this is where the form used to fall apart: eight stacked
 * full-width fields per result, three results to a race, and nothing to tell
 * one card from the next — you scrolled through twenty-four identical boxes.
 *
 * So the card leads with what it *is* (an index and a live summary of the
 * event and mark), keeps the three fields that always matter, and folds the
 * placings away. Wind appears only for events where wind is measured at all,
 * which is most of the decluttering on its own.
 */
function PerformanceRow({
  index,
  form,
  onRemove,
  canRemove,
  sessionType,
}: {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
  onRemove: () => void;
  canRemove: boolean;
  sessionType: FormValues["type"];
}) {
  const { t, dict } = useI18n();
  const discipline = form.watch(`performances.${index}.discipline`);
  const distance = form.watch(`performances.${index}.distance`);
  const event = form.watch(`performances.${index}.event`);
  const result = form.watch(`performances.${index}.result`);
  const isJump = discipline === "jump";
  const isThrow = discipline === "throw";
  const isCombined = discipline === "combined";
  const isTest = discipline === "test";
  const eventOptions = eventOptionsFor(discipline, dict);
  const resultErr = form.formState.errors.performances?.[index]?.result;

  const ek = { discipline, distance: distance ?? null, event: event ?? null };
  const windMatters = isWindAffected(ek);

  // Placings belong to a race. Open them when this is one, or when something
  // is already in there — editing a session must never hide its own data.
  const hasPlacing =
    form.watch(`performances.${index}.lane`) != null ||
    form.watch(`performances.${index}.position`) != null ||
    !!form.watch(`performances.${index}.heat`);
  const [showPlacing, setShowPlacing] = useState(sessionType === "competition" || hasPlacing);

  const resultLabel = isThrow
    ? t("sessions.resultM")
    : isJump || isTest
      ? t("sessions.resultCm")
      : isCombined
        ? t("sessions.resultPoints")
        : t("sessions.resultSeconds");

  // The card's own title: what you'd call this result out loud. A row that has
  // neither a distance nor an event has no name yet — eventLabel answers "—"
  // for that, which as a heading reads like something went wrong.
  const named = distance != null || !!event;
  const marked = Number(result) > 0;
  const summary = [named ? eventLabel(ek, dict) : null, marked ? formatResult(Number(result), ek) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2 border-b pb-3">
          <p className="min-w-0 truncate text-sm font-medium">
            <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
            {summary || t("sessions.newResult")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={t("common.remove")}
            className="-my-1 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Two across even on a phone: these fields are short, and one per row
            turned a three-result race into several screens of scrolling. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
                value={event ?? ""}
                onValueChange={(v) => form.setValue(`performances.${index}.event`, v)}
              >
                <SelectTrigger>
                  <SelectValue>{eventOptions.find((o) => o.event === event)?.label}</SelectValue>
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
                inputMode="numeric"
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

          <div className={cn("space-y-1.5", !windMatters && "col-span-2")}>
            <Label>
              {t("common.result")} {resultLabel}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              {...form.register(`performances.${index}.result`)}
            />
            {resultErr && <p className="text-xs text-destructive">{t(resultErr.message ?? "")}</p>}
          </div>

          {windMatters && (
            <div className="space-y-1.5">
              <Label>{t("common.wind")} (m/s)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder={t("sessions.optionalShort")}
                {...form.register(`performances.${index}.wind`)}
              />
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowPlacing((v) => !v)}
            aria-expanded={showPlacing}
            className="-my-1 flex items-center gap-1 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPlacing && "rotate-180")} />
            {t("sessions.placingFields")}
          </button>
          {showPlacing && (
            <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{t("common.lane")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={t("sessions.optionalShort")}
                  {...form.register(`performances.${index}.lane`)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.position")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={t("sessions.optionalShort")}
                  {...form.register(`performances.${index}.position`)}
                />
              </div>
              <div className="col-span-2 space-y-1.5 lg:col-span-2">
                <Label>{t("common.heat")}</Label>
                <Input placeholder={t("sessions.finalExample")} {...form.register(`performances.${index}.heat`)} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
