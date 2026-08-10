# Multi-stage build for the Next.js app (standalone output).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
# Install without running dependency build scripts (pnpm treats "ignored builds"
# as fatal in CI), then build the native deps the build itself needs.
RUN pnpm install --frozen-lockfile --ignore-scripts \
 && pnpm rebuild esbuild sharp unrs-resolver

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter web build
# Bundle the migrate + seed scripts into self-contained CJS so the runtime needs
# neither tsx nor node_modules for them (keeps the final image slim).
RUN cd apps/web && for s in migrate seed repair; do \
      node_modules/.bin/esbuild lib/db/$s.ts --bundle --platform=node --target=node22 \
        --format=cjs --outfile=dist/$s.cjs \
        --external:pg-native --external:cloudflare:sockets; \
    done

# ── runner ───────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# The version this image was built from, so the app can say what it is running
# and compare it against the latest release. Set by CI from the git tag; an
# image built by hand simply has nothing to compare and says so.
ARG APP_VERSION=""
ENV APP_VERSION=$APP_VERSION
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone server already bundles the traced production dependencies —
# no full node_modules copy. This is the whole slim win.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Startup migration + admin provisioning: the two self-contained bundles plus the
# migration SQL (read relative to the working dir).
COPY --from=builder /app/apps/web/dist/migrate.cjs ./migrate.cjs
COPY --from=builder /app/apps/web/dist/seed.cjs ./seed.cjs
COPY --from=builder /app/apps/web/dist/repair.cjs ./repair.cjs
COPY --from=builder /app/apps/web/lib/db/migrations ./lib/db/migrations
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
