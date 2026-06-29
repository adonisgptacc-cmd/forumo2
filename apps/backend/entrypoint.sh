#!/bin/sh
set -e

echo "Running migrations..."
pnpm --filter backend migrate

echo "Starting application..."
exec "$@"
