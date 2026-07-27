"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

type Key = {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ApiKeysManager() {
  const { t, locale } = useI18n();
  const [keys, setKeys] = useState<Key[]>([]);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toRevoke, setToRevoke] = useState<Key | null>(null);

  async function load() {
    const res = await fetch("/api/keys");
    const json = await res.json();
    setKeys(json.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!label.trim()) return;
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setCreating(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: t("common.error"), description: t("settings.keyCreateFailed") });
      return;
    }
    const json = await res.json();
    setNewKey(json.key);
    setLabel("");
    load();
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: t("settings.revoked"), description: t("settings.revokedOk") });
      load();
    }
  }

  async function copy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t("settings.keyLabelPlaceholder")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button onClick={create} disabled={creating}>
          <KeyRound className="h-4 w-4" /> {t("settings.generate")}
        </Button>
      </div>

      {newKey && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {t("settings.copyKeyNow")}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">{newKey}</code>
            <Button size="icon" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.noKeys")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {k.label}
                  {k.revokedAt && <Badge variant="secondary">{t("settings.revoked")}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  <code>{k.prefix}…</code> · {t("settings.keyCreated", { date: formatDate(k.createdAt, undefined, locale) })}
                  {k.lastUsedAt ? ` · ${t("settings.keyUsed", { date: formatDate(k.lastUsedAt, undefined, locale) })}` : ` · ${t("settings.keyNeverUsed")}`}
                </p>
              </div>
              {!k.revokedAt && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToRevoke(k)}>
                  <Trash2 className="h-4 w-4" /> {t("settings.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title={t("settings.revokeTitle")}
        description={t("settings.revokeDescription", { label: toRevoke?.label ?? "" })}
        confirmLabel={t("settings.revoke")}
        onConfirm={() => (toRevoke ? revoke(toRevoke.id) : undefined)}
      />
    </div>
  );
}
