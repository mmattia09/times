import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/current-user";
import { getRole } from "@/lib/admin";
import { getT } from "@/lib/i18n/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getT();
  const { isAdmin } = await getRole();
  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <span className="text-sm font-semibold md:hidden">Times</span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/sessions/new">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.newSession")}</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/workouts/new">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.newWorkout")}</span>
              </Link>
            </Button>
            <ThemeToggle />
            <UserMenu userName={user.name ?? undefined} userEmail={user.email} isAdmin={isAdmin} />
          </div>
        </header>
        <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:px-6 md:pb-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
