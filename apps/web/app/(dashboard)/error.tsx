"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-lg font-semibold">Qualcosa è andato storto</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Si è verificato un errore nel caricamento di questa pagina.
      </p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  );
}
