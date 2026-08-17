import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { WorkoutsLibrary } from "@/components/workouts/workouts-library";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/current-user";
import { listTemplatesWithUsage } from "@/lib/workouts";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("workouts.title") };
}

/**
 * Rendered on the server, whole.
 *
 * This page used to fetch its own data from the browser — the list, and then
 * one request per workout for "done N times" — so it arrived blank, filled in,
 * and then filled in again. Now the two queries run here and the page is
 * complete the moment it appears.
 */
export default async function WorkoutsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const templates = await listTemplatesWithUsage(user.id);

  const categories = new Set(templates.map((tpl) => tpl.category ?? "altro"));
  const count = templates.length;

  return (
    <>
      <PageHeader
        title={t("workouts.title")}
        description={
          count === 0
            ? t("workouts.libraryEmptyDescription")
            : t("workouts.summary", {
                count,
                schede: count === 1 ? t("workouts.schedaOne") : t("workouts.schedaMany"),
                categories: categories.size,
                categorie:
                  categories.size === 1 ? t("workouts.categoryOne") : t("workouts.categoryMany"),
              })
        }
      >
        <Button asChild size="sm">
          <Link href="/workouts/new">
            <Plus className="h-4 w-4" /> {t("common.new")}
          </Link>
        </Button>
      </PageHeader>

      <WorkoutsLibrary templates={templates} />
    </>
  );
}
