-- M11 Digital Infrastructure (additive only)
-- No DROP / TRUNCATE / DELETE / RESET

DO $$ BEGIN CREATE TYPE "InfrastructureEnvironmentType" AS ENUM ('DEVELOPMENT', 'PREVIEW', 'PRODUCTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InfrastructureEnvironmentStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'MAINTENANCE', 'DISABLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InfrastructureServiceType" AS ENUM ('DATABASE', 'AUTH', 'PROVIDER', 'BILLING', 'COMPLIANCE', 'AGENT', 'WORKFLOW', 'OBSERVABILITY', 'QUEUE', 'CACHE', 'EMAIL', 'FEATURE_FLAGS', 'APP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InfrastructureServiceStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'DISABLED', 'UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InfrastructureHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DeploymentReleaseStatus" AS ENUM ('PENDING', 'GATING', 'APPROVED', 'BLOCKED', 'READY', 'FAILED', 'ROLLED_BACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DeploymentGateStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InfrastructureIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InfrastructureIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'MITIGATING', 'RESOLVED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED', 'DEAD_LETTER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BackupRecordStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RestoreDrillStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'AWAITING_APPROVAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProviderSecretReferenceStatus" AS ENUM ('PRESENT', 'MISSING', 'INVALID_FORMAT', 'ROTATION_DUE', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "InfrastructureEnvironment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InfrastructureEnvironmentType" NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'eu-west-1',
    "status" "InfrastructureEnvironmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isProduction" BOOLEAN NOT NULL DEFAULT false,
    "configurationVersion" TEXT NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfrastructureEnvironment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InfrastructureEnvironment_name_type_key" ON "InfrastructureEnvironment"("name", "type");
CREATE INDEX IF NOT EXISTS "InfrastructureEnvironment_type_status_idx" ON "InfrastructureEnvironment"("type", "status");
CREATE INDEX IF NOT EXISTS "InfrastructureEnvironment_isProduction_idx" ON "InfrastructureEnvironment"("isProduction");

CREATE TABLE IF NOT EXISTS "InfrastructureService" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "serviceType" "InfrastructureServiceType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "region" TEXT,
    "endpointHash" TEXT,
    "status" "InfrastructureServiceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "healthStatus" "InfrastructureHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfrastructureService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InfrastructureService_environmentId_serviceType_provider_key" ON "InfrastructureService"("environmentId", "serviceType", "provider");
CREATE INDEX IF NOT EXISTS "InfrastructureService_environmentId_healthStatus_idx" ON "InfrastructureService"("environmentId", "healthStatus");
CREATE INDEX IF NOT EXISTS "InfrastructureService_serviceType_status_idx" ON "InfrastructureService"("serviceType", "status");

CREATE TABLE IF NOT EXISTS "InfrastructureHealthCheck" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "serviceId" TEXT,
    "checkType" TEXT NOT NULL,
    "status" "InfrastructureHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latencyMs" INTEGER,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfrastructureHealthCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InfrastructureHealthCheck_environmentId_checkedAt_idx" ON "InfrastructureHealthCheck"("environmentId", "checkedAt");
CREATE INDEX IF NOT EXISTS "InfrastructureHealthCheck_serviceId_checkedAt_idx" ON "InfrastructureHealthCheck"("serviceId", "checkedAt");
CREATE INDEX IF NOT EXISTS "InfrastructureHealthCheck_checkType_checkedAt_idx" ON "InfrastructureHealthCheck"("checkType", "checkedAt");

CREATE TABLE IF NOT EXISTS "DeploymentRelease" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "commitHash" TEXT,
    "version" TEXT,
    "status" "DeploymentReleaseStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rollbackOfReleaseId" TEXT,
    "metadata" JSONB,
    CONSTRAINT "DeploymentRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeploymentRelease_environmentId_deploymentId_key" ON "DeploymentRelease"("environmentId", "deploymentId");
CREATE INDEX IF NOT EXISTS "DeploymentRelease_environmentId_startedAt_idx" ON "DeploymentRelease"("environmentId", "startedAt");
CREATE INDEX IF NOT EXISTS "DeploymentRelease_status_startedAt_idx" ON "DeploymentRelease"("status", "startedAt");

CREATE TABLE IF NOT EXISTS "DeploymentGateResult" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "gateName" TEXT NOT NULL,
    "status" "DeploymentGateStatus" NOT NULL DEFAULT 'PENDING',
    "evidencePath" TEXT,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentGateResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeploymentGateResult_releaseId_gateName_key" ON "DeploymentGateResult"("releaseId", "gateName");
CREATE INDEX IF NOT EXISTS "DeploymentGateResult_releaseId_status_idx" ON "DeploymentGateResult"("releaseId", "status");

CREATE TABLE IF NOT EXISTS "InfrastructureIncident" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "severity" "InfrastructureIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "InfrastructureIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "rootCause" TEXT,
    "rollbackPerformed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InfrastructureIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InfrastructureIncident_environmentId_status_detectedAt_idx" ON "InfrastructureIncident"("environmentId", "status", "detectedAt");
CREATE INDEX IF NOT EXISTS "InfrastructureIncident_severity_status_idx" ON "InfrastructureIncident"("severity", "status");

CREATE TABLE IF NOT EXISTS "InfrastructureAuditEvent" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "result" TEXT NOT NULL,
    "integrityHash" TEXT NOT NULL,
    "previousIntegrityHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfrastructureAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InfrastructureAuditEvent_environmentId_createdAt_idx" ON "InfrastructureAuditEvent"("environmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "InfrastructureAuditEvent_action_createdAt_idx" ON "InfrastructureAuditEvent"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "InfrastructureAuditEvent_integrityHash_idx" ON "InfrastructureAuditEvent"("integrityHash");

CREATE TABLE IF NOT EXISTS "BackgroundJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "environmentId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "queueName" TEXT NOT NULL DEFAULT 'default',
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BackgroundJob_environmentId_idempotencyKey_key" ON "BackgroundJob"("environmentId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "BackgroundJob_environmentId_status_scheduledAt_idx" ON "BackgroundJob"("environmentId", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "BackgroundJob_organizationId_status_idx" ON "BackgroundJob"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "BackgroundJob_jobType_status_idx" ON "BackgroundJob"("jobType", "status");
CREATE INDEX IF NOT EXISTS "BackgroundJob_queueName_status_priority_idx" ON "BackgroundJob"("queueName", "status", "priority");

CREATE TABLE IF NOT EXISTS "RateLimitPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL DEFAULT '',
    "requests" INTEGER NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "burst" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimitPolicy_organizationId_scope_subjectType_subjectId_key" ON "RateLimitPolicy"("organizationId", "scope", "subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "RateLimitPolicy_organizationId_enabled_idx" ON "RateLimitPolicy"("organizationId", "enabled");

CREATE TABLE IF NOT EXISTS "BackupRecord" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "status" "BackupRecordStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3),
    "restoreTestedAt" TIMESTAMP(3),
    "checksum" TEXT,
    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BackupRecord_environmentId_startedAt_idx" ON "BackupRecord"("environmentId", "startedAt");
CREATE INDEX IF NOT EXISTS "BackupRecord_status_startedAt_idx" ON "BackupRecord"("status", "startedAt");

CREATE TABLE IF NOT EXISTS "RestoreDrill" (
    "id" TEXT NOT NULL,
    "backupRecordId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" "RestoreDrillStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recoveryPointSeconds" INTEGER,
    "recoveryTimeSeconds" INTEGER,
    "resultSummary" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "RestoreDrill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RestoreDrill_environmentId_startedAt_idx" ON "RestoreDrill"("environmentId", "startedAt");
CREATE INDEX IF NOT EXISTS "RestoreDrill_backupRecordId_startedAt_idx" ON "RestoreDrill"("backupRecordId", "startedAt");
CREATE INDEX IF NOT EXISTS "RestoreDrill_status_idx" ON "RestoreDrill"("status");

CREATE TABLE IF NOT EXISTS "ServiceLevelObjective" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "serviceType" TEXT NOT NULL,
    "availabilityTarget" DOUBLE PRECISION NOT NULL,
    "latencyTargetMs" INTEGER NOT NULL,
    "errorRateTarget" DOUBLE PRECISION NOT NULL,
    "measurementWindow" TEXT NOT NULL DEFAULT '30d',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceLevelObjective_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceLevelObjective_organizationId_enabled_idx" ON "ServiceLevelObjective"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "ServiceLevelObjective_serviceType_enabled_idx" ON "ServiceLevelObjective"("serviceType", "enabled");

CREATE TABLE IF NOT EXISTS "ProviderSecretReference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "environmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secretReference" TEXT NOT NULL,
    "status" "ProviderSecretReferenceStatus" NOT NULL DEFAULT 'MISSING',
    "lastValidatedAt" TIMESTAMP(3),
    "lastRotatedAt" TIMESTAMP(3),
    "rotationDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderSecretReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderSecretReference_environmentId_provider_secretReference_key" ON "ProviderSecretReference"("environmentId", "provider", "secretReference");
CREATE INDEX IF NOT EXISTS "ProviderSecretReference_environmentId_status_idx" ON "ProviderSecretReference"("environmentId", "status");
CREATE INDEX IF NOT EXISTS "ProviderSecretReference_organizationId_provider_idx" ON "ProviderSecretReference"("organizationId", "provider");

DO $$ BEGIN
 ALTER TABLE "InfrastructureService" ADD CONSTRAINT "InfrastructureService_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "InfrastructureHealthCheck" ADD CONSTRAINT "InfrastructureHealthCheck_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "InfrastructureHealthCheck" ADD CONSTRAINT "InfrastructureHealthCheck_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "InfrastructureService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "DeploymentRelease" ADD CONSTRAINT "DeploymentRelease_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "DeploymentRelease" ADD CONSTRAINT "DeploymentRelease_rollbackOfReleaseId_fkey" FOREIGN KEY ("rollbackOfReleaseId") REFERENCES "DeploymentRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "DeploymentGateResult" ADD CONSTRAINT "DeploymentGateResult_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "DeploymentRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "InfrastructureIncident" ADD CONSTRAINT "InfrastructureIncident_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "InfrastructureAuditEvent" ADD CONSTRAINT "InfrastructureAuditEvent_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "RateLimitPolicy" ADD CONSTRAINT "RateLimitPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "RestoreDrill" ADD CONSTRAINT "RestoreDrill_backupRecordId_fkey" FOREIGN KEY ("backupRecordId") REFERENCES "BackupRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "RestoreDrill" ADD CONSTRAINT "RestoreDrill_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "ServiceLevelObjective" ADD CONSTRAINT "ServiceLevelObjective_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "ProviderSecretReference" ADD CONSTRAINT "ProviderSecretReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "ProviderSecretReference" ADD CONSTRAINT "ProviderSecretReference_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "InfrastructureEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
