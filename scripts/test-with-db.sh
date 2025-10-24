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
SKIP_ENV_VALIDATION=1 DATABASE_URL="$DB_URL" npm run db:push

# Run tests against the DB, forwarding any args (e.g., -- -t "pattern")
SKIP_ENV_VALIDATION=1 DATABASE_URL="$DB_URL" npm run test:db -- "$@"

echo "Tests complete. DB left running for faster iteration."

