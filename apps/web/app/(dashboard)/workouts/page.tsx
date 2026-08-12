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
import { useI18n } from "@/lib/i18n/client";

export default function WorkoutsPage() {
  const { t } = useI18n();
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
      toast({ title: t("common.deleted"), description: t("workouts.deletedOk") });
      load();
    }
  }

  const byCategory = new Map<string, WorkoutTemplate[]>();
  for (const tpl of templates ?? []) {
    const c = tpl.category ?? "altro";
    byCategory.set(c, [...(byCategory.get(c) ?? []), tpl]);
  }

  const count = templates?.length ?? 0;

  return (
    <>
      <PageHeader
        title={t("workouts.title")}
        description={
          templates === null
            ? t("workouts.libraryEmptyDescription")
            : t("workouts.summary", {
                count,
                schede: count === 1 ? t("workouts.schedaOne") : t("workouts.schedaMany"),
                categories: byCategory.size,
                categorie: byCategory.size === 1 ? t("workouts.categoryOne") : t("workouts.categoryMany"),
              })
        }
      >
        <Button asChild size="sm">
          <Link href="/workouts/new">
            <Plus className="h-4 w-4" /> {t("common.new")}
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
              {t("workouts.empty")}
            </p>
            <Button asChild size="sm">
              <Link href="/workouts/new">
                <Plus className="h-4 w-4" /> {t("common.new")}
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
              {/* items-start: grid rows stretch by default, so a four-row
                  workout was drawn as tall as the six-row one beside it. */}
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {list.map((tpl) => (
                  <Card key={tpl.id}>
                    <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{tpl.name}</CardTitle>
                        {tpl.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="muted">{t("workouts.rows", { count: tpl.blocks.length })}</Badge>
                        <Button asChild variant="ghost" size="icon" aria-label={t("common.edit")}>
                          <Link href={`/workouts/${tpl.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.delete")}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(tpl)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <WorkoutTable blocks={tpl.blocks} />
                      <TemplateUsage templateId={tpl.id} />
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
        title={t("workouts.deleteTitle")}
        description={t("workouts.deleteDescription", { name: toDelete?.name ?? "" })}
        onConfirm={() => (toDelete ? remove(toDelete.id) : undefined)}
      />
    </>
  );
}
