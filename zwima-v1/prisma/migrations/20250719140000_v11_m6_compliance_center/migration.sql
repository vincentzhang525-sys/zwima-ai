-- V1.1 M6 Runtime EU AI Act Compliance Center (additive)
-- Adds runtime AI event capture, immutable audit trail, human review workflow,
-- processing region registry, compliance policy resolution, retention policy,
-- disclaimer versions and report export tracking. Purely additive: no existing
-- tables/columns are dropped or altered.

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "AIEventStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'BLOCKED');

CREATE TYPE "ComplianceRiskCategory" AS ENUM ('MINIMAL', 'LIMITED', 'HIGH', 'PROHIBITED', 'UNCLASSIFIED');

CREATE TYPE "TransparencyLevel" AS ENUM ('NONE', 'BASIC', 'STANDARD', 'ENHANCED');

CREATE TYPE "HumanReviewMode" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED', 'MANDATORY');

CREATE TYPE "HumanReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WAIVED');

CREATE TYPE "CompliancePolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE TYPE "RegionGroup" AS ENUM ('GERMANY', 'EU_EEA', 'US', 'APAC', 'OTHER');

CREATE TYPE "ComplianceEnvironmentType" AS ENUM ('PRODUCTION', 'PREVIEW', 'DEVELOPMENT', 'TEST');

CREATE TYPE "ComplianceEventSource" AS ENUM ('API', 'PLAYGROUND', 'ADMIN_MOCK', 'SYSTEM', 'INTERNAL');

CREATE TYPE "ComplianceTaskType" AS ENUM ('CHAT', 'COMPLETION', 'EMBEDDING', 'IMAGE', 'AUDIO', 'TOOL', 'OTHER');

CREATE TYPE "HumanReviewPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- ── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE "ProcessingRegionRegistry" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "countryCode" TEXT,
  "regionGroup" "RegionGroup" NOT NULL,
  "isEuEea" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "dataResidencySupported" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcessingRegionRegistry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderRegionCapability" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "registryEntryId" TEXT,
  "regionId" TEXT NOT NULL,
  "supportsInference" BOOLEAN NOT NULL DEFAULT true,
  "supportsProcessing" BOOLEAN NOT NULL DEFAULT true,
  "supportsDataResidency" BOOLEAN NOT NULL DEFAULT false,
  "crossBorderTransfer" BOOLEAN NOT NULL DEFAULT false,
  "transferMechanism" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderRegionCapability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompliancePolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "CompliancePolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "riskCategoryDefault" "ComplianceRiskCategory" NOT NULL DEFAULT 'LIMITED',
  "reviewModeDefault" "HumanReviewMode" NOT NULL DEFAULT 'OPTIONAL',
  "transparencyLevelDefault" "TransparencyLevel" NOT NULL DEFAULT 'BASIC',
  "requireAiNotice" BOOLEAN NOT NULL DEFAULT true,
  "requireGeneratedContentFlag" BOOLEAN NOT NULL DEFAULT true,
  "requireHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "requireEuProcessing" BOOLEAN NOT NULL DEFAULT false,
  "allowCrossBorderTransfer" BOOLEAN NOT NULL DEFAULT true,
  "allowedRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blockedProviders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blockedModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "retentionDays" INTEGER NOT NULL DEFAULT 365,
  "storePromptHash" BOOLEAN NOT NULL DEFAULT true,
  "storeResponseHash" BOOLEAN NOT NULL DEFAULT true,
  "storeTokenMetadata" BOOLEAN NOT NULL DEFAULT true,
  "storeCostMetadata" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompliancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "retentionDays" INTEGER NOT NULL,
  "anonymizeAfterDays" INTEGER,
  "deleteAfterDays" INTEGER,
  "appliesTo" TEXT NOT NULL DEFAULT 'AI_EVENT',
  "status" "CompliancePolicyStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceDisclaimerVersion" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "CompliancePolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceDisclaimerVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT,
  "apiKeyId" TEXT,
  "projectId" TEXT,
  "parentEventId" TEXT,
  "workflowRunId" TEXT,
  "agentRunId" TEXT,
  "stepId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL DEFAULT '',
  "requestedModel" TEXT,
  "resolvedModel" TEXT,
  "migrationReason" TEXT,
  "migrationPolicyId" TEXT,
  "registryEntryId" TEXT,
  "priceVersionId" TEXT,
  "costProfileId" TEXT,
  "taskType" "ComplianceTaskType" NOT NULL DEFAULT 'CHAT',
  "requestType" TEXT NOT NULL DEFAULT 'chat',
  "eventSource" "ComplianceEventSource" NOT NULL DEFAULT 'API',
  "environment" "ComplianceEnvironmentType" NOT NULL DEFAULT 'PRODUCTION',
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
  "toolCallCount" INTEGER NOT NULL DEFAULT 0,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER,
  "status" "AIEventStatus" NOT NULL DEFAULT 'PENDING',
  "errorCode" TEXT,
  "errorCategory" TEXT,
  "inferenceRegion" TEXT,
  "processingRegion" TEXT,
  "dataResidencyRegion" TEXT,
  "providerRegion" TEXT,
  "generatedByAI" BOOLEAN NOT NULL DEFAULT true,
  "generatedContentFlag" BOOLEAN NOT NULL DEFAULT true,
  "humanAssisted" BOOLEAN NOT NULL DEFAULT false,
  "riskCategory" "ComplianceRiskCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
  "transparencyLevel" "TransparencyLevel" NOT NULL DEFAULT 'BASIC',
  "reviewStatus" "HumanReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewMode" "HumanReviewMode" NOT NULL DEFAULT 'NONE',
  "promptHash" TEXT,
  "responseHash" TEXT,
  "promptFingerprintVersion" TEXT NOT NULL DEFAULT 'v1',
  "responseFingerprintVersion" TEXT NOT NULL DEFAULT 'v1',
  "usageLogId" TEXT,
  "costCalculationId" TEXT,
  "billingTransactionId" TEXT,
  "auditLogId" TEXT,
  "policyVersion" TEXT,
  "disclaimerVersion" TEXT,
  "retentionPolicyId" TEXT,
  "estimatedCost" DECIMAL(14,6),
  "actualCost" DECIMAL(14,6),
  "grossMargin" DECIMAL(14,6),
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditRecord" (
  "id" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT,
  "apiKeyId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL DEFAULT '',
  "registryEntryId" TEXT,
  "priceVersionId" TEXT,
  "costProfileId" TEXT,
  "promptHash" TEXT,
  "responseHash" TEXT,
  "processingRegion" TEXT,
  "inferenceRegion" TEXT,
  "dataResidencyRegion" TEXT,
  "riskCategory" "ComplianceRiskCategory" NOT NULL,
  "transparencyLevel" "TransparencyLevel" NOT NULL,
  "generatedByAI" BOOLEAN NOT NULL DEFAULT true,
  "generatedContentFlag" BOOLEAN NOT NULL DEFAULT true,
  "reviewMode" "HumanReviewMode" NOT NULL,
  "reviewStatus" "HumanReviewStatus" NOT NULL,
  "humanReviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "estimatedCost" DECIMAL(14,6),
  "actualCost" DECIMAL(14,6),
  "grossMargin" DECIMAL(14,6),
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
  "toolCallCount" INTEGER NOT NULL DEFAULT 0,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER,
  "policyVersion" TEXT,
  "disclaimerVersion" TEXT,
  "retentionPolicyId" TEXT,
  "integrityHash" TEXT NOT NULL,
  "previousIntegrityHash" TEXT,
  "anonymizedAt" TIMESTAMP(3),
  "sealed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAuditRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanReviewCase" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "reviewMode" "HumanReviewMode" NOT NULL,
  "status" "HumanReviewStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "HumanReviewPriority" NOT NULL DEFAULT 'NORMAL',
  "reason" TEXT NOT NULL,
  "assignedReviewerId" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HumanReviewCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanReviewHistory" (
  "id" TEXT NOT NULL,
  "reviewCaseId" TEXT NOT NULL,
  "fromStatus" "HumanReviewStatus" NOT NULL,
  "toStatus" "HumanReviewStatus" NOT NULL,
  "actorId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanReviewHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceReportExport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "format" TEXT NOT NULL,
  "filters" JSONB,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdBy" TEXT,
  "fileName" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceReportExport_pkey" PRIMARY KEY ("id")
);

-- ── Unique constraints / indexes ───────────────────────────────────────────

CREATE UNIQUE INDEX "ProcessingRegionRegistry_code_key" ON "ProcessingRegionRegistry"("code");
CREATE INDEX "ProcessingRegionRegistry_regionGroup_isActive_idx" ON "ProcessingRegionRegistry"("regionGroup", "isActive");
CREATE INDEX "ProcessingRegionRegistry_isEuEea_isActive_idx" ON "ProcessingRegionRegistry"("isEuEea", "isActive");

CREATE INDEX "ProviderRegionCapability_provider_regionId_isActive_idx" ON "ProviderRegionCapability"("provider", "regionId", "isActive");
CREATE INDEX "ProviderRegionCapability_registryEntryId_isActive_idx" ON "ProviderRegionCapability"("registryEntryId", "isActive");
CREATE INDEX "ProviderRegionCapability_effectiveFrom_effectiveTo_idx" ON "ProviderRegionCapability"("effectiveFrom", "effectiveTo");

CREATE UNIQUE INDEX "CompliancePolicy_organizationId_workspaceId_version_key" ON "CompliancePolicy"("organizationId", "workspaceId", "version");
CREATE INDEX "CompliancePolicy_status_effectiveFrom_idx" ON "CompliancePolicy"("status", "effectiveFrom");
CREATE INDEX "CompliancePolicy_organizationId_workspaceId_status_idx" ON "CompliancePolicy"("organizationId", "workspaceId", "status");

CREATE UNIQUE INDEX "RetentionPolicy_name_version_key" ON "RetentionPolicy"("name", "version");
CREATE INDEX "RetentionPolicy_status_idx" ON "RetentionPolicy"("status");

CREATE UNIQUE INDEX "ComplianceDisclaimerVersion_version_locale_key" ON "ComplianceDisclaimerVersion"("version", "locale");
CREATE INDEX "ComplianceDisclaimerVersion_status_locale_effectiveFrom_idx" ON "ComplianceDisclaimerVersion"("status", "locale", "effectiveFrom");

CREATE UNIQUE INDEX "AIEvent_eventId_key" ON "AIEvent"("eventId");
CREATE UNIQUE INDEX "AIEvent_requestId_key" ON "AIEvent"("requestId");
CREATE INDEX "AIEvent_organizationId_createdAt_idx" ON "AIEvent"("organizationId", "createdAt");
CREATE INDEX "AIEvent_workspaceId_createdAt_idx" ON "AIEvent"("workspaceId", "createdAt");
CREATE INDEX "AIEvent_correlationId_idx" ON "AIEvent"("correlationId");
CREATE INDEX "AIEvent_idempotencyKey_idx" ON "AIEvent"("idempotencyKey");
CREATE INDEX "AIEvent_provider_model_createdAt_idx" ON "AIEvent"("provider", "model", "createdAt");
CREATE INDEX "AIEvent_status_riskCategory_reviewStatus_idx" ON "AIEvent"("status", "riskCategory", "reviewStatus");
CREATE INDEX "AIEvent_processingRegion_createdAt_idx" ON "AIEvent"("processingRegion", "createdAt");
CREATE INDEX "AIEvent_usageLogId_idx" ON "AIEvent"("usageLogId");
CREATE INDEX "AIEvent_costCalculationId_idx" ON "AIEvent"("costCalculationId");

CREATE UNIQUE INDEX "ComplianceAuditRecord_auditId_key" ON "ComplianceAuditRecord"("auditId");
CREATE UNIQUE INDEX "ComplianceAuditRecord_eventId_key" ON "ComplianceAuditRecord"("eventId");
CREATE INDEX "ComplianceAuditRecord_organizationId_createdAt_idx" ON "ComplianceAuditRecord"("organizationId", "createdAt");
CREATE INDEX "ComplianceAuditRecord_workspaceId_createdAt_idx" ON "ComplianceAuditRecord"("workspaceId", "createdAt");
CREATE INDEX "ComplianceAuditRecord_requestId_idx" ON "ComplianceAuditRecord"("requestId");
CREATE INDEX "ComplianceAuditRecord_riskCategory_reviewStatus_idx" ON "ComplianceAuditRecord"("riskCategory", "reviewStatus");

CREATE UNIQUE INDEX "HumanReviewCase_caseId_key" ON "HumanReviewCase"("caseId");
CREATE INDEX "HumanReviewCase_organizationId_status_createdAt_idx" ON "HumanReviewCase"("organizationId", "status", "createdAt");
CREATE INDEX "HumanReviewCase_workspaceId_status_idx" ON "HumanReviewCase"("workspaceId", "status");
CREATE INDEX "HumanReviewCase_assignedReviewerId_status_idx" ON "HumanReviewCase"("assignedReviewerId", "status");

CREATE INDEX "HumanReviewHistory_reviewCaseId_createdAt_idx" ON "HumanReviewHistory"("reviewCaseId", "createdAt");

CREATE INDEX "ComplianceReportExport_organizationId_createdAt_idx" ON "ComplianceReportExport"("organizationId", "createdAt");

-- ── Foreign keys ────────────────────────────────────────────────────────────

ALTER TABLE "ProviderRegionCapability" ADD CONSTRAINT "ProviderRegionCapability_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "ProcessingRegionRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceAuditRecord" ADD CONSTRAINT "ComplianceAuditRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AIEvent"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HumanReviewCase" ADD CONSTRAINT "HumanReviewCase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AIEvent"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HumanReviewHistory" ADD CONSTRAINT "HumanReviewHistory_reviewCaseId_fkey" FOREIGN KEY ("reviewCaseId") REFERENCES "HumanReviewCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
