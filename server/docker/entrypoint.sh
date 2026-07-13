#!/bin/sh
set -e

# Apply pending migrations on container start when explicitly opted in.
# In production this is normally handled by a separate one-shot migrator
# (see the `migrator` service in docker-compose.yml).
if [ "${RUN_MIGRATIONS_ON_START}" = "true" ]; then
  echo "[entrypoint] running prisma migrate deploy"
  npx prisma migrate deploy
fi

exec "$@"
