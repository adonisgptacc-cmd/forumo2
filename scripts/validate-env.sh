#!/usr/bin/env bash
set -euo pipefail

file_path="${1:-.env}"

if [[ ! -f "$file_path" ]]; then
  echo "Environment file not found: $file_path" >&2
  exit 1
fi

set -a
source "$file_path"
set +a

missing=()
required_vars=(
  DATABASE_URL
  JWT_SECRET
  REDIS_URL
  MINIO_ENDPOINT
  MINIO_ACCESS_KEY
  MINIO_SECRET_KEY
  SMTP_HOST
  SMTP_PORT
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required variables: ${missing[*]}" >&2
  exit 1
fi

echo "All required variables are set in $file_path"
