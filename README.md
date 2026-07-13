# Donation Management Platform

Multi-tenant donation management product. A platform superadmin onboards
foundations and assigns admins; each admin manages donors and donations for
their own foundation. Customers (donors) self-serve via a public auth flow.

- **Backend** — Node.js + Express 5, Prisma + PostgreSQL, Zod, JWT, pino.
- **Frontend** — React 18 + Vite, served via nginx in production.
- **Infra** — Docker + docker-compose. Runs identically locally and on AWS.

Roles: `SUPERADMIN`, `ADMIN`, `CUSTOMER`. All primary entities use soft delete
(`isDeleted`) and carry `createdBy`/`updatedBy` audit columns.

---

## Repository layout

```
.
├── cms/                  # React + Vite frontend
├── server/               # Express API + Prisma schema and migrations
├── docker-compose.yml    # Postgres + migrator + backend + frontend
├── .env.example          # Root env consumed by docker-compose
└── README.md
```

---

## Prerequisites

- Node.js **20.x** and npm 10.x (for local non-Docker dev)
- Docker 24+ and Docker Compose v2 (for the containerized workflow)
- PostgreSQL 14+ (only if you want to run the DB outside Docker)

---

## Quick start — Docker (recommended)

This is the path that works the same on your laptop and on an AWS EC2 host.

```bash
# 1. Configure
cp .env.example .env
# Edit .env — at minimum set a strong JWT_SECRET and SEED_SUPERADMIN_PASSWORD.

# 2. Build and start the full stack
docker compose up -d --build

# 3. Watch logs (optional)
docker compose logs -f backend
```

What happens on `up`:

1. `postgres` starts and reports healthy via `pg_isready`.
2. `migrator` runs **once**: `prisma migrate deploy` + `prisma/seed.js`
   (creates the superadmin from `SEED_SUPERADMIN_EMAIL` / `_PASSWORD`).
3. `backend` boots only after the migrator exits successfully.
4. `frontend` is built with `VITE_API_BASE_URL` baked in and served by nginx.

URLs (defaults):

| Service   | URL                                       |
| --------- | ----------------------------------------- |
| Frontend  | http://localhost:3000                     |
| Backend   | http://localhost:4000/api/v1              |
| Health    | http://localhost:4000/api/v1/health       |
| Postgres  | localhost:5432 (user `postgres`)          |

Tear down:

```bash
docker compose down              # keeps the pgdata volume
docker compose down -v           # also wipes the database volume
```

---

## Quick start — local dev (no Docker for app code)

Run Postgres in Docker, but the API and frontend on your host with hot reload.

```bash
# 1. Just the database
docker compose up -d postgres

# 2. Backend
cd server
cp .env.example .env       # set DATABASE_URL, JWT_SECRET
npm install
npm run prisma:migrate -- --name init   # first time only
npm run seed                              # creates the superadmin
npm run dev                               # nodemon on :4000

# 3. Frontend (new terminal)
cd cms
cp .env.example .env       # set VITE_API_BASE_URL=http://localhost:4000/api/v1
npm install
npm run dev                               # vite on :5173
```


---

## Database operations

All commands run from `server/`. In Docker, prefix with
`docker compose exec backend ...`.

```bash
# Create a new migration from schema changes (dev only)
npm run prisma:migrate -- --name <change_name>

# Apply pending migrations (used in CI/CD and the migrator container)
npm run prisma:deploy

# Open Prisma Studio against the configured DATABASE_URL
npm run prisma:studio

# Re-run the seed (idempotent — skips if the superadmin already exists)
npm run seed
```

To run a fresh migration against the dockerized database from your host:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/donation_platform \
  npm --prefix server run prisma:migrate -- --name <change_name>
```

---

## Environment variables

| Variable                   | Where        | Notes                                                   |
| -------------------------- | ------------ | ------------------------------------------------------- |
| `DATABASE_URL`             | server       | Postgres connection string.                             |
| `JWT_SECRET`               | server       | Long random string. **Required in production.**         |
| `JWT_EXPIRES_IN`           | server       | e.g. `1d`, `12h`.                                       |
| `BCRYPT_SALT_ROUNDS`       | server       | Default `10`.                                           |
| `CORS_ORIGIN`              | server       | Comma-separated allowlist.                              |
| `LOG_LEVEL`                | server       | `debug` in dev, `info` in prod.                         |
| `RATE_LIMIT_WINDOW_MS`     | server       | Global limiter window.                                  |
| `RATE_LIMIT_MAX`           | server       | Requests per window.                                    |
| `SEED_SUPERADMIN_EMAIL`    | server seed  | Used once by `prisma/seed.js`.                          |
| `SEED_SUPERADMIN_PASSWORD` | server seed  | Used once by `prisma/seed.js`.                          |
| `VITE_API_BASE_URL`        | cms (build)  | Must include `/api/v1`. Baked in at `npm run build`.    |
| `POSTGRES_*`               | compose      | DB credentials for the `postgres` service.              |

See `server/.env.example`, `cms/.env.example`, and the root `.env.example`.

---

## Deploying to AWS

The same `docker-compose.yml` runs unchanged on a single EC2 / Lightsail
instance. For larger deployments, split the services across ECS/Fargate +
RDS.

**Single-host (EC2) recipe:**

```bash
# On the instance, after installing docker + docker compose plugin
git clone <this repo> && cd <repo>
cp .env.example .env
# Edit .env — set NODE_ENV=production, real JWT_SECRET, real superadmin
# password, CORS_ORIGIN=https://your-domain, VITE_API_BASE_URL=https://api...

docker compose pull || true
docker compose up -d --build
```

Put nginx or an ALB in front for TLS termination, point it at ports 3000
(frontend) and 4000 (backend), and you're done.

**Managed Postgres (RDS / Aurora):**

1. Remove or stop the `postgres` and `migrator` services.
2. Set `DATABASE_URL` to your RDS connection string.
3. Run migrations once from a CI job or a bastion:
   `npx prisma migrate deploy` from inside the backend image.

---

## Useful commands

```bash
# Stack management
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose exec backend sh

# Reset everything locally (DESTROYS DB)
docker compose down -v && docker compose up -d --build
```

---

## Troubleshooting

- **`migrator` exits with `P1001`** — Postgres isn't reachable yet. The
  healthcheck normally handles this; if it persists, check `POSTGRES_*`
  credentials in `.env`.
- **Frontend hits `localhost:4000` from a deployed host** — you forgot to
  rebuild the frontend with the right `VITE_API_BASE_URL`. It's a build-time
  value, not runtime.
- **`prisma migrate dev` refuses on a non-empty DB** — use
  `prisma migrate deploy` instead; `dev` is for local schema iteration only.
- **401 on every request after login** — make sure `CORS_ORIGIN` includes
  the exact origin of the frontend (scheme + host + port).
