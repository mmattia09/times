"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";

/** The only thing an account with a pending password change can do. */
export function ForcedPasswordChange() {
  const router = useRouter();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setSaving(true);
    const res = await fetch("/api/internal/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const issue = json?.issues?.fieldErrors?.newPassword?.[0];
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t(issue ?? json?.message ?? "errors.wrongPassword"),
      });
      return;
    }
    toast({ title: t("password.updated"), description: t("password.updatedDescription") });
    router.replace("/dashboard");
    router.refresh();
  }

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fp-current">{t("password.current")}</Label>
        <Input
          id="fp-current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-new">{t("password.new")}</Label>
        <Input
          id="fp-new"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">{t("password.rule")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-confirm">{t("password.confirm")}</Label>
        <Input
          id="fp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        {mismatch && <p className="text-xs text-destructive">{t("password.mismatch")}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={saving || mismatch}>
        {saving ? t("common.saving") : t("password.submit")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={logout}
      >
        <LogOut className="h-4 w-4" /> {t("nav.signOut")}
      </Button>
    </form>
  );
}
