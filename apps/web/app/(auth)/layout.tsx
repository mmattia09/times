import { redirect } from "next/navigation";
import { getSession } from "@/lib/current-user";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // DB-validated check (not just cookie presence): stale cookies land on the
  // login page instead of looping back to /dashboard.
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Athletics Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">Le tue prestazioni, in un posto solo.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
