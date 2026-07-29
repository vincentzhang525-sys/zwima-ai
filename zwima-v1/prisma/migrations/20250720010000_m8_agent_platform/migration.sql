-- M8 Agent Platform (additive CREATE only — Gap Analysis: no existing Agent*/Tool*/Prompt* models; M6 HumanReviewCase/AIEvent linked by string IDs only)

CREATE TYPE "AgentLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DEPRECATED', 'ARCHIVED');
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_TOOL', 'WAITING_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT');
CREATE TYPE "ToolRuntimeStatus" AS ENUM ('ENABLED', 'DISABLED');
CREATE TYPE "PromptLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AgentMemoryScope" AS ENUM ('CONVERSATION', 'RUN', 'WORKSPACE');
CREATE TYPE "AgentStepType" AS ENUM ('PLAN', 'MODEL', 'TOOL', 'REVIEW', 'DELEGATE', 'SYSTEM');
CREATE TYPE "AgentRunStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "ToolExecutionStatus" AS ENUM ('SUCCESS', 'FAILED');
CREATE TYPE "AgentReviewLinkStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WAIVED');

CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgentLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AgentLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "systemPrompt" TEXT NOT NULL,
    "promptTemplateId" TEXT,
    "promptVersionId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "toolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memoryScope" "AgentMemoryScope" NOT NULL DEFAULT 'CONVERSATION',
    "maxDelegationDepth" INTEGER NOT NULL DEFAULT 2,
    "maxDelegationChildren" INTEGER NOT NULL DEFAULT 3,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentVersionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "idempotencyKey" TEXT,
    "parentRunId" TEXT,
    "rootRunId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DOUBLE PRECISION,
    "costActual" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "priceVersionId" TEXT,
    "costCalculationId" TEXT,
    "requestedModel" TEXT,
    "resolvedModel" TEXT,
    "modelVersion" TEXT,
    "migrationReason" TEXT,
    "tokenUsage" JSONB NOT NULL DEFAULT '{"inputTokens":0,"outputTokens":0}',
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "errorClass" TEXT,
    "eventId" TEXT,
    "reviewCaseId" TEXT,
    "retryOfRunId" TEXT,
    "processingRegion" TEXT,
    "compliancePolicyVersion" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRunStep" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepType" "AgentStepType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "AgentRunStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "toolExecutionId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRunStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolDefinition" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ToolRuntimeStatus" NOT NULL DEFAULT 'ENABLED',
    "currentVersionId" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ToolDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolVersion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "inputSchema" JSONB NOT NULL DEFAULT '{}',
    "outputSchema" JSONB NOT NULL DEFAULT '{}',
    "handlerKey" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "maxRetries" INTEGER NOT NULL DEFAULT 0,
    "permissionScope" TEXT NOT NULL DEFAULT 'org',
    "status" "ToolRuntimeStatus" NOT NULL DEFAULT 'ENABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolExecution" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "toolId" TEXT NOT NULL,
    "toolVersionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "ToolExecutionStatus" NOT NULL,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PromptLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PromptLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptTestCase" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "expectedContains" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptTestCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "agentId" TEXT NOT NULL,
    "runId" TEXT,
    "scope" "AgentMemoryScope" NOT NULL,
    "key" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "valuePreview" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentReviewLink" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "eventId" TEXT NOT NULL,
    "reviewCaseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "AgentReviewLinkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentReviewLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentDelegation" (
    "id" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "parentRunId" TEXT NOT NULL,
    "childRunId" TEXT NOT NULL,
    "parentAgentId" TEXT NOT NULL,
    "childAgentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentDelegation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentOrgPolicy" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentOrgPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentDefinition_agentId_key" ON "AgentDefinition"("agentId");
CREATE INDEX "AgentDefinition_organizationId_status_createdAt_idx" ON "AgentDefinition"("organizationId", "status", "createdAt");
CREATE INDEX "AgentDefinition_organizationId_workspaceId_idx" ON "AgentDefinition"("organizationId", "workspaceId");
CREATE INDEX "AgentDefinition_createdBy_idx" ON "AgentDefinition"("createdBy");

CREATE UNIQUE INDEX "AgentVersion_versionId_key" ON "AgentVersion"("versionId");
CREATE UNIQUE INDEX "AgentVersion_agentId_versionNumber_key" ON "AgentVersion"("agentId", "versionNumber");
CREATE INDEX "AgentVersion_agentId_status_idx" ON "AgentVersion"("agentId", "status");
CREATE INDEX "AgentVersion_promptTemplateId_idx" ON "AgentVersion"("promptTemplateId");

CREATE UNIQUE INDEX "AgentRun_runId_key" ON "AgentRun"("runId");
CREATE UNIQUE INDEX "AgentRun_organizationId_idempotencyKey_key" ON "AgentRun"("organizationId", "idempotencyKey");
CREATE INDEX "AgentRun_organizationId_status_createdAt_idx" ON "AgentRun"("organizationId", "status", "createdAt");
CREATE INDEX "AgentRun_organizationId_agentId_createdAt_idx" ON "AgentRun"("organizationId", "agentId", "createdAt");
CREATE INDEX "AgentRun_parentRunId_idx" ON "AgentRun"("parentRunId");
CREATE INDEX "AgentRun_rootRunId_idx" ON "AgentRun"("rootRunId");
CREATE INDEX "AgentRun_eventId_idx" ON "AgentRun"("eventId");
CREATE INDEX "AgentRun_reviewCaseId_idx" ON "AgentRun"("reviewCaseId");
CREATE INDEX "AgentRun_userId_createdAt_idx" ON "AgentRun"("userId", "createdAt");

CREATE UNIQUE INDEX "AgentRunStep_stepId_key" ON "AgentRunStep"("stepId");
CREATE UNIQUE INDEX "AgentRunStep_runId_sequence_key" ON "AgentRunStep"("runId", "sequence");
CREATE INDEX "AgentRunStep_runId_stepType_idx" ON "AgentRunStep"("runId", "stepType");

CREATE UNIQUE INDEX "ToolDefinition_toolId_key" ON "ToolDefinition"("toolId");
CREATE UNIQUE INDEX "ToolDefinition_organizationId_key_key" ON "ToolDefinition"("organizationId", "key");
CREATE INDEX "ToolDefinition_status_idx" ON "ToolDefinition"("status");
CREATE INDEX "ToolDefinition_isMock_idx" ON "ToolDefinition"("isMock");

CREATE UNIQUE INDEX "ToolVersion_versionId_key" ON "ToolVersion"("versionId");
CREATE UNIQUE INDEX "ToolVersion_toolId_versionNumber_key" ON "ToolVersion"("toolId", "versionNumber");
CREATE INDEX "ToolVersion_toolId_status_idx" ON "ToolVersion"("toolId", "status");

CREATE UNIQUE INDEX "ToolExecution_executionId_key" ON "ToolExecution"("executionId");
CREATE INDEX "ToolExecution_organizationId_createdAt_idx" ON "ToolExecution"("organizationId", "createdAt");
CREATE INDEX "ToolExecution_runId_createdAt_idx" ON "ToolExecution"("runId", "createdAt");
CREATE INDEX "ToolExecution_toolId_createdAt_idx" ON "ToolExecution"("toolId", "createdAt");

CREATE UNIQUE INDEX "PromptTemplate_templateId_key" ON "PromptTemplate"("templateId");
CREATE UNIQUE INDEX "PromptTemplate_organizationId_key_key" ON "PromptTemplate"("organizationId", "key");
CREATE INDEX "PromptTemplate_organizationId_status_idx" ON "PromptTemplate"("organizationId", "status");
CREATE INDEX "PromptTemplate_organizationId_workspaceId_idx" ON "PromptTemplate"("organizationId", "workspaceId");

CREATE UNIQUE INDEX "PromptVersion_versionId_key" ON "PromptVersion"("versionId");
CREATE UNIQUE INDEX "PromptVersion_templateId_versionNumber_key" ON "PromptVersion"("templateId", "versionNumber");
CREATE INDEX "PromptVersion_templateId_status_idx" ON "PromptVersion"("templateId", "status");

CREATE UNIQUE INDEX "PromptTestCase_testCaseId_key" ON "PromptTestCase"("testCaseId");
CREATE INDEX "PromptTestCase_templateId_createdAt_idx" ON "PromptTestCase"("templateId", "createdAt");

CREATE UNIQUE INDEX "AgentMemory_memoryId_key" ON "AgentMemory"("memoryId");
CREATE INDEX "AgentMemory_organizationId_agentId_scope_idx" ON "AgentMemory"("organizationId", "agentId", "scope");
CREATE INDEX "AgentMemory_organizationId_workspaceId_idx" ON "AgentMemory"("organizationId", "workspaceId");
CREATE INDEX "AgentMemory_runId_idx" ON "AgentMemory"("runId");
CREATE INDEX "AgentMemory_expiresAt_idx" ON "AgentMemory"("expiresAt");

CREATE UNIQUE INDEX "AgentReviewLink_linkId_key" ON "AgentReviewLink"("linkId");
CREATE INDEX "AgentReviewLink_organizationId_status_createdAt_idx" ON "AgentReviewLink"("organizationId", "status", "createdAt");
CREATE INDEX "AgentReviewLink_runId_idx" ON "AgentReviewLink"("runId");
CREATE INDEX "AgentReviewLink_reviewCaseId_idx" ON "AgentReviewLink"("reviewCaseId");
CREATE INDEX "AgentReviewLink_eventId_idx" ON "AgentReviewLink"("eventId");

CREATE UNIQUE INDEX "AgentDelegation_delegationId_key" ON "AgentDelegation"("delegationId");
CREATE UNIQUE INDEX "AgentDelegation_parentRunId_childRunId_key" ON "AgentDelegation"("parentRunId", "childRunId");
CREATE INDEX "AgentDelegation_organizationId_createdAt_idx" ON "AgentDelegation"("organizationId", "createdAt");
CREATE INDEX "AgentDelegation_parentAgentId_idx" ON "AgentDelegation"("parentAgentId");
CREATE INDEX "AgentDelegation_childAgentId_idx" ON "AgentDelegation"("childAgentId");

CREATE UNIQUE INDEX "AgentOrgPolicy_policyId_key" ON "AgentOrgPolicy"("policyId");
CREATE UNIQUE INDEX "AgentOrgPolicy_organizationId_key_key" ON "AgentOrgPolicy"("organizationId", "key");
CREATE INDEX "AgentOrgPolicy_organizationId_idx" ON "AgentOrgPolicy"("organizationId");

ALTER TABLE "AgentDefinition" ADD CONSTRAINT "AgentDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentVersionId_fkey" FOREIGN KEY ("agentVersionId") REFERENCES "AgentVersion"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentRunStep" ADD CONSTRAINT "AgentRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolDefinition" ADD CONSTRAINT "ToolDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToolVersion" ADD CONSTRAINT "ToolVersion_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "ToolDefinition"("toolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "ToolDefinition"("toolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_toolVersionId_fkey" FOREIGN KEY ("toolVersionId") REFERENCES "ToolVersion"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("templateId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptTestCase" ADD CONSTRAINT "PromptTestCase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("templateId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReviewLink" ADD CONSTRAINT "AgentReviewLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentDelegation" ADD CONSTRAINT "AgentDelegation_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentDelegation" ADD CONSTRAINT "AgentDelegation_childRunId_fkey" FOREIGN KEY ("childRunId") REFERENCES "AgentRun"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentOrgPolicy" ADD CONSTRAINT "AgentOrgPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
