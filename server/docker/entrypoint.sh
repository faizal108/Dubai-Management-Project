#!/bin/sh
set -e

# Apply pending migrations on container start when explicitly opted in.
# In production this is normally handled by a separate one-shot migrator
# (see the `migrator` service in docker-compose.yml) — but platforms with no
# one-shot-job primitive (e.g. Azure App Service) set this instead, since
# `prisma migrate deploy` is idempotent and safe to re-run on every restart.
if [ "${RUN_MIGRATIONS_ON_START}" = "true" ]; then
  echo "[entrypoint] running prisma migrate deploy"
  npx prisma migrate deploy
fi

# Seed is also idempotent (prisma/seed.js no-ops if the superadmin already
# exists), so it's safe to run on every restart alongside the above.
if [ "${RUN_SEED_ON_START}" = "true" ]; then
  echo "[entrypoint] running prisma/seed.js"
  node prisma/seed.js
fi

exec "$@"
