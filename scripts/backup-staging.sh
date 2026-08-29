#!/usr/bin/env bash
set -euo pipefail
# scripts/backup-staging.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/staging_${TIMESTAMP}.sql"
mkdir -p backups
pg_dump "${DATABASE_URL_STAGING}" > "${BACKUP_FILE}"
echo "Backup written to ${BACKUP_FILE}"