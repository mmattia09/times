import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ApiKeysManager } from "@/components/settings/api-keys-manager";
import { PasswordChange } from "@/components/settings/password-change";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import { seasonLabel } from "@/lib/season";

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);
  const startMonth = settings?.seasonStartMonth ?? 10;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Impostazioni" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profilo</CardTitle>
          <CardDescription>I tuoi dati di accesso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input defaultValue={user.name ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue={user.email} disabled />
            </div>
          </div>
          <PasswordChange />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrazione FIDAL</CardTitle>
          <CardDescription>Importa automaticamente le gare dal tuo profilo FIDAL.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/fidal"
            className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-secondary/40"
          >
            <span>
              {settings?.fidalUrl ? (
                <span className="text-muted-foreground">{settings.fidalUrl}</span>
              ) : (
                "Configura l'integrazione FIDAL"
              )}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stagione & aspetto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            La stagione corrente è <strong className="text-foreground">{seasonLabel(new Date().getUTCMonth() + 1 >= startMonth ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1)}</strong>{" "}
            (inizio: mese {startMonth}, ottobre).
          </p>
          <p>Il tema chiaro/scuro/sistema si cambia dall&apos;icona in alto a destra ed è memorizzato nel browser.</p>
        </CardContent>
      </Card>
    </div>
  );
}
