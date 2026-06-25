"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/hooks/use-toast";

export function PasswordChange() {
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
      toast({ variant: "destructive", title: "Errore", description: error.message ?? "Riprova." });
      return;
    }
    toast({ title: "Aggiornata", description: "Password cambiata." });
    setCurrent("");
    setNext("");
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="cur">Password attuale</Label>
        <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new">Nuova password</Label>
        <Input id="new" type="password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading} variant="outline">
          {loading ? "Aggiornamento…" : "Cambia password"}
        </Button>
      </div>
    </form>
  );
}
