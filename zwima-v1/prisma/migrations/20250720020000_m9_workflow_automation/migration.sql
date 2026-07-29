-- M9 Workflow Automation (additive only)
-- CREATE TYPE / TABLE / INDEX / FK only. No DROP / TRUNCATE / reset.

CREATE TYPE "WorkflowLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'API', 'WEBHOOK', 'EVENT', 'AGENT', 'APPROVAL');
CREATE TYPE "WorkflowNodeType" AS ENUM ('START', 'END', 'AGENT', 'MODEL', 'HTTP_REQUEST', 'CONDITION', 'TRANSFORM', 'DELAY', 'APPROVAL', 'NOTIFICATION', 'DATA_INPUT', 'DATA_OUTPUT', 'PARALLEL', 'MERGE', 'SUB_WORKFLOW');
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT');
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'READY', 'RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED', 'TIMED_OUT');
CREATE TYPE "WorkflowApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowDefinition_workflowId_key" ON "WorkflowDefinition"("workflowId");
CREATE INDEX "WorkflowDefinition_organizationId_status_createdAt_idx" ON "WorkflowDefinition"("organizationId", "status", "createdAt");
CREATE INDEX "WorkflowDefinition_organizationId_workspaceId_idx" ON "WorkflowDefinition"("organizationId", "workspaceId");
CREATE INDEX "WorkflowDefinition_createdBy_idx" ON "WorkflowDefinition"("createdBy");

CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "WorkflowLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "graphChecksum" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowVersion_versionId_key" ON "WorkflowVersion"("versionId");
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_versionNumber_key" ON "WorkflowVersion"("workflowId", "versionNumber");
CREATE INDEX "WorkflowVersion_workflowId_status_idx" ON "WorkflowVersion"("workflowId", "status");

CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "WorkflowNodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "agentId" TEXT,
    "agentVersionId" TEXT,
    "modelKey" TEXT,
    "subWorkflowId" TEXT,
    "memoryRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowNode_nodeId_key" ON "WorkflowNode"("nodeId");
CREATE UNIQUE INDEX "WorkflowNode_versionId_key_key" ON "WorkflowNode"("versionId", "key");
CREATE INDEX "WorkflowNode_versionId_type_idx" ON "WorkflowNode"("versionId", "type");
CREATE INDEX "WorkflowNode_agentId_idx" ON "WorkflowNode"("agentId");

CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL,
    "edgeId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "conditionKey" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowEdge_edgeId_key" ON "WorkflowEdge"("edgeId");
CREATE UNIQUE INDEX "WorkflowEdge_versionId_fromNodeId_toNodeId_conditionKey_key" ON "WorkflowEdge"("versionId", "fromNodeId", "toNodeId", "conditionKey");
CREATE INDEX "WorkflowEdge_versionId_idx" ON "WorkflowEdge"("versionId");

CREATE TABLE "WorkflowTrigger" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "WorkflowTriggerType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowTrigger_triggerId_key" ON "WorkflowTrigger"("triggerId");
CREATE INDEX "WorkflowTrigger_organizationId_type_enabled_idx" ON "WorkflowTrigger"("organizationId", "type", "enabled");
CREATE INDEX "WorkflowTrigger_workflowId_idx" ON "WorkflowTrigger"("workflowId");

CREATE TABLE "WorkflowVariable" (
    "id" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "defaultValue" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowVariable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowVariable_variableId_key" ON "WorkflowVariable"("variableId");
CREATE UNIQUE INDEX "WorkflowVariable_versionId_key_key" ON "WorkflowVariable"("versionId", "key");
CREATE INDEX "WorkflowVariable_versionId_idx" ON "WorkflowVariable"("versionId");

CREATE TABLE "WorkflowSecretReference" (
    "id" TEXT NOT NULL,
    "secretRefId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowSecretReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowSecretReference_secretRefId_key" ON "WorkflowSecretReference"("secretRefId");
CREATE UNIQUE INDEX "WorkflowSecretReference_workflowId_key_key" ON "WorkflowSecretReference"("workflowId", "key");
CREATE INDEX "WorkflowSecretReference_organizationId_idx" ON "WorkflowSecretReference"("organizationId");

CREATE TABLE "WorkflowPolicy" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowPolicy_policyId_key" ON "WorkflowPolicy"("policyId");
CREATE UNIQUE INDEX "WorkflowPolicy_organizationId_key_key" ON "WorkflowPolicy"("organizationId", "key");
CREATE INDEX "WorkflowPolicy_organizationId_idx" ON "WorkflowPolicy"("organizationId");

CREATE TABLE "WorkflowSchedule" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "nextRunAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowSchedule_scheduleId_key" ON "WorkflowSchedule"("scheduleId");
CREATE UNIQUE INDEX "WorkflowSchedule_triggerId_key" ON "WorkflowSchedule"("triggerId");

CREATE TABLE "WorkflowWebhookConfig" (
    "id" TEXT NOT NULL,
    "webhookConfigId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "pathSuffix" TEXT NOT NULL,
    "secretRefKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowWebhookConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowWebhookConfig_webhookConfigId_key" ON "WorkflowWebhookConfig"("webhookConfigId");
CREATE UNIQUE INDEX "WorkflowWebhookConfig_triggerId_key" ON "WorkflowWebhookConfig"("triggerId");
CREATE INDEX "WorkflowWebhookConfig_pathSuffix_idx" ON "WorkflowWebhookConfig"("pathSuffix");

CREATE TABLE "WorkflowRetryPolicy" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "backoffMs" INTEGER NOT NULL DEFAULT 1000,
    "retryOn" TEXT[] DEFAULT ARRAY['FAILED', 'TIMED_OUT']::TEXT[],
    CONSTRAINT "WorkflowRetryPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowRetryPolicy_policyId_key" ON "WorkflowRetryPolicy"("policyId");
CREATE UNIQUE INDEX "WorkflowRetryPolicy_versionId_key" ON "WorkflowRetryPolicy"("versionId");

CREATE TABLE "WorkflowErrorPolicy" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "onFailure" TEXT NOT NULL DEFAULT 'STOP',
    "failureBranchKey" TEXT,
    "compensationMeta" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "WorkflowErrorPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowErrorPolicy_policyId_key" ON "WorkflowErrorPolicy"("policyId");
CREATE UNIQUE INDEX "WorkflowErrorPolicy_versionId_key" ON "WorkflowErrorPolicy"("versionId");

CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "triggerType" "WorkflowTriggerType" NOT NULL DEFAULT 'MANUAL',
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "idempotencyKey" TEXT,
    "concurrencyKey" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "priceVersionId" TEXT,
    "costProfileId" TEXT,
    "costCalculationId" TEXT,
    "tokenUsage" JSONB NOT NULL DEFAULT '{"inputTokens":0,"outputTokens":0}',
    "retryCost" DOUBLE PRECISION,
    "toolCost" DOUBLE PRECISION,
    "requestedModel" TEXT,
    "resolvedModel" TEXT,
    "registryEntryId" TEXT,
    "migrationReason" TEXT,
    "replacementModel" TEXT,
    "lifecycleStatus" TEXT,
    "eventId" TEXT,
    "complianceAuditRecordId" TEXT,
    "processingRegion" TEXT,
    "policyVersion" TEXT,
    "forceReview" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "errorClass" TEXT,
    "retryOfExecutionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowExecution_executionId_key" ON "WorkflowExecution"("executionId");
CREATE UNIQUE INDEX "WorkflowExecution_organizationId_idempotencyKey_key" ON "WorkflowExecution"("organizationId", "idempotencyKey");
CREATE INDEX "WorkflowExecution_organizationId_status_createdAt_idx" ON "WorkflowExecution"("organizationId", "status", "createdAt");
CREATE INDEX "WorkflowExecution_organizationId_workflowId_createdAt_idx" ON "WorkflowExecution"("organizationId", "workflowId", "createdAt");
CREATE INDEX "WorkflowExecution_workflowVersionId_idx" ON "WorkflowExecution"("workflowVersionId");
CREATE INDEX "WorkflowExecution_eventId_idx" ON "WorkflowExecution"("eventId");
CREATE INDEX "WorkflowExecution_concurrencyKey_status_idx" ON "WorkflowExecution"("concurrencyKey", "status");

CREATE TABLE "WorkflowStepExecution" (
    "id" TEXT NOT NULL,
    "stepExecutionId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "agentRunId" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "priceVersionId" TEXT,
    "costProfileId" TEXT,
    "costCalculationId" TEXT,
    "tokenUsage" JSONB NOT NULL DEFAULT '{"inputTokens":0,"outputTokens":0}',
    "retryCost" DOUBLE PRECISION,
    "toolCost" DOUBLE PRECISION,
    "requestedModel" TEXT,
    "resolvedModel" TEXT,
    "registryEntryId" TEXT,
    "migrationReason" TEXT,
    "replacementModel" TEXT,
    "lifecycleStatus" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowStepExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowStepExecution_stepExecutionId_key" ON "WorkflowStepExecution"("stepExecutionId");
CREATE UNIQUE INDEX "WorkflowStepExecution_executionId_sequence_key" ON "WorkflowStepExecution"("executionId", "sequence");
CREATE INDEX "WorkflowStepExecution_executionId_status_idx" ON "WorkflowStepExecution"("executionId", "status");
CREATE INDEX "WorkflowStepExecution_agentRunId_idx" ON "WorkflowStepExecution"("agentRunId");
CREATE INDEX "WorkflowStepExecution_nodeId_idx" ON "WorkflowStepExecution"("nodeId");

CREATE TABLE "WorkflowExecutionLog" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowExecutionLog_logId_key" ON "WorkflowExecutionLog"("logId");
CREATE INDEX "WorkflowExecutionLog_executionId_createdAt_idx" ON "WorkflowExecutionLog"("executionId", "createdAt");

CREATE TABLE "WorkflowApproval" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepExecutionId" TEXT,
    "organizationId" TEXT NOT NULL,
    "reviewCaseId" TEXT,
    "eventId" TEXT,
    "agentReviewLinkId" TEXT,
    "status" "WorkflowApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowApproval_approvalId_key" ON "WorkflowApproval"("approvalId");
CREATE INDEX "WorkflowApproval_organizationId_status_createdAt_idx" ON "WorkflowApproval"("organizationId", "status", "createdAt");
CREATE INDEX "WorkflowApproval_executionId_idx" ON "WorkflowApproval"("executionId");
CREATE INDEX "WorkflowApproval_reviewCaseId_idx" ON "WorkflowApproval"("reviewCaseId");

ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("workflowId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "WorkflowNode"("nodeId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "WorkflowNode"("nodeId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTrigger" ADD CONSTRAINT "WorkflowTrigger_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("workflowId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowVariable" ADD CONSTRAINT "WorkflowVariable_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowSecretReference" ADD CONSTRAINT "WorkflowSecretReference_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("workflowId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowPolicy" ADD CONSTRAINT "WorkflowPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowSchedule" ADD CONSTRAINT "WorkflowSchedule_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "WorkflowTrigger"("triggerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowWebhookConfig" ADD CONSTRAINT "WorkflowWebhookConfig_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "WorkflowTrigger"("triggerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRetryPolicy" ADD CONSTRAINT "WorkflowRetryPolicy_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowErrorPolicy" ADD CONSTRAINT "WorkflowErrorPolicy_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("workflowId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepExecution" ADD CONSTRAINT "WorkflowStepExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepExecution" ADD CONSTRAINT "WorkflowStepExecution_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "WorkflowNode"("nodeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_stepExecutionId_fkey" FOREIGN KEY ("stepExecutionId") REFERENCES "WorkflowStepExecution"("stepExecutionId") ON DELETE SET NULL ON UPDATE CASCADE;
