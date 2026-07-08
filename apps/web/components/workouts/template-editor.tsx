"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { WorkoutBlock, WorkoutTemplate } from "@/lib/db/schema";

const emptyBlock = (): WorkoutBlock => ({
  label: null,
  ripetute: "",
  recupero: null,
  pausa: null,
  ritmo: null,
  note: null,
});

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkoutTemplate | null; // null = create new
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(
    template?.blocks?.length ? template.blocks : [emptyBlock()],
  );
  const [saving, setSaving] = useState(false);

  function setBlock(i: number, field: keyof WorkoutBlock, value: string) {
    setBlocks((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, [field]: value === "" ? null : value } : b)),
    );
  }

  async function save() {
    const payload = {
      name,
      category: category || null,
      description: description || null,
      blocks: blocks
        .filter((b) => b.ripetute.trim() !== "" || b.label)
        .map((b) => ({ ...b, ripetute: b.ripetute.trim() || "—" })),
    };
    if (!name.trim() || payload.blocks.length === 0) {
      toast({ variant: "destructive", title: "Dati mancanti", description: "Servono un nome e almeno un blocco." });
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
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Modifica scheda" : "Nuova scheda"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. piramidale corto" />
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
              placeholder="es. tutto chiodate, ritmo proporzionato al personale dei 400m"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Blocchi</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setBlocks((b) => [...b, emptyBlock()])}>
              <Plus className="h-4 w-4" /> Riga
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <div className="grid min-w-[640px] grid-cols-[70px_1fr_90px_70px_90px_1fr_32px] gap-px bg-border text-xs">
              {["Blocco", "Ripetute", "Recupero", "Pausa", "Ritmo", "Note", ""].map((h) => (
                <div key={h} className="bg-muted px-2 py-1.5 font-medium text-muted-foreground">
                  {h}
                </div>
              ))}
              {blocks.map((b, i) => (
                <BlockRow key={i} block={b} onChange={(f, v) => setBlock(i, f, v)} onRemove={() => setBlocks((prev) => prev.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Testo libero, come sulle tue tabelle: &quot;4 x 60m&quot;, &quot;passo&quot;, &quot;2&apos; 30&quot;&quot;, &quot;max&quot;…
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvataggio…" : "Salva scheda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockRow({
  block,
  onChange,
  onRemove,
}: {
  block: WorkoutBlock;
  onChange: (field: keyof WorkoutBlock, value: string) => void;
  onRemove: () => void;
}) {
  const cell = "bg-background";
  const input = "h-8 rounded-none border-0 px-2 text-xs shadow-none focus-visible:ring-1";
  return (
    <>
      <div className={cell}>
        <Input className={input} value={block.label ?? ""} onChange={(e) => onChange("label", e.target.value)} placeholder="1" />
      </div>
      <div className={cell}>
        <Input className={input} value={block.ripetute} onChange={(e) => onChange("ripetute", e.target.value)} placeholder="4 x 60m" />
      </div>
      <div className={cell}>
        <Input className={input} value={block.recupero ?? ""} onChange={(e) => onChange("recupero", e.target.value)} placeholder="2' 30&quot;" />
      </div>
      <div className={cell}>
        <Input className={input} value={block.pausa ?? ""} onChange={(e) => onChange("pausa", e.target.value)} placeholder="4'" />
      </div>
      <div className={cell}>
        <Input className={input} value={block.ritmo ?? ""} onChange={(e) => onChange("ritmo", e.target.value)} placeholder="85%" />
      </div>
      <div className={cell}>
        <Input className={input} value={block.note ?? ""} onChange={(e) => onChange("note", e.target.value)} placeholder="chiodate" />
      </div>
      <div className={`${cell} flex items-center justify-center`}>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Rimuovi riga">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}
