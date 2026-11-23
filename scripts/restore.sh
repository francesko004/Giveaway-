#!/usr/bin/env bash
# Restore a backup made by backup.sh into the running stack. DESTRUCTIVE: replaces the current database.
#   ./scripts/restore.sh backups/db-20260101T031700Z.dump
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP=${1:?usage: restore.sh <db.dump>}
set -a; source .env; set +a
read -r -p "This REPLACES database '${POSTGRES_DB:-megalluksi}'. Type RESTORE to continue: " ok
[ "$ok" = "RESTORE" ] || { echo "aborted"; exit 1; }
docker compose stop app
docker compose exec -T db pg_restore -U "${POSTGRES_USER:-megalluksi}" -d "${POSTGRES_DB:-megalluksi}" --clean --if-exists --no-owner < "$DUMP"
docker compose start app
echo "restore complete — open /admin/audit to confirm the audit hash chain is intact"
