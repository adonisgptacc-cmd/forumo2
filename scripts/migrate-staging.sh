#!/usr/bin/env bash
set -euo pipefail
# scripts/migrate-staging.sh
echo "Running Prisma migrate deploy on staging..."
pnpm --filter backend prisma migrate deploy
echo "Migration applied. Verifying..."
pnpm --filter backend exec node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw('SELECT 1')
  .then(() => { console.log('Database connection verified.'); return prisma.\$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
"
echo "Migration successful."