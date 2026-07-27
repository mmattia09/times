import { WifiOff } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Offline" };

export default async function OfflinePage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
        <WifiOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{t("errors.offline")}</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("errors.offlineDescription")}
        </p>
      </div>
    </div>
  );
}
