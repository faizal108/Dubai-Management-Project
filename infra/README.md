# Azure App Service (Linux containers) deployment

Architecture: one App Service Plan hosting two Web Apps for Containers
(backend, frontend), an Azure Database for PostgreSQL Flexible Server, and
an Azure Container Registry. GitHub Actions builds and deploys on every push
to `main` that touches `server/**` or `cms/**` (see
`.github/workflows/deploy.yml`).

This uses App Service rather than Azure Container Apps because this
subscription is capped at **1 Container Apps Environment total** (a
subscription-wide limit, not per-region) and that slot is already used by an
unrelated app on the same subscription. App Service has no equivalent cap
and shares nothing with it — separate resource group, separate compute,
separate identity/RBAC.

The frontend calls the backend directly over HTTPS (no reverse proxy) — the
backend's public URL is baked into the frontend bundle at build time via
`VITE_API_BASE_URL`, and the backend's `CORS_ORIGIN` is set to the frontend's
URL.

**Migrations**: App Service has no one-shot "Job" primitive like Container
Apps does. Instead, the backend's `RUN_MIGRATIONS_ON_START` and
`RUN_SEED_ON_START` app settings are both `true` (see
`server/docker/entrypoint.sh`) — `prisma migrate deploy` and `prisma/seed.js`
are both idempotent, so running them on every container start/restart is
safe and requires no separate step.

## Prerequisites

- Azure CLI (`az`) logged in (`az login`) to the subscription you're deploying
  into.
- `jq` installed (the bootstrap script parses `az` JSON output with it).
- GitHub CLI (`gh`) logged in, optional but recommended — the bootstrap script
  pushes repo variables automatically if `gh` is available; otherwise it
  prints them for you to add by hand.
- This repo pushed to GitHub already (or push it right after bootstrapping).

## One-time setup

1. Pick values and export them:

   ```bash
   export GITHUB_REPO="your-org/Donation-Management-Project"    # owner/repo
   export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 24)"
   export JWT_SECRET="$(openssl rand -base64 32)"
   export SEED_SUPERADMIN_PASSWORD="$(openssl rand -base64 18)"

   # Optional overrides (defaults shown):
   # export RESOURCE_GROUP="rg-donation-platform"
   # export LOCATION="centralindia"          # ACR + Postgres region. South
                                               # India is offer-restricted for
                                               # Postgres Flexible Server on
                                               # some subscriptions — check
                                               # with `az postgres
                                               # flexible-server list-skus
                                               # --location <region>` first.
   # export APP_SERVICE_LOCATION="centralindia" # App Service Plan + Web Apps
                                               # region, independent of
                                               # LOCATION. Set this to a
                                               # different region (e.g.
                                               # southindia) if you hit
                                               # "No available instances to
                                               # satisfy this request" — that's
                                               # a transient regional capacity
                                               # shortage for Linux App
                                               # Service, not specific to your
                                               # subscription. Cross-region
                                               # from Postgres is fine;
                                               # Postgres is a public SSL
                                               # endpoint reachable from
                                               # anywhere.
   # export NAME_PREFIX="donation"
   ```

   Save `POSTGRES_ADMIN_PASSWORD` and `SEED_SUPERADMIN_PASSWORD` in your
   password manager now — the script does not store them anywhere.

2. Run the bootstrap script from the repo root:

   ```bash
   ./scripts/azure-bootstrap.sh
   ```

   This creates the resource group, deploys `infra/main.bicep` (ACR, Postgres,
   one App Service Plan, both Web Apps on a placeholder image), registers an
   Azure AD app with a GitHub OIDC federated credential scoped to `push` on
   `main`, grants it `AcrPush` (on the registry) and `Website Contributor`
   (on the resource group), and pushes the resulting IDs/URLs as GitHub
   Actions **repo variables** (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
   `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `ACR_LOGIN_SERVER`,
   `ACR_NAME`, `BACKEND_APP_NAME`, `FRONTEND_APP_NAME`,
   `BACKEND_API_BASE_URL`).

   None of these are secret values — they're identifiers/URLs, safe as plain
   repo variables. There are no long-lived Azure credentials in GitHub at all
   because auth uses OIDC.

   Web App hostnames (`*.azurewebsites.net`) are globally unique across all
   of Azure, not just this subscription, so the Bicep appends a
   `uniqueString()` suffix to the app names — expect names like
   `donation-backend-a1b2c3d4e5f6` rather than a clean `donation-backend`.

3. Push to `main` (or merge a PR into it). The `deploy.yml` workflow builds
   whichever side changed, pushes to ACR, updates the matching Web App's
   container image, restarts it, and (for backend changes) polls
   `/api/v1/health` until it comes back up — replacing the
   `mcr.microsoft.com/appsvc/staticsite` placeholder from step 2.

4. Log into the app with `SEED_SUPERADMIN_EMAIL` (default
   `superadmin@example.com`) and the `SEED_SUPERADMIN_PASSWORD` you set above,
   then change the password from the UI.

## Day-to-day

- Push to `main` → CI builds/pushes/deploys automatically. Changing only
  `cms/**` redeploys just the frontend; only `server/**` redeploys the
  backend (migrations run automatically on that restart).
- New Prisma migration: same as local — `npx prisma migrate dev --name X`
  from `server/`, commit the generated migration under
  `server/prisma/migrations/`, push. The next backend deploy applies it via
  the startup `prisma migrate deploy`.
- Logs: `az webapp log tail --name <app> --resource-group rg-donation-platform`.
- Manual rollback: rebuild/push the previous commit's image tag, or
  ```bash
  az webapp config container set --name <app> --resource-group rg-donation-platform \
    --docker-custom-image-name <acr-login-server>/<image>:<previous-sha>
  az webapp restart --name <app> --resource-group rg-donation-platform
  ```

## Known simplifications (revisit before this is a serious production target)

- **Postgres firewall**: the Bicep opens the DB to all Azure-internal traffic
  (`0.0.0.0`–`0.0.0.0`, Azure's "allow Azure services" rule) because App
  Service has no fixed outbound IP without VNet integration. Harden by adding
  VNet integration + a private-only firewall rule.
- **App settings** (DB URL, JWT secret) are stored as plain App Service
  settings, not Key Vault. Fine for a single environment; move to Key Vault +
  managed-identity references if you add staging/prod separation or need
  audited secret access.
- **No staging slot** — every push to `main` goes straight to the one
  environment. App Service supports deployment slots (e.g. a `staging` slot
  with swap) if you want a gate later — cheap to add on top of this Bicep.
- **Single Postgres server, no read replica/HA** — `highAvailability.mode` is
  `Disabled` to keep cost down (Burstable tier doesn't support zone-redundant
  HA anyway). Revisit the SKU before real donor/financial data goes in.
- **Migrations run on every restart**, not just when there's a new
  migration — harmless (idempotent) but means a restart for an unrelated
  reason (scaling, a manual reboot) also re-runs `prisma migrate deploy` and
  the seed check. Fine at this scale; worth a dedicated one-shot mechanism
  (e.g. Azure Automation runbook or a manual `az webapp ssh` step) if startup
  time ever matters.
