import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PendingSessions } from "@/components/pwa/pending-sessions";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getAccountState, requireUser } from "@/lib/current-user";
import { getT } from "@/lib/i18n/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { isAdmin, mustChangePassword } = await getAccountState();
  // An admin handed this account a password; nothing else opens until it is
  // replaced. One gate here covers every page in the group.
  if (mustChangePassword) redirect("/change-password");
  const { t } = await getT();
  return (
    // px-safe: in landscape the notch takes one of the long edges, so the whole
    // shell moves in rather than every card learning about it separately.
    <div className="px-safe flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* h-bar-safe + pt-safe: installed to a home screen the page runs under
            the status bar, so the header grows by whatever the system is using
            up there and keeps its own row 3.5rem tall — otherwise the buttons
            sit inside the notch. */}
        <header className="pt-safe sticky top-0 z-30 flex h-bar-safe items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-6">
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
            <PendingSessions />
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
