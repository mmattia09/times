import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-lg font-semibold">Pagina non trovata</h2>
      <p className="text-sm text-muted-foreground">La risorsa richiesta non esiste.</p>
      <Button asChild>
        <Link href="/dashboard">Torna alla dashboard</Link>
      </Button>
    </div>
  );
}
