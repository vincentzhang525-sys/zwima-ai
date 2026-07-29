-- V1.1 Frozen Architecture Enhancement (additive only)

-- ModelRegistryEntry lifecycle fields
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "tokenizerVersion" TEXT;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "promotionStartDate" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "promotionEndDate" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "migrationDeadline" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "compatibilityStatus" TEXT;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "migrationGuidanceUrl" TEXT;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "lastLifecycleCheckAt" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "lifecycleSource" TEXT;

-- ModelMigrationPolicy governance fields
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "triggerType" TEXT;
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "notifyBeforeMigration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "requireHumanApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "compatibilityMode" TEXT;
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "fallbackRegistryId" TEXT;
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "ModelMigrationPolicy" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- AIEvent runtime compliance appendages
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "providerName" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "modelId" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "tokenizerVersion" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "toolsCalled" JSONB;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "filesAccessed" JSONB;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "externalActions" JSONB;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "permissionGranted" JSONB;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "humanApprovalRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "humanApprovalStatus" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "humanApprovalId" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "contentLabelRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "contentLabelApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "rollbackAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "rollbackReference" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "taskCostProfileId" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "traceId" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "requestHash" TEXT;
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "eventVersion" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "executionStartedAt" TIMESTAMP(3);
ALTER TABLE "AIEvent" ADD COLUMN IF NOT EXISTS "executionCompletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AIEvent_traceId_idx" ON "AIEvent"("traceId");
CREATE INDEX IF NOT EXISTS "AIEvent_taskCostProfileId_idx" ON "AIEvent"("taskCostProfileId");

-- AgentRun governance fields
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "executionVersion" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "policyVersion" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "runtimeDriftStatus" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "rollbackStatus" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "complianceEventId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "estimatedCostAmount" DECIMAL(14,6);
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "actualCostAmount" DECIMAL(14,6);

-- WorkflowExecution governance fields
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "currentNodeId" TEXT;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMP(3);
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "rollbackAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "rollbackStatus" TEXT;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "agentRunId" TEXT;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "complianceEventId" TEXT;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "effectiveCostAmount" DECIMAL(14,6);

-- WorkflowExecutionStatus enum extensions
ALTER TYPE "WorkflowExecutionStatus" ADD VALUE IF NOT EXISTS 'RETRYING';
ALTER TYPE "WorkflowExecutionStatus" ADD VALUE IF NOT EXISTS 'ROLLING_BACK';
ALTER TYPE "WorkflowExecutionStatus" ADD VALUE IF NOT EXISTS 'ROLLED_BACK';

CREATE TYPE "AgentToolExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'ROLLED_BACK');

CREATE TABLE "TaskCostProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "inputTemplateHash" TEXT,
    "expectedOutputType" TEXT,
    "averageInputTokens" INTEGER NOT NULL,
    "averageOutputTokens" INTEGER NOT NULL,
    "averageCachedInputTokens" INTEGER,
    "averageToolCalls" INTEGER,
    "averageLatencyMs" INTEGER,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCostProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelEffectiveCostSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "providerId" TEXT,
    "registryEntryId" TEXT,
    "modelVersion" TEXT,
    "tokenizerVersion" TEXT,
    "taskCostProfileId" TEXT,
    "standardInputPrice" DECIMAL(14,6) NOT NULL,
    "standardOutputPrice" DECIMAL(14,6) NOT NULL,
    "cachedInputPrice" DECIMAL(14,6),
    "cacheWritePrice" DECIMAL(14,6),
    "batchInputPrice" DECIMAL(14,6),
    "batchOutputPrice" DECIMAL(14,6),
    "promotionInputPrice" DECIMAL(14,6),
    "promotionOutputPrice" DECIMAL(14,6),
    "promotionStartDate" TIMESTAMP(3),
    "promotionEndDate" TIMESTAMP(3),
    "estimatedInputTokens" INTEGER NOT NULL,
    "estimatedOutputTokens" INTEGER NOT NULL,
    "effectiveInputCost" DECIMAL(14,6) NOT NULL,
    "effectiveOutputCost" DECIMAL(14,6) NOT NULL,
    "effectiveCacheCost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "effectiveToolCost" DECIMAL(14,6),
    "effectiveTotalCost" DECIMAL(14,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculationVersion" TEXT NOT NULL DEFAULT 'v1.1',
    "source" TEXT NOT NULL DEFAULT 'synthetic_preview',
    "metadata" JSONB,

    CONSTRAINT "ModelEffectiveCostSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseAIModelScore" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "registryEntryId" TEXT,
    "costScore" DECIMAL(8,4) NOT NULL,
    "latencyScore" DECIMAL(8,4) NOT NULL,
    "qualityScore" DECIMAL(8,4) NOT NULL,
    "availabilityScore" DECIMAL(8,4) NOT NULL,
    "complianceScore" DECIMAL(8,4) NOT NULL,
    "lifecycleScore" DECIMAL(8,4) NOT NULL,
    "concentrationScore" DECIMAL(8,4) NOT NULL,
    "overallScore" DECIMAL(8,4) NOT NULL,
    "calculationVersion" TEXT NOT NULL DEFAULT 'v1.1',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB,

    CONSTRAINT "EnterpriseAIModelScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolVersion" TEXT,
    "toolCategory" TEXT NOT NULL,
    "inputHash" TEXT,
    "outputHash" TEXT,
    "externalSystem" TEXT,
    "processingRegion" TEXT,
    "permissionScope" TEXT,
    "permissionGranted" BOOLEAN NOT NULL DEFAULT false,
    "humanApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "humanApprovalStatus" TEXT,
    "reversible" BOOLEAN NOT NULL DEFAULT false,
    "rollbackReference" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "AgentToolExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AgentToolExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentResourceAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceIdentifierHash" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "processingRegion" TEXT,
    "authorized" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AgentResourceAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowExecutionHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecutionHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskCostProfile_organizationId_active_idx" ON "TaskCostProfile"("organizationId", "active");
CREATE INDEX "TaskCostProfile_organizationId_taskType_idx" ON "TaskCostProfile"("organizationId", "taskType");
CREATE INDEX "ModelEffectiveCostSnapshot_organizationId_calculatedAt_idx" ON "ModelEffectiveCostSnapshot"("organizationId", "calculatedAt");
CREATE INDEX "ModelEffectiveCostSnapshot_registryEntryId_calculatedAt_idx" ON "ModelEffectiveCostSnapshot"("registryEntryId", "calculatedAt");
CREATE INDEX "ModelEffectiveCostSnapshot_taskCostProfileId_idx" ON "ModelEffectiveCostSnapshot"("taskCostProfileId");
CREATE INDEX "EnterpriseAIModelScore_organizationId_calculatedAt_idx" ON "EnterpriseAIModelScore"("organizationId", "calculatedAt");
CREATE INDEX "EnterpriseAIModelScore_organizationId_provider_idx" ON "EnterpriseAIModelScore"("organizationId", "provider");
CREATE INDEX "AgentToolExecution_organizationId_startedAt_idx" ON "AgentToolExecution"("organizationId", "startedAt");
CREATE INDEX "AgentToolExecution_agentRunId_startedAt_idx" ON "AgentToolExecution"("agentRunId", "startedAt");
CREATE INDEX "AgentResourceAccess_organizationId_occurredAt_idx" ON "AgentResourceAccess"("organizationId", "occurredAt");
CREATE INDEX "AgentResourceAccess_agentRunId_occurredAt_idx" ON "AgentResourceAccess"("agentRunId", "occurredAt");
CREATE INDEX "WorkflowExecutionHistory_organizationId_createdAt_idx" ON "WorkflowExecutionHistory"("organizationId", "createdAt");
CREATE INDEX "WorkflowExecutionHistory_workflowRunId_createdAt_idx" ON "WorkflowExecutionHistory"("workflowRunId", "createdAt");

ALTER TABLE "TaskCostProfile" ADD CONSTRAINT "TaskCostProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModelEffectiveCostSnapshot" ADD CONSTRAINT "ModelEffectiveCostSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelEffectiveCostSnapshot" ADD CONSTRAINT "ModelEffectiveCostSnapshot_taskCostProfileId_fkey" FOREIGN KEY ("taskCostProfileId") REFERENCES "TaskCostProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAIModelScore" ADD CONSTRAINT "EnterpriseAIModelScore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentToolExecution" ADD CONSTRAINT "AgentToolExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentToolExecution" ADD CONSTRAINT "AgentToolExecution_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentResourceAccess" ADD CONSTRAINT "AgentResourceAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentResourceAccess" ADD CONSTRAINT "AgentResourceAccess_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecutionHistory" ADD CONSTRAINT "WorkflowExecutionHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecutionHistory" ADD CONSTRAINT "WorkflowExecutionHistory_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;
