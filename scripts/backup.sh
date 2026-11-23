#!/usr/bin/env bash
# Daily backup: PostgreSQL dump (uploaded images are stored in the database too). Keep copies OFF the server (e.g. rclone to S3/B2).
#   crontab: 17 3 * * * cd /opt/megalluksi && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DIR=backups
KEEP_DAYS=${KEEP_DAYS:-30}
mkdir -p "$DIR"
set -a; source .env; set +a
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-megalluksi}" -d "${POSTGRES_DB:-megalluksi}" --format=custom --no-owner > "$DIR/db-$STAMP.dump"
sha256sum "$DIR/db-$STAMP.dump" > "$DIR/SHA256SUMS-$STAMP"
find "$DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "backup $STAMP ok"
