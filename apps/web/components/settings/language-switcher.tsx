"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    if (next === locale) return;
    setSaving(true);
    const res = await fetch("/api/internal/locale", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next as Locale }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.saveFailed") });
      return;
    }
    // The locale is resolved server-side, so re-render everything.
    router.refresh();
  }

  return (
    <Select value={locale} onValueChange={change} disabled={saving}>
      <SelectTrigger className={compact ? "h-8 w-auto min-w-[8rem] text-xs" : "max-w-xs"}>
        <span className="flex items-center gap-2">
          {compact && <Languages className="h-3.5 w-3.5 text-muted-foreground" />}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l} value={l}>
            {LOCALE_NAMES[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
