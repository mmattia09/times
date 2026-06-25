import { BarChart3, LayoutDashboard, ListChecks, Settings, Trophy } from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessioni", icon: ListChecks },
  { href: "/records", label: "Record", icon: Trophy },
  { href: "/settings", label: "Impostazioni", icon: Settings },
] as const;

export const chartsHint = BarChart3;
