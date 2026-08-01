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
      <TabsList className="h-8">
        <TabsTrigger value="list" className="gap-1.5 text-xs">
          <List className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("sessions.viewList")}</span>
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-1.5 text-xs">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("sessions.viewCalendar")}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
