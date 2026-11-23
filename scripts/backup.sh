#!/usr/bin/env bash
# Daily backup: PostgreSQL dump + uploaded images. Keep copies OFF the server (e.g. rclone to S3/B2).
#   crontab: 17 3 * * * cd /opt/giveaway && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DIR=backups
KEEP_DAYS=${KEEP_DAYS:-30}
mkdir -p "$DIR"
set -a; source .env; set +a
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-giveaway}" -d "${POSTGRES_DB:-giveaway}" --format=custom --no-owner > "$DIR/db-$STAMP.dump"
docker compose exec -T app tar -C /app/storage -czf - uploads > "$DIR/uploads-$STAMP.tar.gz"
sha256sum "$DIR/db-$STAMP.dump" "$DIR/uploads-$STAMP.tar.gz" > "$DIR/SHA256SUMS-$STAMP"
find "$DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "backup $STAMP ok"
