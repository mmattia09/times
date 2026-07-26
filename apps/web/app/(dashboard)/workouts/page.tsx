"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateUsage } from "@/components/workouts/template-usage";
import { WorkoutTable } from "@/components/workouts/workout-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { WorkoutTemplate } from "@/lib/db/schema";

export default function WorkoutsPage() {
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [toDelete, setToDelete] = useState<WorkoutTemplate | null>(null);

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

  const count = templates?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Schede"
        description={
          templates === null
            ? "La tua libreria di allenamenti."
            : `${count} ${count === 1 ? "scheda" : "schede"} in libreria, in ${byCategory.size} ${byCategory.size === 1 ? "categoria" : "categorie"}.`
        }
      >
        <Button asChild size="sm">
          <Link href="/workouts/new">
            <Plus className="h-4 w-4" /> Nuova
          </Link>
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
            <Button asChild size="sm">
              <Link href="/workouts/new">
                <Plus className="h-4 w-4" /> Nuova
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {[...byCategory.entries()].map(([category, list]) => (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold capitalize">
                {category} <span className="font-normal text-muted-foreground">· {list.length}</span>
              </h2>
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
                        <Button asChild variant="ghost" size="icon" aria-label="Modifica">
                          <Link href={`/workouts/${t.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Elimina"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <WorkoutTable blocks={t.blocks} />
                      <TemplateUsage templateId={t.id} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminare la scheda?"
        description={`"${toDelete?.name ?? ""}" verrà rimossa dalla libreria. Le sessioni a cui è già agganciata non cambiano.`}
        onConfirm={() => (toDelete ? remove(toDelete.id) : undefined)}
      />
    </>
  );
}
