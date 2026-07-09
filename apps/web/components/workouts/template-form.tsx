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
import type { WorkoutBlock, WorkoutTemplate } from "@/lib/db/schema";

const COLUMNS: { field: keyof WorkoutBlock; label: string; placeholder: string; width: string }[] = [
  { field: "label", label: "Blocco", placeholder: "1", width: "minmax(64px,0.6fr)" },
  { field: "ripetute", label: "Ripetute", placeholder: "4 x 60m", width: "minmax(110px,1.2fr)" },
  { field: "recupero", label: "Recupero", placeholder: "2' 30\"", width: "minmax(84px,0.8fr)" },
  { field: "pausa", label: "Pausa", placeholder: "4'", width: "minmax(64px,0.6fr)" },
  { field: "ritmo", label: "Ritmo", placeholder: "85%", width: "minmax(72px,0.7fr)" },
  { field: "note", label: "Note", placeholder: "chiodate", width: "minmax(120px,1.4fr)" },
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
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(
    template?.blocks?.length ? template.blocks : [emptyBlock()],
  );
  const [saving, setSaving] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<{ row: number; col: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  /** Enter → next row (adding one at the end); ⌘/Ctrl+Enter → save. */
  function onGridKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {
      save();
      return;
    }
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
      toast({ variant: "destructive", title: "Nome mancante", description: "Dai un nome alla scheda." });
      return;
    }
    if (payload.blocks.length === 0) {
      toast({ variant: "destructive", title: "Scheda vuota", description: "Aggiungi almeno un blocco." });
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
      toast({ variant: "destructive", title: "Errore", description: "Salvataggio non riuscito." });
      return;
    }
    toast({ title: "Salvata", description: "Scheda salvata." });
    router.push("/workouts");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        // ⌘/Ctrl+Enter saves from anywhere in the form.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          save();
        }
      }}
      className="space-y-6"
    >
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Informazioni</h2>
        <Card>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. piramidale corto"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat">Categoria</Label>
              <Input
                id="tpl-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="velocità, tecnica, resistenza…"
                list="tpl-categories"
              />
              <datalist id="tpl-categories">
                {["velocità", "velocità corta", "tecnica", "partenza dai blocchi", "resistenza", "per i 200m"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tpl-desc">Descrizione</Label>
              <Textarea
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="note generali sulla scheda (opzionale)"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Blocchi</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
            <Plus className="h-4 w-4" /> Riga
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div ref={gridRef} onKeyDown={onGridKeyDown} className="min-w-[680px]">
                <div className="grid border-b bg-muted/40" style={GRID}>
                  {COLUMNS.map((c) => (
                    <div key={c.field} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      {c.label}
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
                      aria-label={`Rimuovi riga ${row + 1}`}
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
          Invio: riga successiva (o nuova riga in fondo) · ⌘Invio: salva
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/workouts")}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : template ? "Aggiorna scheda" : "Crea scheda"}
        </Button>
      </div>
    </form>
  );
}
