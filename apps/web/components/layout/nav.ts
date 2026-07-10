import { ClipboardList, LayoutDashboard, ListChecks, Settings, Trophy } from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessioni", icon: ListChecks },
  { href: "/workouts", label: "Schede", icon: ClipboardList },
  { href: "/records", label: "Record", icon: Trophy },
] as const;

/** Pinned at the bottom of the sidebar (last item of the mobile bottom nav). */
export const settingsItem = { href: "/settings", label: "Impostazioni", icon: Settings } as const;
