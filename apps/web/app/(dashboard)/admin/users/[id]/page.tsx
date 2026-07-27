import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/admin/role-badge";
import { UserActions } from "@/components/admin/user-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRole, getUserDetail } from "@/lib/admin";
import { getSession } from "@/lib/current-user";
import { formatDate, formatMoment } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

const loadUser = cache(async (id: string) => getUserDetail(id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getRole();
  if (!isAdmin) return {};
  const user = await loadUser((await params).id);
  return { title: user?.name ?? user?.email };
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getRole();
  if (!isAdmin) notFound();

  const { t, dict, locale, timeZone } = await getT();
  const { id } = await params;
  const user = await loadUser(id);
  if (!user) notFound();

  const session = await getSession();
  const isSelf = session?.user?.id === user.id;

  const account = [
    { label: t("admin.email"), value: user.email },
    {
      label: t("admin.signedUp"),
      value: formatMoment(user.createdAt, timeZone, "d MMM yyyy, HH:mm", locale),
    },
    {
      label: t("admin.signedIn"),
      value: user.activeLogins > 0 ? t("admin.activeLogins", { count: user.activeLogins }) : t("admin.offline"),
    },
    {
      label: t("admin.lastLogged"),
      value: user.lastLoggedAt ? formatDate(user.lastLoggedAt, undefined, locale) : t("common.none"),
    },
  ];

  const data = [
    { label: t("admin.statSessions"), value: user.sessionCount },
    { label: t("admin.statPerformances"), value: user.performanceCount },
    { label: t("admin.statRecords"), value: user.personalBestCount },
    { label: t("admin.statWorkouts"), value: user.workoutCount },
    { label: t("admin.statGoals"), value: user.goalCount },
    { label: t("admin.statApiKeys"), value: user.apiKeyCount },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft className="h-4 w-4" /> {t("admin.backToUsers")}
        </Link>
      </Button>

      <PageHeader title={user.name ?? user.email}>
        <RoleBadge isOwner={user.isOwner} isAdmin={user.isAdmin} dict={dict} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.account")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {account.map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="truncate text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.dataTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {data.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base">{t("admin.manage")}</CardTitle>
        </CardHeader>
        <CardContent>
          <UserActions
            userId={user.id}
            name={user.name ?? user.email}
            isAdmin={user.isAdmin}
            isOwner={user.isOwner}
            isSelf={isSelf}
            activeLogins={user.activeLogins}
          />
        </CardContent>
      </Card>
    </div>
  );
}
