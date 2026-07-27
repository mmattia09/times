"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { PasswordChange } from "@/components/settings/password-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";

export function ProfileSettings({
  initialName,
  initialEmail,
  isAdmin,
}: {
  initialName: string;
  initialEmail: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);

  const dirty = name !== initialName || (!isAdmin && email.trim().toLowerCase() !== initialEmail);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: { name?: string; email?: string } = {};
      if (name !== initialName) payload.name = name;
      if (!isAdmin && email.trim().toLowerCase() !== initialEmail)
        payload.email = email.trim().toLowerCase();
      const res = await fetch("/api/internal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? t("settings.updateFailed"));
      }
      toast({ title: t("settings.profileUpdated") });
      router.refresh();
    } catch (err) {
      toast({ variant: "destructive", title: t("common.error"), description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t("auth.name")}</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">{t("auth.email")}</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isAdmin}
            />
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={saving || !dirty}>
          {saving ? t("common.saving") : t("settings.saveProfile")}
        </Button>
      </form>
      {isAdmin ? (
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("settings.adminNotice")}</span>
        </div>
      ) : (
        <div className="border-t pt-4">
          <PasswordChange />
        </div>
      )}
    </div>
  );
}
