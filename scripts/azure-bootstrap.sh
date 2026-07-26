#!/usr/bin/env bash
# One-time Azure bootstrap for the Donation Management Platform.
#
# Run this ONCE from a machine with the Azure CLI logged in
# (`az login`) and, ideally, the GitHub CLI logged in (`gh auth login`) so
# secrets/variables can be pushed to the repo automatically. Safe to re-run —
# every step is idempotent (uses `--only-show-errors` + existence checks
# where the CLI doesn't no-op on its own).
#
# What this does:
#   1. Creates the resource group.
#   2. Deploys infra/main.bicep (ACR, Postgres Flexible Server, one App
#      Service Plan hosting backend + frontend Web Apps for Containers on a
#      placeholder image).
#   3. Creates an Azure AD app registration + federated credential so GitHub
#      Actions can authenticate via OIDC (no long-lived secret).
#   4. Grants that app AcrPush on the registry and Website Contributor on the
#      resource group — the minimum needed to build/push images and update
#      the running Web Apps.
#   5. Prints (and, if `gh` is available, pushes) the GitHub secrets/variables
#      the deploy workflow needs.
#
# Required environment variables (export before running, or edit below):
#   GITHUB_REPO                e.g. "your-org/Donation-Management-Project"
#   POSTGRES_ADMIN_PASSWORD    strong password for the Postgres admin login
#   JWT_SECRET                 >=16 chars, random
#   SEED_SUPERADMIN_PASSWORD   initial superadmin login password
#
# Optional overrides:
#   RESOURCE_GROUP      (default: rg-donation-platform)
#   LOCATION            (default: centralindia — used for ACR + Postgres.
#                        South India is offer-restricted for Postgres
#                        Flexible Server on this subscription; Central India
#                        is not.)
#   APP_SERVICE_LOCATION (default: same as LOCATION — override independently
#                        if the App Service Plan hits a transient regional
#                        capacity error like "No available instances to
#                        satisfy this request"; Postgres works fine across
#                        regions from App Service since it's a public SSL
#                        endpoint, so e.g. LOCATION=centralindia +
#                        APP_SERVICE_LOCATION=southindia is a valid split)
#   NAME_PREFIX         (default: donation)

set -euo pipefail

: "${GITHUB_REPO:?Set GITHUB_REPO=owner/repo}"
: "${POSTGRES_ADMIN_PASSWORD:?Set POSTGRES_ADMIN_PASSWORD}"
: "${JWT_SECRET:?Set JWT_SECRET (>=16 chars)}"
: "${SEED_SUPERADMIN_PASSWORD:?Set SEED_SUPERADMIN_PASSWORD}"

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-donation-platform}"
LOCATION="${LOCATION:-centralindia}"
APP_SERVICE_LOCATION="${APP_SERVICE_LOCATION:-$LOCATION}"
NAME_PREFIX="${NAME_PREFIX:-donation}"
APP_DISPLAY_NAME="gh-oidc-${NAME_PREFIX}-deploy"

echo "== 0/5: Resource provider registration (no-op if already registered) =="
for ns in Microsoft.Web Microsoft.DBforPostgreSQL Microsoft.ContainerRegistry; do
  az provider register --namespace "$ns" --only-show-errors -o none
done

echo "== 1/5: Resource group =="
if az group show --name "$RESOURCE_GROUP" --only-show-errors -o none 2>/dev/null; then
  EXISTING_LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv --only-show-errors)
  if [ "$EXISTING_LOCATION" != "$LOCATION" ]; then
    echo "NOTE: $RESOURCE_GROUP already exists in '$EXISTING_LOCATION', not '$LOCATION'."
    echo "The resource group's own location is just metadata — resources below"
    echo "still deploy to \$LOCATION via an explicit Bicep parameter — so this is safe to continue."
  fi
else
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --only-show-errors -o none
fi

echo "== 2/5: Deploying infra/main.bicep =="
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters location="$LOCATION" \
               appServiceLocation="$APP_SERVICE_LOCATION" \
               namePrefix="$NAME_PREFIX" \
               postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD" \
               jwtSecret="$JWT_SECRET" \
               seedSuperadminPassword="$SEED_SUPERADMIN_PASSWORD" \
  --only-show-errors -o json)

ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.acrLoginServer.value')
ACR_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.acrName.value')
BACKEND_APP_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.backendAppName.value')
FRONTEND_APP_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.frontendAppName.value')
BACKEND_API_BASE_URL=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.backendApiBaseUrl.value')
FRONTEND_HOSTNAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.frontendHostname.value')

echo "== 3/5: Azure AD app registration + GitHub OIDC federated credential =="
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

APP_ID=$(az ad app list --display-name "$APP_DISPLAY_NAME" --query "[0].appId" -o tsv --only-show-errors)
if [ -z "$APP_ID" ] || [ "$APP_ID" = "null" ]; then
  APP_ID=$(az ad app create --display-name "$APP_DISPLAY_NAME" --query appId -o tsv --only-show-errors)
fi
az ad sp create --id "$APP_ID" --only-show-errors -o none 2>/dev/null || true

# Federated credential scoped to pushes on main — matches the deploy
# workflow's trigger. Add another block with a different subject
# (e.g. ref:refs/heads/staging or pull_request) if you branch out later.
FED_CRED_NAME="gh-main-branch"
if ! az ad app federated-credential show --id "$APP_ID" --federated-credential-id "$FED_CRED_NAME" --only-show-errors -o none 2>/dev/null; then
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"$FED_CRED_NAME\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" --only-show-errors -o none
fi

echo "== 4/5: Role assignments (least privilege) =="
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv --only-show-errors)
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv --only-show-errors)
RG_ID=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv --only-show-errors)

az role assignment create --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
  --role "AcrPush" --scope "$ACR_ID" --only-show-errors -o none 2>/dev/null || true

az role assignment create --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
  --role "Website Contributor" --scope "$RG_ID" --only-show-errors -o none 2>/dev/null || true

echo "== 5/5: GitHub secrets/variables =="
declare -A GH_VARS=(
  [AZURE_CLIENT_ID]="$APP_ID"
  [AZURE_TENANT_ID]="$TENANT_ID"
  [AZURE_SUBSCRIPTION_ID]="$SUBSCRIPTION_ID"
  [AZURE_RESOURCE_GROUP]="$RESOURCE_GROUP"
  [ACR_LOGIN_SERVER]="$ACR_LOGIN_SERVER"
  [ACR_NAME]="$ACR_NAME"
  [BACKEND_APP_NAME]="$BACKEND_APP_NAME"
  [FRONTEND_APP_NAME]="$FRONTEND_APP_NAME"
  [BACKEND_API_BASE_URL]="$BACKEND_API_BASE_URL"
)

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  for key in "${!GH_VARS[@]}"; do
    gh variable set "$key" --repo "$GITHUB_REPO" --body "${GH_VARS[$key]}"
  done
  echo "GitHub repo variables set on $GITHUB_REPO."
else
  echo "gh CLI not available/authenticated — set these as repo VARIABLES (Settings > Secrets and variables > Actions > Variables) by hand:"
  for key in "${!GH_VARS[@]}"; do
    echo "  $key=${GH_VARS[$key]}"
  done
fi

cat <<EOF

Done.

Frontend will be live at:  https://${FRONTEND_HOSTNAME}
Backend API base URL:      ${BACKEND_API_BASE_URL}

Next steps:
  1. Push this repo to GitHub (if not already) with the .github/workflows/deploy.yml
     from this change included.
  2. The first workflow run on main will build real images, push them, and
     update both Web Apps — replacing the mcr.microsoft.com/appsvc/staticsite
     placeholder used to bootstrap. Migrations + seed run automatically on
     backend container start.
  3. Log into the app with SEED_SUPERADMIN_EMAIL / the SEED_SUPERADMIN_PASSWORD
     you passed to this script, then change it from the UI.

Note: POSTGRES_ADMIN_PASSWORD, JWT_SECRET, and SEED_SUPERADMIN_PASSWORD were
only used for this one deployment — they are not stored anywhere by this
script. Keep them in your password manager; you'll need POSTGRES_ADMIN_PASSWORD
again if you ever re-run this bootstrap or need direct DB access.
EOF
