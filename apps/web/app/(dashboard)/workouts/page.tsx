"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateEditorDialog } from "@/components/workouts/template-editor";
import { WorkoutTable } from "@/components/workouts/workout-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { WorkoutTemplate } from "@/lib/db/schema";

export default function WorkoutsPage() {
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/internal/templates");
    const json = await res.json();
    setTemplates(json.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/internal/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Eliminata", description: "Scheda eliminata." });
      load();
    }
  }

  const byCategory = new Map<string, WorkoutTemplate[]>();
  for (const t of templates ?? []) {
    const c = t.category ?? "altro";
    byCategory.set(c, [...(byCategory.get(c) ?? []), t]);
  }

  return (
    <>
      <PageHeader title="Schede" description="La tua libreria di allenamenti: blocchi, ripetute, recuperi e ritmi.">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nuova scheda
        </Button>
      </PageHeader>

      {templates === null ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nessuna scheda. Crea la prima: potrai agganciarla alle sessioni di allenamento.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nuova scheda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {[...byCategory.entries()].map(([category, list]) => (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold capitalize">{category}</h2>
              <div className="grid gap-4 xl:grid-cols-2">
                {list.map((t) => (
                  <Card key={t.id}>
                    <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                      <div>
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        {t.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="muted">{t.blocks.length} righe</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Modifica"
                          onClick={() => {
                            setEditing(t);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Elimina"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <WorkoutTable blocks={t.blocks} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editorOpen && (
        <TemplateEditorDialog
          key={editing?.id ?? "new"}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editing}
          onSaved={load}
        />
      )}
    </>
  );
}
