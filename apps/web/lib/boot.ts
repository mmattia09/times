import "server-only";
import { configuredOrigins } from "@/lib/origins";
import { logEvent } from "@/lib/log";

/**
 * One line at startup saying how this instance is configured to accept
 * requests. When a login is refused for its origin, this is the line that says
 * why — and it prints once, not per request.
 */
let announced = false;

export function announceConfig(): void {
  if (announced) return;
  announced = true;

  const origins = configuredOrigins();
  const secure = process.env.SECURE_COOKIES?.trim().toLowerCase();
  logEvent("boot", {
    url: process.env.BETTER_AUTH_URL ?? "(unset, defaults to http://localhost:3000)",
    trusted: origins.join(",") || "(none)",
    lan: "private addresses are trusted automatically",
    secureCookies:
      secure === "true" || secure === "false"
        ? secure
        : `auto (${(process.env.BETTER_AUTH_URL ?? "").startsWith("https://") ? "on" : "off"})`,
    registration: process.env.DISABLE_REGISTRATION === "true" ? "closed" : "open",
  });
}
