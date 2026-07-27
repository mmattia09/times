"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-lg font-semibold">{t("errors.somethingWrong")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t("errors.pageError")}</p>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </div>
  );
}
