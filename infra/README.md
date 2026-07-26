# Azure Container Apps deployment

Architecture: two Container Apps (backend, frontend) in one Container Apps
Environment, an Azure Database for PostgreSQL Flexible Server, an Azure
Container Registry, and a Container Apps Job that runs `prisma migrate
deploy && seed`. GitHub Actions builds and deploys on every push to `main`
that touches `server/**` or `cms/**` (see `.github/workflows/deploy.yml`).

The frontend calls the backend directly over HTTPS (no reverse proxy) — the
backend's public URL is baked into the frontend bundle at build time via
`VITE_API_BASE_URL`, and the backend's `CORS_ORIGIN` is set to the frontend's
URL.

## Prerequisites

- Azure CLI (`az`) logged in (`az login`) to the subscription you're deploying
  into, with the Bicep and Container Apps extensions available (recent `az`
  versions include both; if not: `az extension add --name containerapp`).
- `jq` installed (the bootstrap script parses `az` JSON output with it).
- GitHub CLI (`gh`) logged in, optional but recommended — the bootstrap script
  pushes repo variables automatically if `gh` is available; otherwise it
  prints them for you to add by hand.
- This repo pushed to GitHub already (or push it right after bootstrapping).

## One-time setup

1. Pick values and export them:

   ```bash
   export GITHUB_REPO="your-org/Dubai-Management-Project"      # owner/repo
   export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 24)"
   export JWT_SECRET="$(openssl rand -base64 32)"
   export SEED_SUPERADMIN_PASSWORD="$(openssl rand -base64 18)"

   # Optional overrides (defaults shown):
   # export RESOURCE_GROUP="rg-donation-platform"
   # export LOCATION="centralindia"
   # export NAME_PREFIX="donation"
   ```

   Save `POSTGRES_ADMIN_PASSWORD` and `SEED_SUPERADMIN_PASSWORD` in your
   password manager now — the script does not store them anywhere.

2. Run the bootstrap script from the repo root:

   ```bash
   ./scripts/azure-bootstrap.sh
   ```

   This creates the resource group, deploys `infra/main.bicep` (ACR, Postgres,
   Container Apps Environment, both apps on a placeholder image, the
   migration job), registers an Azure AD app with a GitHub OIDC federated
   credential scoped to `push` on `main`, grants it `AcrPush` (on the
   registry) and `Container Apps Contributor` (on the resource group), and
   pushes the resulting IDs/URLs as GitHub Actions **repo variables**
   (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
   `AZURE_RESOURCE_GROUP`, `ACR_LOGIN_SERVER`, `ACR_NAME`, `BACKEND_APP_NAME`,
   `FRONTEND_APP_NAME`, `MIGRATION_JOB_NAME`, `BACKEND_API_BASE_URL`).

   None of these are secret values — they're identifiers/URLs, safe as plain
   repo variables. There are no long-lived Azure credentials in GitHub at all
   because auth uses OIDC.

3. Push to `main` (or merge a PR into it). The `deploy.yml` workflow builds
   whichever side changed, pushes to ACR, updates the Container App, and (for
   backend changes) runs the migration job — replacing the
   `mcr.microsoft.com/k8se/quickstart` placeholder from step 2.

4. Log into the app with `SEED_SUPERADMIN_EMAIL` (default
   `superadmin@example.com`) and the `SEED_SUPERADMIN_PASSWORD` you set above,
   then change the password from the UI.

## Day-to-day

- Push to `main` → CI builds/pushes/deploys automatically. Changing only
  `cms/**` redeploys just the frontend; only `server/**` redeploys the
  backend and re-runs the migration job.
- New Prisma migration: same as local — `npx prisma migrate dev --name X`
  from `server/`, commit the generated migration under
  `server/prisma/migrations/`, push. The next backend deploy runs `prisma
  migrate deploy` via the job.
- Logs: `az containerapp logs show --name <app> --resource-group
  rg-donation-platform --follow`.
- Manual rollback: `az containerapp update --name <app> --resource-group
  rg-donation-platform --image <acr-login-server>/<image>:<previous-sha>`.

## Known simplifications (revisit before this is a serious production target)

- **Postgres firewall**: the Bicep opens the DB to all Azure-internal traffic
  (`0.0.0.0`–`0.0.0.0`, Azure's "allow Azure services" rule) because Container
  Apps has no fixed outbound IP without VNet integration. Harden by adding
  VNet integration to the Container Apps Environment and switching the
  firewall rule to a private-endpoint-only setup.
- **Container App secrets** (DB URL, JWT secret) are stored as Container Apps
  secrets, not Key Vault. Fine for a single environment; move to Key Vault +
  managed-identity references if you add staging/prod separation or need
  audited secret access.
- **No staging slot** — every push to `main` goes straight to the one
  environment. Add a second Container Apps Environment (or a second revision
  with traffic splitting) if you want a staging gate.
- **Single Postgres server, no read replica/HA** — `highAvailability.mode` is
  `Disabled` to keep cost down (Burstable tier doesn't support zone-redundant
  HA anyway). Revisit the SKU before real donor/financial data goes in.
