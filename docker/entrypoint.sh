#!/bin/sh
set -e
cd /app

echo "▶ Running migrations…"
node migrate.cjs

echo "▶ Provisioning admin from environment…"
node seed.cjs || true

# One-off data repairs for bugs that wrote bad rows. Idempotent: once a row is
# fixed it no longer matches, so this is a no-op on every later boot.
echo "▶ Checking imported data…"
node repair.cjs || true

echo "▶ Starting app…"
exec "$@"
