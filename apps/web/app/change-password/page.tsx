import { redirect } from "next/navigation";
import { KeyRound, Timer } from "lucide-react";
import { ForcedPasswordChange } from "@/components/auth/forced-password-change";
import { Card, CardContent } from "@/components/ui/card";
import { getAccountState, requireUser } from "@/lib/current-user";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("password.title") };
}

/**
 * Outside the (dashboard) group on purpose: that layout is what redirects
 * here, so rendering inside it would loop.
 */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  const { mustChangePassword } = await getAccountState();
  // Nothing pending? Then this page has no business existing for them.
  if (!mustChangePassword) redirect("/dashboard");

  const { t } = await getT();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Times</span>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-4 w-4 text-primary" />
              </span>
              <div>
                <h1 className="text-base font-semibold tracking-tight">{t("password.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("password.description", { email: user.email })}
                </p>
              </div>
            </div>
            <ForcedPasswordChange />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
