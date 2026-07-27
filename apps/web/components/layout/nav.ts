import { ClipboardList, LayoutDashboard, ListChecks, Settings, Shield, Trophy } from "lucide-react";

export const navItems = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/sessions", key: "nav.sessions", icon: ListChecks },
  { href: "/workouts", key: "nav.workouts", icon: ClipboardList },
  { href: "/records", key: "nav.records", icon: Trophy },
] as const;

/** Pinned at the bottom of the sidebar (last item of the mobile bottom nav). */
export const settingsItem = { href: "/settings", key: "nav.settings", icon: Settings } as const;

/**
 * Admins only, and deliberately not in the mobile bottom nav — five tabs is
 * already the limit there, so on a phone it lives in the avatar menu.
 */
export const adminItem = { href: "/admin", key: "nav.admin", icon: Shield } as const;
