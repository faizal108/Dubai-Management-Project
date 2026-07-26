// Donation Management Platform — Azure Container Apps infrastructure.
//
// Deployed with `az deployment group create` against a resource group that
// already exists (created by scripts/azure-bootstrap.sh). See
// infra/README.md for the full first-time setup + parameter list.
//
// Layout: one Container Apps Environment holding two apps (backend, frontend)
// and one Job (migrate + seed), backed by Azure Database for PostgreSQL
// Flexible Server and an Azure Container Registry.

@description('Azure region for all resources.')
param location string = resourceGroup().location

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

@description('Seed superadmin email, used only by the migration job on first run.')
param seedSuperadminEmail string = 'superadmin@example.com'

@secure()
@description('Seed superadmin password, used only by the migration job on first run.')
param seedSuperadminPassword string

@description('Full ACR image reference for the backend, e.g. myacr.azurecr.io/donation-backend:sha-abcdef. Defaults to a public placeholder for first-time bootstrap before any image has been pushed.')
param backendImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Full ACR image reference for the frontend. Defaults to a public placeholder for first-time bootstrap.')
param frontendImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Extra allowed CORS origins for the backend, comma-separated (the frontend app URL is always included automatically).')
param extraCorsOrigins string = ''

var acrName = toLower('${namePrefix}acr${uniqueString(resourceGroup().id)}')
var postgresServerName = toLower('${namePrefix}-psql-${uniqueString(resourceGroup().id)}')
var logAnalyticsName = '${namePrefix}-logs'
var containerAppsEnvName = '${namePrefix}-env'
var backendAppName = '${namePrefix}-backend'
var frontendAppName = '${namePrefix}-frontend'
var migrationJobName = '${namePrefix}-migrate'

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

// MVP simplification: Container Apps has no fixed outbound IP unless
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
// Log Analytics + Container Apps Environment
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Backend Container App
// ---------------------------------------------------------------------------
resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 4000
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url', value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?schema=public&sslmode=require' }
        { name: 'jwt-secret', value: jwtSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '4000' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'JWT_EXPIRES_IN', value: '1d' }
            { name: 'BCRYPT_SALT_ROUNDS', value: '10' }
            { name: 'CORS_ORIGIN', value: empty(extraCorsOrigins) ? 'https://${frontendAppName}.${containerAppsEnv.properties.defaultDomain}' : 'https://${frontendAppName}.${containerAppsEnv.properties.defaultDomain},${extraCorsOrigins}' }
            { name: 'LOG_LEVEL', value: 'info' }
            { name: 'RATE_LIMIT_WINDOW_MS', value: '60000' }
            { name: 'RATE_LIMIT_MAX', value: '300' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
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
// Frontend Container App
// ---------------------------------------------------------------------------
resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: frontendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
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
// Migration Job (prisma migrate deploy && seed) — reuses the backend image.
// Triggered manually by GitHub Actions after every backend deploy via
// `az containerapp job start`.
// ---------------------------------------------------------------------------
resource migrationJob 'Microsoft.App/jobs@2024-03-01' = {
  name: migrationJobName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnv.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url', value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?schema=public&sslmode=require' }
        { name: 'seed-superadmin-password', value: seedSuperadminPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: backendImage
          command: [ 'sh', '-c', 'npx prisma migrate deploy && node prisma/seed.js' ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'SEED_SUPERADMIN_EMAIL', value: seedSuperadminEmail }
            { name: 'SEED_SUPERADMIN_PASSWORD', secretRef: 'seed-superadmin-password' }
            { name: 'BCRYPT_SALT_ROUNDS', value: '10' }
          ]
        }
      ]
    }
  }
}

resource migrationJobAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, migrationJob.id, 'AcrPull')
  scope: acr
  properties: {
    principalId: migrationJob.identity.principalId
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
output migrationJobName string = migrationJob.name
output backendFqdn string = backendApp.properties.configuration.ingress.fqdn
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn
output backendApiBaseUrl string = 'https://${backendApp.properties.configuration.ingress.fqdn}/api/v1'
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
