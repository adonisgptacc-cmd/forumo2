#!/usr/bin/env bash
set -euo pipefail
# scripts/rollback-staging.sh

# Find the latest applied migration from the filesystem (timestamped directories)
# Supports both 14-digit (YYYYMMDDHHMMSS) and 8-digit (YYYYMMDD) timestamp formats
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/backend/prisma/migrations" && pwd)"
LAST_MIGRATION=$(ls -1 "$MIGRATIONS_DIR" | grep -E '^[0-9]{8,14}_' | sort | tail -n 1)

if [[ -z "$LAST_MIGRATION" ]]; then
  echo "No migrations found to roll back."
  exit 1
fi

echo "Rolling back: $LAST_MIGRATION"
pnpm --filter backend prisma migrate resolve --rolled-back "$LAST_MIGRATION"
echo "Rollback complete."