#!/usr/bin/env bash
# Hourly backup of production Convex SQLite database
# Keeps last 48 hours of hourly backups + daily backups for 30 days

set -euo pipefail

BACKUP_DIR="/home/dan/src/openclutch/backups"
CONTAINER="openclutch-convex"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/convex-prod-${TIMESTAMP}.sqlite3"

mkdir -p "$BACKUP_DIR"

# Verify the container is running and is the PRODUCTION container
if ! docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "$CONTAINER"; then
  echo "ERROR: Production container '$CONTAINER' is not running. Aborting backup."
  exit 1
fi

# Verify it's on the expected port (3210)
PORT=$(docker port "$CONTAINER" 3210/tcp 2>/dev/null | head -1 | cut -d: -f2)
if [ "$PORT" != "3210" ]; then
  echo "ERROR: Container '$CONTAINER' is not on expected port 3210 (found: $PORT). Aborting."
  exit 1
fi

# Copy the database
docker cp "$CONTAINER":/convex/data/db.sqlite3 "$BACKUP_FILE"

# Verify it's valid SQLite with documents (Convex stores all data in a single 'documents' table)
DOC_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT count(*) FROM documents;" 2>/dev/null || echo "0")
if [ "$DOC_COUNT" -lt 10 ]; then
  echo "WARNING: Backup has only $DOC_COUNT documents (expected 10+). Keeping but flagging."
fi

SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "$(date -Iseconds) Backup complete: $BACKUP_FILE ($SIZE, $DOC_COUNT documents)"

# Prune old hourly backups (keep last 48 hours)
find "$BACKUP_DIR" -name "convex-prod-*.sqlite3" -mmin +2880 -not -name "convex-prod-*-000*.sqlite3" -delete 2>/dev/null || true

# Keep daily backups (midnight-ish) for 30 days
find "$BACKUP_DIR" -name "convex-prod-*-000*.sqlite3" -mtime +30 -delete 2>/dev/null || true
