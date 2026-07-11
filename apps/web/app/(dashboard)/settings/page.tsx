import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { ApiKeysManager } from "@/components/settings/api-keys-manager";
import { DataTransferCard } from "@/components/settings/data-transfer-card";
import { FidalSettings } from "@/components/settings/fidal-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";


export const metadata = { title: "Impostazioni" };
export default async function SettingsPage() {
  const user = await requireUser();
  const [[settings], [row]] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1),
    db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, user.id)).limit(1),
  ]);
  const isAdmin = row?.isAdmin ?? false;

  return (
    <>
      <PageHeader title="Impostazioni" />

      {/* Two independent columns so short cards pack together without gaps. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profilo</CardTitle>
            <CardDescription>I tuoi dati di accesso.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSettings
              initialName={user.name ?? ""}
              initialEmail={user.email}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chiavi API</CardTitle>
            <CardDescription>
              Per l&apos;accesso programmatico a <code>/api/v1</code>. Usa l&apos;header{" "}
              <code>Authorization: Bearer &lt;chiave&gt;</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeysManager />
          </CardContent>
        </Card>
        </div>

        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integrazione FIDAL</CardTitle>
            <CardDescription>Importa automaticamente le gare dal tuo profilo FIDAL.</CardDescription>
          </CardHeader>
          <CardContent>
            <FidalSettings
              initialUrl={settings?.fidalUrl ?? ""}
              lastSyncAt={settings?.lastFidalSyncAt ? settings.lastFidalSyncAt.toISOString() : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dati</CardTitle>
            <CardDescription>
              Esporta o importa tutti i tuoi dati. Cambiare istanza è: esporta → registrati → importa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTransferCard />
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
