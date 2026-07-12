#!/bin/sh
set -e
cd /app

echo "▶ Running migrations…"
node migrate.cjs

echo "▶ Provisioning admin from environment…"
node seed.cjs || true

echo "▶ Starting app…"
exec "$@"
