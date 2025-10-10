#!/usr/bin/env bash
set -euo pipefail

# Config
DB_URL="postgresql://postgres:postgres@127.0.0.1:5433/huffle_shuffle_test"

# Ensure compose is running
docker compose up -d db

# Wait for DB readiness
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do
  sleep 0.5
done

# Only run migrations if the DB hasn't been initialized
# We check for presence of one of our tables
if ! docker compose exec -T db psql -U postgres -d huffle_shuffle_test -Atc "SELECT to_regclass('public.huffle-shuffle_user') IS NOT NULL" | grep -q t; then
  echo "Running migrations for the first time..."
  SKIP_ENV_VALIDATION=1 DATABASE_URL="$DB_URL" npm run db:push
else
  echo "DB already migrated. Skipping migrations."
fi

# Run tests against the DB, forwarding any args (e.g., -- -t "pattern")
SKIP_ENV_VALIDATION=1 DATABASE_URL="$DB_URL" npm run test -- "$@"

echo "Tests complete. DB left running for faster iteration."

