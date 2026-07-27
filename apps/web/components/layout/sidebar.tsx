"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer } from "lucide-react";
import { navItems, settingsItem } from "@/components/layout/nav";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  pathname,
  item,
  t,
}: {
  pathname: string;
  item: { href: string; key: string; icon: React.ComponentType<{ className?: string }> };
  t: (k: string) => string;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {t(item.key)}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    // Sticky + full-height so the nav (and Impostazioni) stays visible while
    // the main content scrolls.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <Timer className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Times</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink key={item.href} pathname={pathname} item={item} t={t} />
        ))}
      </nav>
      <div className="border-t p-3">
        <NavLink pathname={pathname} item={settingsItem} t={t} />
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    // pb-[env(safe-area-inset-bottom)] keeps the tabs above the iOS home
    // indicator when the app is installed to the home screen.
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {[...navItems, settingsItem].map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
