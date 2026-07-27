"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";

/**
 * Sets someone else's password. The dialog says plainly what that means —
 * whoever does it can sign in as them until they change it — because a control
 * this sharp shouldn't look like the others.
 */
export function SetPasswordDialog({
  userId,
  name,
  disabled = false,
}: {
  userId: string;
  name: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/internal/admin/users/${userId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, mustChange }),
    });
    setSaving(false);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const issue = json?.issues?.fieldErrors?.password?.[0];
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t(issue ?? json?.message ?? "common.saveFailed"),
      });
      return;
    }
    toast({ title: t("admin.passwordSet"), description: t("admin.passwordSetHint", { name }) });
    setPassword("");
    setMustChange(true);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPassword("");
          setMustChange(true);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <KeyRound className="h-4 w-4" /> {t("admin.setPassword")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("admin.setPasswordTitle")}</DialogTitle>
            <DialogDescription>{t("admin.setPasswordDescription", { name })}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-password">{t("admin.newPassword")}</Label>
              <Input
                id="set-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">{t("admin.initialPasswordHint")}</p>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t("admin.mustChange")}</p>
                <p className="text-xs text-muted-foreground">{t("admin.mustChangeHint")}</p>
              </div>
              <Switch
                checked={mustChange}
                onCheckedChange={setMustChange}
                aria-label={t("admin.mustChange")}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.setPasswordWarning")}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("admin.setPassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
