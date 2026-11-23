#!/usr/bin/env bash
# Restore a backup made by backup.sh into the running stack. DESTRUCTIVE: replaces the current database.
#   ./scripts/restore.sh backups/db-20260101T031700Z.dump [backups/uploads-20260101T031700Z.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP=${1:?usage: restore.sh <db.dump> [uploads.tar.gz]}
UPLOADS=${2:-}
set -a; source .env; set +a
read -r -p "This REPLACES database '${POSTGRES_DB:-giveaway}'. Type RESTORE to continue: " ok
[ "$ok" = "RESTORE" ] || { echo "aborted"; exit 1; }
docker compose stop app
docker compose exec -T db pg_restore -U "${POSTGRES_USER:-giveaway}" -d "${POSTGRES_DB:-giveaway}" --clean --if-exists --no-owner < "$DUMP"
if [ -n "$UPLOADS" ]; then
  docker compose run --rm --no-deps -T --entrypoint sh app -c "tar -C /app/storage -xzf -" < "$UPLOADS"
fi
docker compose start app
echo "restore complete — open /admin/audit to confirm the audit hash chain is intact"
