"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useSubmitShortcut } from "@/hooks/use-submit-shortcut";
import type { WorkoutBlock, WorkoutTemplate } from "@/lib/db/schema";
import { useI18n } from "@/lib/i18n/client";

const COLUMNS: { field: keyof WorkoutBlock; labelKey: string; placeholder: string; width: string }[] = [
  { field: "label", labelKey: "workouts.blockCol", placeholder: "1", width: "minmax(64px,0.6fr)" },
  { field: "ripetute", labelKey: "workouts.repsCol", placeholder: "4 x 60m", width: "minmax(110px,1.2fr)" },
  { field: "recupero", labelKey: "workouts.recoveryCol", placeholder: "2' 30\"", width: "minmax(84px,0.8fr)" },
  { field: "pausa", labelKey: "workouts.pauseCol", placeholder: "4'", width: "minmax(64px,0.6fr)" },
  { field: "ritmo", labelKey: "workouts.paceCol", placeholder: "85%", width: "minmax(72px,0.7fr)" },
  { field: "note", labelKey: "workouts.notesCol", placeholder: "", width: "minmax(120px,1.4fr)" },
];
const GRID = { gridTemplateColumns: `${COLUMNS.map((c) => c.width).join(" ")} 36px` };

const emptyBlock = (): WorkoutBlock => ({
  label: null,
  ripetute: "",
  recupero: null,
  pausa: null,
  ritmo: null,
  note: null,
});

export function TemplateForm({ template }: { template?: WorkoutTemplate }) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(
    template?.blocks?.length ? template.blocks : [emptyBlock()],
  );
  const [saving, setSaving] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<{ row: number; col: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useSubmitShortcut(save);

  // Focus after React has committed the (possibly new) row.
  useEffect(() => {
    if (!pendingFocus) return;
    gridRef.current
      ?.querySelector<HTMLInputElement>(
        `[data-row="${pendingFocus.row}"][data-col="${pendingFocus.col}"]`,
      )
      ?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  function setBlock(i: number, field: keyof WorkoutBlock, value: string) {
    setBlocks((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, [field]: value === "" ? null : value } : b)),
    );
  }

  function focusCell(row: number, col: number) {
    setPendingFocus({ row, col });
  }

  function addRow(afterIndex?: number) {
    const at = afterIndex != null ? afterIndex + 1 : blocks.length;
    setBlocks((prev) => [...prev.slice(0, at), emptyBlock(), ...prev.slice(at)]);
    focusCell(at, 1); // ripetute of the new row
  }

  /** Enter → next row, adding one at the end. Saving is the document shortcut. */
  function onGridKeyDown(e: React.KeyboardEvent) {
    // ⌘/Ctrl+Enter belongs to useSubmitShortcut; handling it here too would save twice.
    if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const target = e.target as HTMLElement;
    const row = Number(target.dataset.row ?? "-1");
    const col = Number(target.dataset.col ?? "0");
    if (row < 0) return;
    if (row === blocks.length - 1) addRow(row);
    else focusCell(row + 1, col);
  }

  async function save() {
    const payload = {
      name,
      category: category || null,
      description: description || null,
      blocks: blocks.filter((b) => b.ripetute.trim() !== "" || b.label),
    };
    if (!name.trim()) {
      toast({ variant: "destructive", title: t("workouts.nameMissing"), description: t("workouts.nameMissingDescription") });
      return;
    }
    if (payload.blocks.length === 0) {
      toast({ variant: "destructive", title: t("workouts.emptyWorkout"), description: t("workouts.emptyWorkoutDescription") });
      return;
    }
    setSaving(true);
    const res = await fetch(
      template ? `/api/internal/templates/${template.id}` : "/api/internal/templates",
      {
        method: template ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.saveFailed") });
      return;
    }
    toast({ title: t("common.saved"), description: t("workouts.savedOk") });
    router.push("/workouts");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-6"
    >
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{t("workouts.info")}</h2>
        <Card>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">{t("workouts.name")}</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("workouts.namePlaceholder")}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat">{t("workouts.category")}</Label>
              <Input
                id="tpl-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t("workouts.categoryPlaceholder")}
                list="tpl-categories"
              />
              <datalist id="tpl-categories">
                {t("workouts.categorySuggestions")
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tpl-desc">{t("workouts.description")}</Label>
              <Textarea
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("workouts.descriptionPlaceholder")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("workouts.blocks")}</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
            <Plus className="h-4 w-4" /> {t("workouts.row")}
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div ref={gridRef} onKeyDown={onGridKeyDown} className="min-w-[680px]">
                <div className="grid border-b bg-muted/40" style={GRID}>
                  {COLUMNS.map((c) => (
                    <div key={c.field} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      {t(c.labelKey)}
                    </div>
                  ))}
                  <div />
                </div>
                {blocks.map((b, row) => (
                  <div key={row} className="grid border-b last:border-0" style={GRID}>
                    {COLUMNS.map((c, col) => (
                      <Input
                        key={c.field}
                        data-row={row}
                        data-col={col}
                        value={(b[c.field] as string | null) ?? ""}
                        onChange={(e) => setBlock(row, c.field, e.target.value)}
                        placeholder={row === 0 ? c.placeholder : ""}
                        className="h-9 rounded-none border-0 px-3 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-inset"
                      />
                    ))}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setBlocks((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== row) : prev))}
                      className="flex items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`${t("common.remove")} ${row + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          {t("workouts.keyboardHint")}
        </p>
      </div>

      {/* Pinned, like the session form: a workout with a dozen blocks is longer
          than the screen, and saving shouldn't mean scrolling to the end. */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-6 md:px-6">
        <Button type="button" variant="ghost" onClick={() => router.push("/workouts")}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={saving} className="flex-1 md:flex-none">
          {saving ? t("common.saving") : template ? t("workouts.updateWorkout") : t("workouts.createWorkout")}
        </Button>
      </div>
    </form>
  );
}
