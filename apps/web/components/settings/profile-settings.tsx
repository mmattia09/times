"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { PasswordChange } from "@/components/settings/password-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

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
        throw new Error(j.message ?? "Aggiornamento non riuscito");
      }
      toast({ title: "Profilo aggiornato" });
      router.refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Errore", description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Nome</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
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
          {saving ? "Salvataggio…" : "Salva profilo"}
        </Button>
      </form>
      {isAdmin ? (
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Account amministratore: email e password si cambiano solo dal file <code>.env</code>{" "}
            del server (<code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code>), poi riavvia il
            container. Il nome invece è modificabile qui.
          </span>
        </div>
      ) : (
        <div className="border-t pt-4">
          <PasswordChange />
        </div>
      )}
    </div>
  );
}
