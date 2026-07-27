"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";

export function PasswordChange() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: false,
    });
    setLoading(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.error"), description: error.message ?? t("settings.tryAgain") });
      return;
    }
    toast({ title: t("settings.passwordUpdated"), description: t("settings.passwordUpdatedDescription") });
    setCurrent("");
    setNext("");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="cur">{t("settings.currentPassword")}</Label>
        <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new">{t("settings.newPassword")}</Label>
        <Input id="new" type="password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading} variant="outline">
          {loading ? t("common.saving") : t("settings.changePassword")}
        </Button>
      </div>
    </form>
  );
}
