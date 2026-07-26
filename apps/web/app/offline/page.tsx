import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
        <WifiOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sei offline</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Times ha bisogno della connessione per leggere e salvare i tuoi dati. Riprova appena
          torni online.
        </p>
      </div>
    </div>
  );
}
