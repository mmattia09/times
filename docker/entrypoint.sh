#!/bin/sh
set -e

echo "▶ Waiting for the database…"
# Simple wait loop using node's pg through the migrate script's own retry.
cd /app/apps/web

echo "▶ Running migrations…"
node --import tsx lib/db/migrate.ts || npx tsx lib/db/migrate.ts

echo "▶ Provisioning admin from environment…"
node --import tsx lib/db/seed.ts || npx tsx lib/db/seed.ts || true

cd /app
echo "▶ Starting app…"
exec "$@"
