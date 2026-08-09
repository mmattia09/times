"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, List } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n/client";

/**
 * List or calendar, over the same filtered sessions. Kept in the URL so the
 * view survives a reload and can be linked to.
 */
export function ViewSwitch({ view }: { view: "list" | "calendar" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();

  function change(next: string) {
    const query = new URLSearchParams(params.toString());
    if (next === "list") {
      query.delete("view");
      query.delete("month");
    } else {
      query.set("view", next);
    }
    const qs = query.toString();
    router.push(qs ? `/sessions?${qs}` : "/sessions");
  }

  return (
    <Tabs value={view} onValueChange={change}>
      {/* Roomier than the desktop tabs: with the label hidden on a phone this
          is an icon on its own, and a 38px-wide target is a miss waiting to
          happen. */}
      <TabsList className="h-10 sm:h-8">
        <TabsTrigger value="list" className="h-full gap-1.5 px-4 text-xs sm:px-3">
          <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">{t("sessions.viewList")}</span>
        </TabsTrigger>
        <TabsTrigger value="calendar" className="h-full gap-1.5 px-4 text-xs sm:px-3">
          <CalendarDays className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">{t("sessions.viewCalendar")}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
