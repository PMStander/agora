#!/bin/bash
# Nightly Supabase local DB backup
# Keeps last 7 days of backups

BACKUP_DIR="$HOME/Developer/agora/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
BACKUP_FILE="$BACKUP_DIR/supabase_$TIMESTAMP.sql.gz"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

# Dump the local Supabase postgres database
docker exec supabase_db_agora pg_dump -U postgres --clean --if-exists 2>/dev/null | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  echo "Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  # Prune old backups
  find "$BACKUP_DIR" -name "supabase_*.sql.gz" -mtime +$KEEP_DAYS -delete
else
  echo "ERROR: Backup failed!" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi
