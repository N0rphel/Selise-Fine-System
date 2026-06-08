#!/bin/sh
set -e

echo "Waiting for database to be ready..."
until bunx prisma db push --skip-generate --accept-data-loss 2>&1; do
  echo "Database not ready, retrying in 3s..."
  sleep 3
done

echo "Database ready. Starting app..."
exec bun run start
