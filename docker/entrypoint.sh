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

# Scheduled backups, if BACKUP_SCHEDULE asks for any. The script exits at once
# when it doesn't, so this costs nothing on an instance that never set it, and
# it runs beside the app rather than in front of it: a backup that can't be
# written must not stop the app from starting.
node backup.cjs loop &

echo "▶ Starting app…"
exec "$@"
