import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// React's dev-only debugging (callstack reconstruction) needs eval(); the
// production bundle never calls it, so the strict policy applies where it counts.
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Trace from the monorepo root so pnpm-hoisted deps are bundled into standalone.
  outputFileTracingRoot: monorepoRoot,
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app is self-hosted and same-origin only: nothing here should be
          // framed, sniffed, or leak referrers to third parties.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next injects inline bootstrap/runtime scripts and styles.
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
