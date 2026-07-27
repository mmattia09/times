import { notFound } from "next/navigation";
import { Activity, ShieldCheck, Timer, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { UsersTable, type UserRow } from "@/components/admin/users-table";
import { Card, CardContent } from "@/components/ui/card";
import { getInstanceStats, getRole, listUsers } from "@/lib/admin";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  // Guarded like the page itself: the browser tab shouldn't announce a section
  // the visitor is not allowed to know about.
  const { isAdmin } = await getRole();
  if (!isAdmin) return {};
  const { t } = await getT();
  return { title: t("admin.title") };
}

export default async function AdminPage() {
  // Not a redirect: to anyone without admin this route simply does not exist.
  const { isAdmin } = await getRole();
  if (!isAdmin) notFound();

  const { t } = await getT();
  const [users, stats] = await Promise.all([listUsers(), getInstanceStats()]);
  const registrationOpen = process.env.DISABLE_REGISTRATION !== "true";

  const rows: UserRow[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastLoggedAt: u.lastLoggedAt ? u.lastLoggedAt.toISOString() : null,
    activeUntil: u.activeUntil ? u.activeUntil.toISOString() : null,
  }));

  const cards = [
    { label: t("admin.statUsers"), value: stats.users, icon: Users },
    { label: t("admin.statAdmins"), value: stats.admins, icon: ShieldCheck },
    { label: t("admin.statSessions"), value: stats.sessions, icon: Timer },
    { label: t("admin.statPerformances"), value: stats.performances, icon: Activity },
  ];

  return (
    <>
      <PageHeader title={t("admin.title")} description={t("admin.description")}>
        <CreateUserDialog />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="p-5 text-sm text-muted-foreground">
          <p>{t("admin.ownerNote")}</p>
          <p className="mt-2">
            {registrationOpen ? t("admin.registrationOpen") : t("admin.registrationClosed")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <UsersTable rows={rows} />
        </CardContent>
      </Card>
    </>
  );
}
