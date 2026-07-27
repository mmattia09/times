"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoment } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  createdAt: string;
  sessionCount: number;
  performanceCount: number;
  lastLoggedAt: string | null;
  activeUntil: string | null;
};

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const { t, dict, locale, timeZone } = useI18n();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.searchUsers")}
          aria-label={t("admin.searchUsers")}
          className="h-8 pl-8 text-xs"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.user")}</TableHead>
            <TableHead>{t("admin.role")}</TableHead>
            <TableHead>{t("admin.signedUp")}</TableHead>
            <TableHead>{t("admin.lastLogged")}</TableHead>
            <TableHead className="text-right">{t("admin.sessionsLogged")}</TableHead>
            <TableHead>{t("admin.signedIn")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow
              key={r.id}
              className="cursor-pointer"
              onClick={() => router.push(`/admin/users/${r.id}`)}
            >
              <TableCell>
                <span className="block font-medium">{r.name ?? t("nav.athlete")}</span>
                <span className="block text-xs text-muted-foreground">{r.email}</span>
              </TableCell>
              <TableCell>
                {r.isOwner ? (
                  <Badge variant="success">{dict.admin.roleOwner}</Badge>
                ) : r.isAdmin ? (
                  <Badge>{dict.admin.roleAdmin}</Badge>
                ) : (
                  <Badge variant="muted">{dict.admin.roleUser}</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatMoment(r.createdAt, timeZone, "d MMM yyyy", locale)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.lastLoggedAt ? formatDate(r.lastLoggedAt, undefined, locale) : t("common.none")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.sessionCount}</TableCell>
              <TableCell>
                {r.activeUntil ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t("admin.online")}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("admin.offline")}</span>
                )}
              </TableCell>
              <TableCell className="w-8 text-right">
                <Link
                  href={`/admin/users/${r.id}`}
                  aria-label={t("admin.openUser")}
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {shown.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                {t("admin.noUsers")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
