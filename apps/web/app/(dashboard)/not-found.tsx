import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-lg font-semibold">{t("errors.notFound")}</h2>
      <p className="text-sm text-muted-foreground">{t("errors.notFoundDescription")}</p>
      <Button asChild>
        <Link href="/dashboard">{t("errors.backToDashboard")}</Link>
      </Button>
    </div>
  );
}
