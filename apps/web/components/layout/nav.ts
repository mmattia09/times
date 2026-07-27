import { ClipboardList, LayoutDashboard, ListChecks, Settings, Trophy } from "lucide-react";

export const navItems = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/sessions", key: "nav.sessions", icon: ListChecks },
  { href: "/workouts", key: "nav.workouts", icon: ClipboardList },
  { href: "/records", key: "nav.records", icon: Trophy },
] as const;

/** Pinned at the bottom of the sidebar (last item of the mobile bottom nav). */
export const settingsItem = { href: "/settings", key: "nav.settings", icon: Settings } as const;
