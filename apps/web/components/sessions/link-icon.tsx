import { siInstagram, siStrava, siTiktok, siYoutube } from "simple-icons";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { serviceFor, type LinkService } from "@/lib/links";

/**
 * The brand mark, drawn in the app's own colours.
 *
 * Simple Icons ships the official outlines (CC0); rendering them with
 * `currentColor` rather than each brand's colour keeps a row of links looking
 * like one list instead of a sticker album, which is the point.
 */
const MARKS: Partial<Record<LinkService, { title: string; path: string }>> = {
  strava: { title: siStrava.title, path: siStrava.path },
  instagram: { title: siInstagram.title, path: siInstagram.path },
  youtube: { title: siYoutube.title, path: siYoutube.path },
  tiktok: { title: siTiktok.title, path: siTiktok.path },
};

export function LinkIcon({ url, className }: { url: string; className?: string }) {
  const mark = MARKS[serviceFor(url)];
  if (!mark) return <Link2 className={cn("h-4 w-4", className)} aria-hidden />;
  return (
    <svg
      role="img"
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-4 w-4", className)}
    >
      <path d={mark.path} />
    </svg>
  );
}
