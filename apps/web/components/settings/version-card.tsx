"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { Release, UpdateStatus } from "@/lib/updates";

/**
 * Release notes, rendered without letting the text become markup.
 *
 * The body comes from outside the instance, so it is never handed to
 * dangerouslySetInnerHTML — it is split into React elements instead. That
 * limits what can be shown to what these notes actually use: short section
 * headings, bullets, and `code` or **emphasis** inside a line.
 */
function inline(text: string, keyPrefix: string) {
  // Split on `code` and **bold**, keeping the delimiters' contents.
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function ReleaseNotes({ notes }: { notes: string }) {
  const lines = notes.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b, `b-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    // An indented line under a bullet is that bullet continuing.
    if (bullets.length > 0 && /^\s{2,}\S/.test(raw)) {
      bullets[bullets.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flush();
    const heading = line.replace(/^#{1,6}\s+/, "");
    // "Fixed", "Changed", "Added" — a short line with no sentence in it.
    const isHeading = /^#{1,6}\s/.test(line) || (heading.length <= 24 && !/[.:!?]$/.test(heading));
    blocks.push(
      isHeading ? (
        <p key={`h-${blocks.length}`} className="mt-3 font-medium text-foreground first:mt-0">
          {heading}
        </p>
      ) : (
        <p key={`p-${blocks.length}`}>{inline(line, `p-${blocks.length}`)}</p>
      ),
    );
  }
  flush();

  return <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">{blocks}</div>;
}

function ReleaseEntry({ release, open }: { release: Release; open: boolean }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(open);
  return (
    <li className="border-t pt-3 first:border-0 first:pt-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 py-1 text-left text-sm font-medium"
      >
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
        />
        <span className="min-w-0 truncate">{release.name}</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-2 pl-6">
          {release.notes ? (
            <ReleaseNotes notes={release.notes} />
          ) : (
            <p className="text-xs text-muted-foreground">{t("settings.noNotes")}</p>
          )}
          <a
            href={release.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t("settings.viewRelease")} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </li>
  );
}

/**
 * The version this instance runs, and whether a newer one exists.
 *
 * Admin-only, and only ever a statement: nothing here updates anything. A
 * self-hosted instance is upgraded by pulling the image, which is the admin's
 * decision and the admin's shell, so the card's job is to tell them there is a
 * reason to and what it is.
 */
export function VersionCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    setChecking(true);
    try {
      const res = await fetch(`/api/internal/updates${refresh ? "?refresh=1" : ""}`);
      const json = await res.json();
      if (res.ok) setStatus(json.data as UpdateStatus);
    } catch {
      // A failed check is not worth a toast: the card says so itself.
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const summary = () => {
    if (!status) return t("common.loading");
    switch (status.state) {
      case "disabled":
        return t("settings.checksDisabled");
      case "unreachable":
        return t("settings.checkFailed");
      case "unknown-version":
        return status.latest
          ? t("settings.devBuildNote", { version: status.latest })
          : t("settings.devBuild");
      default:
        return status.behind
          ? t("settings.updateAvailable", { version: status.latest ?? "" })
          : t("settings.upToDate");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {status?.current ?? (status ? t("settings.devBuild") : "—")}
            {status?.behind && <Badge variant="default">{t("settings.newVersion")}</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{summary()}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={checking || status?.state === "disabled"}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          <span className="hidden sm:inline">
            {checking ? t("settings.checking") : t("settings.checkNow")}
          </span>
        </Button>
      </div>

      {status?.behind && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t("settings.upgradeHint")}{" "}
          <code className="rounded bg-background px-1 py-0.5">
            docker compose pull app &amp;&amp; docker compose up -d
          </code>
        </p>
      )}

      {status && status.newer.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.whatsNew")}</p>
          <ul className="space-y-3">
            {status.newer.map((r, i) => (
              <ReleaseEntry key={r.version} release={r} open={i === 0} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
