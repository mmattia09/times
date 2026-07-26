import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Times — atletica leggera",
    short_name: "Times",
    description: "Allenamenti, gare e record di atletica leggera.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#7c5cf0",
    lang: "it",
    categories: ["sports", "health", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon to jump straight into logging.
    shortcuts: [
      { name: "Nuova sessione", url: "/sessions/new" },
      { name: "Nuova scheda", url: "/workouts/new" },
      { name: "Record", url: "/records" },
    ],
  };
}
