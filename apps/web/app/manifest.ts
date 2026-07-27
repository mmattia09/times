import type { MetadataRoute } from "next";
import { LOCALE_TAGS } from "@/lib/i18n";
import { getRequestLocale, translator } from "@/lib/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Manifests are fetched without credentials, so the locale comes from the
  // cookie / Accept-Language rather than the signed-in user's preference.
  const locale = await getRequestLocale();
  const { t } = translator(locale);

  return {
    name: `Times — ${t("meta.tagline")}`,
    short_name: "Times",
    description: t("meta.shortDescription"),
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#7c5cf0",
    lang: LOCALE_TAGS[locale],
    categories: ["sports", "health", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon to jump straight into logging.
    shortcuts: [
      { name: t("sessions.newSession"), url: "/sessions/new" },
      { name: t("workouts.newTitle"), url: "/workouts/new" },
      { name: t("records.title"), url: "/records" },
    ],
  };
}
