import { redirect } from "next/navigation";
import { Timer } from "lucide-react";
import { getSession } from "@/lib/current-user";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // DB-validated check (not just cookie presence): stale cookies land on the
  // login page instead of looping back to /dashboard.
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Timer className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Times</h1>
          <p className="mt-1 text-sm text-muted-foreground">Allenamenti e gare, in un posto solo.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
