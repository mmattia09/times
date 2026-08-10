import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { ApiKeysManager } from "@/components/settings/api-keys-manager";
import { DataTransferCard } from "@/components/settings/data-transfer-card";
import { FidalSettings } from "@/components/settings/fidal-settings";
import { LanguageSwitcher } from "@/components/settings/language-switcher";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { TimeZoneSwitcher } from "@/components/settings/timezone-switcher";
import { VersionCard } from "@/components/settings/version-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import { requireUser } from "@/lib/current-user";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("settings.title") };
}
export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const [[settings], [row]] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1),
    db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, user.id)).limit(1),
  ]);
  const isAdmin = row?.isAdmin ?? false;

  return (
    <>
      <PageHeader title={t("settings.title")} />

      {/* Two independent columns so short cards pack together without gaps. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.profile")}</CardTitle>
            <CardDescription>{t("settings.profileDescription")}</CardDescription>
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
            <CardTitle className="text-base">{t("settings.language")}</CardTitle>
            <CardDescription>{t("settings.languageDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.timezone")}</CardTitle>
            <CardDescription>{t("settings.timezoneDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeZoneSwitcher saved={settings?.timezone ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.apiKeys")}</CardTitle>
            <CardDescription>{t("settings.apiKeysDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeysManager />
          </CardContent>
        </Card>
        </div>

        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.fidal")}</CardTitle>
            <CardDescription>{t("settings.fidalDescription")}</CardDescription>
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
            <CardTitle className="text-base">{t("settings.data")}</CardTitle>
            <CardDescription>{t("settings.dataDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTransferCard />
          </CardContent>
        </Card>

        {/* Admins only: upgrading a self-hosted instance is their job, and the
            check reaches out to github.com on behalf of whoever loads it. */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settings.version")}</CardTitle>
              <CardDescription>{t("settings.versionDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <VersionCard />
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </>
  );
}
