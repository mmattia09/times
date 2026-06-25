"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

type Key = {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ApiKeysManager() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      toast({ variant: "destructive", title: "Errore", description: "Creazione chiave non riuscita." });
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
      toast({ title: "Revocata", description: "Chiave API revocata." });
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
          placeholder="Etichetta (es. script personale)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button onClick={create} disabled={creating}>
          <KeyRound className="h-4 w-4" /> Genera
        </Button>
      </div>

      {newKey && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Copia questa chiave adesso: non sarà più mostrata.
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
        <p className="text-sm text-muted-foreground">Nessuna chiave API.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {k.label}
                  {k.revokedAt && <Badge variant="secondary">Revocata</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  <code>{k.prefix}…</code> · creata {formatDate(k.createdAt)}
                  {k.lastUsedAt ? ` · usata ${formatDate(k.lastUsedAt)}` : " · mai usata"}
                </p>
              </div>
              {!k.revokedAt && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke(k.id)}>
                  <Trash2 className="h-4 w-4" /> Revoca
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
