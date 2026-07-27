"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
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
 * Adds an account directly. There is no mail server here, so instead of an
 * invite the admin sets a first password and passes it on; the person changes
 * it from Settings.
 */
export function CreateUserDialog() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPassword("");
    setIsAdmin(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/internal/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, isAdmin }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t(json?.message ?? "admin.createFailed"),
      });
      return;
    }
    toast({ title: t("admin.userCreated"), description: t("admin.userCreatedHint", { email }) });
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> {t("admin.newUser")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("admin.newUser")}</DialogTitle>
            <DialogDescription>{t("admin.newUserDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-name">{t("admin.name")}</Label>
              <Input
                id="new-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-email">{t("admin.email")}</Label>
              <Input
                id="new-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-password">{t("admin.initialPassword")}</Label>
              <Input
                id="new-user-password"
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
                <p className="text-sm font-medium">{t("admin.grantAdmin")}</p>
                <p className="text-xs text-muted-foreground">{t("admin.grantAdminHint")}</p>
              </div>
              <Switch
                checked={isAdmin}
                onCheckedChange={setIsAdmin}
                aria-label={t("admin.grantAdmin")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("admin.createUser")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
