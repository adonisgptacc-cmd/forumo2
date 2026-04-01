#!/bin/sh
set -e

echo "Running migrations..."
pnpm --filter backend prisma migrate deploy

echo "Starting application..."
exec "$@"
