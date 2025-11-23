#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

copy_env() {
  local example_file="$1"
  local target_file="$2"

  if [[ -f "$example_file" && ! -f "$target_file" ]]; then
    cp "$example_file" "$target_file"
    echo "Created $(realpath --relative-to="$root_dir" "$target_file") from example"
  fi
}

copy_env "$root_dir/.env.example" "$root_dir/.env"
copy_env "$root_dir/apps/backend/.env.example" "$root_dir/apps/backend/.env"
copy_env "$root_dir/apps/web/.env.example" "$root_dir/apps/web/.env"
copy_env "$root_dir/apps/mobile/.env.example" "$root_dir/apps/mobile/.env"

echo "Installing workspace dependencies with pnpm..."
pnpm install

echo "Applying database migrations..."
npm run db:migrate

echo "Setup complete. Start the stack with 'docker-compose -f docker-compose.dev.yml up -d' and 'npm run dev'."
