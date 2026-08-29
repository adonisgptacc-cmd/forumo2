#!/usr/bin/env bash
set -euo pipefail
# scripts/restore-staging.sh
BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi
psql "${DATABASE_URL_STAGING}" < "${BACKUP_FILE}"
echo "Restored from ${BACKUP_FILE}"