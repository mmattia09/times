"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { TemplateUsage } from "@/components/workouts/template-usage";
import { WorkoutTable } from "@/components/workouts/workout-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";
import type { TemplateWithUsage } from "@/lib/workouts";

/**
 * The library, drawn from data the page already has.
 *
 * Only the parts that need a browser are here: deleting, and expanding a
 * workout's session list. Everything visible arrives with the page, so nothing
 * appears a moment after everything else.
 */
export function WorkoutsLibrary({ templates }: { templates: TemplateWithUsage[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [toDelete, setToDelete] = useState<TemplateWithUsage | null>(null);

  async function remove(id: string) {
    const res = await fetch(`/api/internal/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: t("common.deleted"), description: t("workouts.deletedOk") });
      router.refresh();
    }
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("workouts.empty")}</p>
          <Button asChild size="sm">
            <Link href="/workouts/new">
              <Plus className="h-4 w-4" /> {t("common.new")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const byCategory = new Map<string, TemplateWithUsage[]>();
  for (const tpl of templates) {
    const c = tpl.category ?? "altro";
    byCategory.set(c, [...(byCategory.get(c) ?? []), tpl]);
  }

  return (
    <>
      <div className="space-y-8">
        {[...byCategory.entries()].map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold capitalize">
              {category} <span className="font-normal text-muted-foreground">· {list.length}</span>
            </h2>
            {/* Columns, not a grid. A grid gives every card in a row the height
                of the tallest one, so a four-row workout next to a seven-row one
                left a hole underneath it before the next card could start. CSS
                columns fill downwards and pack tight; the order reads down each
                column instead of across, which for a library sorted by name is
                no loss. */}
            <div className="columns-1 gap-4 xl:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
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
                    <TemplateUsage usage={tpl.usage} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

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
