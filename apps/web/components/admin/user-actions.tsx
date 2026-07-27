"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  userId: string;
  name: string;
  isAdmin: boolean;
  isOwner: boolean;
  /** True when the row is the signed-in admin looking at themselves. */
  isSelf: boolean;
  activeLogins: number;
};

/**
 * Role, forced sign-out and deletion for one user. The owner and your own
 * account are locked here as well as in the API — the buttons say why rather
 * than disappearing, so it is clear the rule exists.
 */
export function UserActions({ userId, name, isAdmin, isOwner, isSelf, activeLogins }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const locked = isOwner || isSelf;
  const lockReason = isOwner
    ? t("admin.ownerLocked")
    : isSelf
      ? t("admin.selfLocked")
      : undefined;

  async function call(path: string, init: RequestInit, okMessage: string) {
    setBusy(true);
    const res = await fetch(path, init);
    setBusy(false);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t(json?.message ?? "common.saveFailed"),
      });
      return false;
    }
    toast({ title: okMessage });
    router.refresh();
    return true;
  }

  async function toggleAdmin() {
    await call(
      `/api/internal/admin/users/${userId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !isAdmin }),
      },
      isAdmin ? t("admin.adminRevoked") : t("admin.adminGranted"),
    );
  }

  async function revokeLogins() {
    await call(
      `/api/internal/admin/users/${userId}/logins`,
      { method: "DELETE" },
      t("admin.loginsRevoked"),
    );
  }

  async function remove() {
    const ok = await call(
      `/api/internal/admin/users/${userId}`,
      { method: "DELETE" },
      t("admin.userDeleted"),
    );
    if (ok) router.push("/admin");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy || locked} onClick={toggleAdmin}>
          {isAdmin ? (
            <>
              <ShieldOff className="h-4 w-4" /> {t("admin.revokeAdmin")}
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" /> {t("admin.makeAdmin")}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || activeLogins === 0}
          onClick={() => setConfirmRevoke(true)}
        >
          <LogOut className="h-4 w-4" /> {t("admin.revokeLogins")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy || locked}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4" /> {t("admin.deleteUser")}
        </Button>
      </div>

      {lockReason && <p className="text-xs text-muted-foreground">{lockReason}</p>}

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title={t("admin.revokeLoginsTitle")}
        description={t("admin.revokeLoginsDescription", { name, count: activeLogins })}
        confirmLabel={t("admin.revokeLogins")}
        onConfirm={revokeLogins}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("admin.deleteUserTitle")}
        description={t("admin.deleteUserDescription", { name })}
        confirmLabel={t("admin.deleteUser")}
        onConfirm={remove}
      />
    </div>
  );
}
