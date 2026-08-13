import { Archive, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { BackupOverview } from "@/lib/backup-listing";
import { getT } from "@/lib/i18n/server";

/**
 * The backups that exist, so a schedule isn't something to be trusted blindly.
 *
 * Read-only: restoring is a command in the container, because it has to work on
 * the day nobody can sign in and because restoring every account is not a power
 * a browser session should have. What this answers is the only question the page
 * can usefully answer — is there a recent backup, and does it have my season in
 * it.
 */
export async function BackupsCard({ overview }: { overview: BackupOverview }) {
  const { t, locale } = await getT();
  const { schedule, directory, runs, nextDue, error } = overview;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{t("admin.backups")}</CardTitle>
          <CardDescription>{t("admin.backupsDescription")}</CardDescription>
        </div>
        <Badge variant={schedule && schedule !== "off" ? "default" : "muted"}>
          {schedule === null
            ? t("admin.backupScheduleInvalid")
            : schedule === "off"
              ? t("admin.backupsOff")
              : t(`admin.schedule.${schedule}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 px-3 py-2 text-xs text-amber-600 dark:text-amber-500">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("admin.backupsUnreadable", { directory, error })}
          </p>
        )}

        {schedule === "off" && !error && (
          <p className="text-sm text-muted-foreground">{t("admin.backupsOffHint")}</p>
        )}

        {runs.length === 0 && !error && schedule !== "off" && (
          <p className="text-sm text-muted-foreground">{t("admin.backupsNoneYet")}</p>
        )}

        {runs.length > 0 && (
          <ul className="divide-y text-sm">
            {runs.map((run) => (
              <li key={run.name} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="tabular-nums">
                    {formatDate(`${run.name}T00:00:00.000Z`, undefined, locale)}
                  </span>
                </span>
                {run.incomplete ? (
                  <span className="text-xs text-muted-foreground">{t("admin.backupNoManifest")}</span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("admin.backupContents", { users: run.users, sessions: run.sessions })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p>
            {t("admin.backupsIn")} <code className="rounded bg-muted px-1 py-0.5">{directory}</code>
          </p>
          {nextDue && (
            <p>{t("admin.backupNextDue", { date: formatDate(nextDue, undefined, locale) })}</p>
          )}
          {runs.length > 0 && (
            <p>
              {t("admin.restoreHint")}{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                docker compose exec app node restore.cjs {runs[0].name}
              </code>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
