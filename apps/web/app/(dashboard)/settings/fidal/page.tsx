import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FidalSettings } from "@/components/settings/fidal-settings";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";

export default async function FidalSettingsPage() {
  const user = await requireUser();
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <PageHeader
        title="Integrazione FIDAL"
        description="Recupera le gare ufficiali dal tuo profilo FIDAL e importale senza duplicati."
      />
      <Card>
        <CardContent className="p-5">
          <FidalSettings
            initialUrl={settings?.fidalUrl ?? ""}
            lastSyncAt={settings?.lastFidalSyncAt ? settings.lastFidalSyncAt.toISOString() : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
