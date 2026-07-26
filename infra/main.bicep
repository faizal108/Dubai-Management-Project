// Donation Management Platform — Azure App Service (Linux containers) infra.
//
// Deployed with `az deployment group create` against a resource group that
// already exists (created by scripts/azure-bootstrap.sh). See
// infra/README.md for the full first-time setup + parameter list.
//
// Uses App Service for Containers rather than Container Apps because this
// subscription is capped at 1 Container Apps Environment total and that
// slot is already used by an unrelated app — App Service has no such cap
// and shares nothing with it. One App Service Plan hosts two Web Apps
// (backend, frontend); Postgres migrations + seed run automatically on
// every backend container start (RUN_MIGRATIONS_ON_START / RUN_SEED_ON_START,
// both idempotent) since App Service has no one-shot Job primitive.

@description('Azure region for ACR + Postgres.')
param location string = resourceGroup().location

@description('Azure region for the App Service Plan + Web Apps. Separate from `location` because Linux App Service capacity is allocated per-region and can run out independently of Postgres/ACR capacity in the same region — cross-region is fine functionally (Postgres allows public SSL connections from anywhere).')
param appServiceLocation string = location

@description('Short name prefix used to build resource names.')
param namePrefix string = 'donation'

@description('Postgres Flexible Server admin login. Avoid reserved names like "postgres".')
param postgresAdminLogin string = 'pgadmin'

@secure()
@description('Postgres Flexible Server admin password.')
param postgresAdminPassword string

@description('Database name inside the Postgres server.')
param postgresDatabaseName string = 'donation_platform'

@secure()
@description('JWT signing secret for the backend (min 16 chars).')
param jwtSecret string

@description('Seed superadmin email, used only on first backend start.')
param seedSuperadminEmail string = 'superadmin@example.com'

@secure()
@description('Seed superadmin password, used only on first backend start.')
param seedSuperadminPassword string

@description('Backend container image (registry/repo:tag, no DOCKER| prefix). Defaults to a public placeholder for first-time bootstrap before any image has been pushed.')
param backendImage string = 'mcr.microsoft.com/appsvc/staticsite:latest'

@description('Frontend container image (registry/repo:tag). Defaults to a public placeholder for first-time bootstrap.')
param frontendImage string = 'mcr.microsoft.com/appsvc/staticsite:latest'

@description('Extra allowed CORS origins for the backend, comma-separated (the frontend app URL is always included automatically).')
param extraCorsOrigins string = ''

@description('App Service Plan SKU. B1 is the cheapest tier that supports custom Linux containers (F1/shared tiers do not).')
param appServicePlanSku string = 'B1'

var acrName = toLower('${namePrefix}acr${uniqueString(resourceGroup().id)}')
// The 'psql02' salt (bump it again if this ever needs to change) exists
// because Postgres Flexible Server names stay reserved for a cooldown period
// after a failed/deleted server — without a salt, a deterministic name from
// resourceGroup().id alone would keep colliding with an earlier attempt.
var postgresServerName = toLower('${namePrefix}-psql-${uniqueString(resourceGroup().id, 'psql02')}')
var appServicePlanName = '${namePrefix}-plan'
// azurewebsites.net hostnames are globally unique across all of Azure, not
// just this subscription — the uniqueString suffix avoids colliding with
// someone else's app.
var backendAppName = '${namePrefix}-backend-${uniqueString(resourceGroup().id)}'
var frontendAppName = '${namePrefix}-frontend-${uniqueString(resourceGroup().id)}'

// ---------------------------------------------------------------------------
// Container Registry
// ---------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// ---------------------------------------------------------------------------
// Postgres Flexible Server (Burstable B1ms)
// ---------------------------------------------------------------------------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// MVP simplification: App Service has no fixed outbound IP unless
// VNet-integrated, so we allow all Azure-internal traffic to reach the DB.
// Harden later with VNet integration + a private-only firewall rule.
resource postgresFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ---------------------------------------------------------------------------
// App Service Plan — one Linux plan hosts both Web Apps (cheaper than one
// plan per app; B1 has ample headroom for a low-traffic demo).
// ---------------------------------------------------------------------------
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: appServiceLocation
  kind: 'linux'
  sku: {
    name: appServicePlanSku
  }
  properties: {
    reserved: true
  }
}

// ---------------------------------------------------------------------------
// Backend Web App
// ---------------------------------------------------------------------------
resource backendApp 'Microsoft.Web/sites@2023-12-01' = {
  name: backendAppName
  location: appServiceLocation
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${backendImage}'
      acrUseManagedIdentityCreds: true
      healthCheckPath: '/api/v1/health'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '4000' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '4000' }
        // uriComponent() is required here: openssl-generated passwords (base64
        // or similar) can contain '/', '+', '=', '@', etc. — raw-interpolating
        // an unencoded password into a connection string breaks the URL parser
        // (Prisma fails with P1013 "invalid port number" when '/' lands where
        // it expects host:port).
        { name: 'DATABASE_URL', value: 'postgresql://${uriComponent(postgresAdminLogin)}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?schema=public&sslmode=require' }
        { name: 'JWT_SECRET', value: jwtSecret }
        { name: 'JWT_EXPIRES_IN', value: '1d' }
        { name: 'BCRYPT_SALT_ROUNDS', value: '10' }
        { name: 'CORS_ORIGIN', value: empty(extraCorsOrigins) ? 'https://${frontendAppName}.azurewebsites.net' : 'https://${frontendAppName}.azurewebsites.net,${extraCorsOrigins}' }
        { name: 'LOG_LEVEL', value: 'info' }
        { name: 'RATE_LIMIT_WINDOW_MS', value: '60000' }
        { name: 'RATE_LIMIT_MAX', value: '300' }
        { name: 'RUN_MIGRATIONS_ON_START', value: 'true' }
        { name: 'RUN_SEED_ON_START', value: 'true' }
        { name: 'SEED_SUPERADMIN_EMAIL', value: seedSuperadminEmail }
        { name: 'SEED_SUPERADMIN_PASSWORD', value: seedSuperadminPassword }
      ]
    }
  }
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, backendApp.id, 'AcrPull')
  scope: acr
  properties: {
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

// ---------------------------------------------------------------------------
// Frontend Web App
// ---------------------------------------------------------------------------
resource frontendApp 'Microsoft.Web/sites@2023-12-01' = {
  name: frontendAppName
  location: appServiceLocation
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${frontendImage}'
      acrUseManagedIdentityCreds: true
      healthCheckPath: '/'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '80' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
      ]
    }
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, frontendApp.id, 'AcrPull')
  scope: acr
  properties: {
    principalId: frontendApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

// ---------------------------------------------------------------------------
// Outputs — feed these into GitHub Actions repo variables (see infra/README.md)
// ---------------------------------------------------------------------------
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output backendAppName string = backendApp.name
output frontendAppName string = frontendApp.name
output backendHostname string = backendApp.properties.defaultHostName
output frontendHostname string = frontendApp.properties.defaultHostName
output backendApiBaseUrl string = 'https://${backendApp.properties.defaultHostName}/api/v1'
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
