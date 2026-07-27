"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { eventKey, eventLabel, formatResult, lowerIsBetter, resultUnit, type EventKey } from "@/lib/athletics";
import type { Goal } from "@/lib/db/schema";
import { useI18n } from "@/lib/i18n/client";

export type PbSummary = EventKey & { keyStr: string; label: string; result: number };

export function GoalsCard({ pbs }: { pbs: PbSummary[] }) {
  const { t, dict } = useI18n();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/internal/goals");
    const json = await res.json();
    setGoals(json.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/internal/goals/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> {t("records.goals")}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("records.goalButton")}
        </Button>
      </CardHeader>
      <CardContent>
        {goals === null ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("records.noGoals")}
          </p>
        ) : (
          <ul className="divide-y">
            {goals.map((g) => {
              const ek: EventKey = { discipline: g.discipline, distance: g.distance, event: g.event };
              const pb = pbs.find((p) => p.keyStr === eventKey(ek));
              const target = Number(g.target);
              const lower = lowerIsBetter(g.discipline);
              const achieved = pb != null && (lower ? pb.result <= target : pb.result >= target);
              const gap = pb != null ? (lower ? pb.result - target : target - pb.result) : null;
              // Progress from the PB toward the target, as share of the remaining gap
              // vs a 5% budget of the target — simple, monotone, honest enough for a meter.
              const pct =
                pb == null ? 0 : achieved ? 100 : Math.max(0, Math.min(96, 100 - (gap! / (target * 0.05)) * 100));
              return (
                <li key={g.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{eventLabel(ek, dict)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {pb ? formatResult(pb.result, ek) : "—"} → <span className="font-medium text-foreground">{formatResult(target, ek)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    {g.note && <p className="mt-1 text-xs text-muted-foreground">{g.note}</p>}
                  </div>
                  <div className="flex w-28 shrink-0 items-center justify-end gap-1">
                    {achieved ? (
                      <Badge variant="success">{t("records.achieved")}</Badge>
                    ) : gap != null ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatGap(gap, ek, t)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("records.noPb")}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setToDelete(g)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t("records.deleteGoalAria")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {open && <AddGoalDialog open={open} onOpenChange={setOpen} pbs={pbs} onSaved={load} />}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("records.deleteGoalTitle")}
        description={
          toDelete
            ? t("records.deleteGoalDescription", { event: eventLabel({ discipline: toDelete.discipline, distance: toDelete.distance, event: toDelete.event }, dict) })
            : ""
        }
        onConfirm={() => (toDelete ? remove(toDelete.id) : undefined)}
      />
    </Card>
  );
}

function formatGap(gap: number, ek: EventKey, t: (k: string, v?: Record<string, string | number>) => string): string {
  const unit = resultUnit(ek);
  if (unit === "s" || unit === "min") return t("records.missing", { gap: gap.toFixed(2) });
  if (unit === "cm") return t("records.missingPlural", { gap: `${gap.toFixed(0)} cm` });
  if (unit === "pts") return t("records.missingPlural", { gap: `${gap.toFixed(0)} pti` });
  return t("records.missingPlural", { gap: `${gap.toFixed(2)} m` });
}

function AddGoalDialog({
  open,
  onOpenChange,
  pbs,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pbs: PbSummary[];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(pbs[0]?.keyStr ?? "");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const ek = pbs.find((p) => p.keyStr === selected);

  async function save() {
    if (!ek || !target) return;
    setSaving(true);
    const res = await fetch("/api/internal/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discipline: ek.discipline,
        distance: ek.distance,
        event: ek.event,
        target: Number(target.replace(",", ".")),
        note: note || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.saveFailed") });
      return;
    }
    toast({ title: t("records.goalAdded") });
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("records.newGoal")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.event")}</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.loading")} />
              </SelectTrigger>
              <SelectContent>
                {pbs.map((p) => (
                  <SelectItem key={p.keyStr} value={p.keyStr}>
                    {p.label} — {t("records.pbWith", { result: formatResult(p.result, p) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">
              {t("records.goalTarget")} {ek ? `(${resultUnit(ek)})` : ""}
            </Label>
            <Input
              id="goal-target"
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={ek && lowerIsBetter(ek.discipline) ? "es. 11.80" : "es. 560"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-note">{t("records.goalNote")}</Label>
            <Input id="goal-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("records.goalNotePlaceholder")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving || !target || !ek}>
            {saving ? t("common.saving") : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
