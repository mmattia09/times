import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Trace from the monorepo root so pnpm-hoisted deps are bundled into standalone.
  outputFileTracingRoot: monorepoRoot,
  serverExternalPackages: ["pg"],
  eslint: {
    // Lint is run separately in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
