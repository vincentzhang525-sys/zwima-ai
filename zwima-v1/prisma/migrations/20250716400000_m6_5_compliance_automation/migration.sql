-- M6.5 Compliance Automation

CREATE TYPE "ComplianceAutomationRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ComplianceAutomationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ComplianceRuleScopeType" AS ENUM ('AI_SYSTEM', 'PROVIDER', 'MODEL', 'MODEL_VERSION', 'DEPLOYMENT', 'WORKSPACE', 'ORGANIZATION', 'DATA_CATEGORY', 'RISK_CLASSIFICATION', 'INTENDED_PURPOSE');
CREATE TYPE "ComplianceEvaluationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'SKIPPED', 'ERROR');
CREATE TYPE "ComplianceAutomationEventType" AS ENUM ('MODEL_ADDED', 'MODEL_UPDATED', 'MODEL_DEPRECATED', 'MODEL_UNAVAILABLE', 'PROVIDER_PRICING_CHANGED', 'PROVIDER_AVAILABILITY_CHANGED', 'RISK_CLASSIFICATION_CHANGED', 'INTENDED_PURPOSE_CHANGED', 'EVIDENCE_EXPIRED', 'DOCUMENTATION_OUTDATED', 'AUDIT_FINDING_CREATED', 'CORRECTIVE_ACTION_OVERDUE', 'RELEASE_CHANNEL_CHANGED', 'DEPLOYMENT_CHANGED', 'COMPLIANCE_STATUS_CHANGED');
CREATE TYPE "ComplianceAutomationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ComplianceEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER', 'SKIPPED');
CREATE TYPE "ComplianceAutomationJobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE "ComplianceAutomationRunMode" AS ENUM ('DRY_RUN', 'PREVIEW', 'EXECUTE');
CREATE TYPE "ComplianceAutomationRunStatus" AS ENUM ('QUEUED', 'AWAITING_APPROVAL', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ComplianceAutomationTaskType" AS ENUM ('REVIEW', 'EVIDENCE_COLLECTION', 'DOCUMENTATION_UPDATE', 'RISK_REASSESSMENT', 'AUDIT_FOLLOW_UP', 'CORRECTIVE_ACTION', 'APPROVAL', 'ESCALATION');
CREATE TYPE "ComplianceAutomationTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'ESCALATED');
CREATE TYPE "ComplianceReviewScheduleType" AS ENUM ('PERIODIC', 'RISK_BASED', 'EVENT_TRIGGERED', 'EVIDENCE_EXPIRY', 'AUDIT_FOLLOW_UP', 'DEPLOYMENT_CHANGE', 'MODEL_VERSION_CHANGE', 'PROVIDER_CHANGE');
CREATE TYPE "ComplianceMonitoringStatus" AS ENUM ('COMPLIANT', 'PARTIALLY_COMPLIANT', 'ACTION_REQUIRED', 'UNDER_REVIEW', 'BLOCKED', 'NON_COMPLIANT', 'ARCHIVED');
CREATE TYPE "ComplianceNotificationChannel" AS ENUM ('IN_APP', 'EMAIL_READY');
CREATE TYPE "ComplianceNotificationStatus" AS ENUM ('QUEUED', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE "ComplianceEscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
CREATE TYPE "ComplianceRecommendationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');
CREATE TYPE "ComplianceEvidenceCollectionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'MANUAL_FALLBACK');

CREATE TABLE "ComplianceRule" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ComplianceAutomationRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "priority" "ComplianceAutomationPriority" NOT NULL DEFAULT 'MEDIUM',
  "scopeType" "ComplianceRuleScopeType" NOT NULL,
  "scopeRef" TEXT,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRuleVersion" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "conditions" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "exceptions" JSONB,
  "changelog" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceRuleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRuleEvaluation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleVersionId" TEXT,
  "eventId" TEXT,
  "aiSystemId" TEXT,
  "status" "ComplianceEvaluationStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "score" DOUBLE PRECISION,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceRuleEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "eventType" "ComplianceAutomationEventType" NOT NULL,
  "severity" "ComplianceAutomationSeverity" NOT NULL DEFAULT 'MEDIUM',
  "source" TEXT NOT NULL,
  "sourceRef" TEXT,
  "correlationKey" TEXT,
  "dedupeKey" TEXT,
  "idempotencyKey" TEXT,
  "status" "ComplianceEventStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "aiSystemId" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEventCorrelation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "correlationKey" TEXT NOT NULL,
  "eventIds" JSONB NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceEventCorrelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAutomationJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" "ComplianceAutomationJobStatus" NOT NULL DEFAULT 'ACTIVE',
  "schedule" TEXT,
  "config" JSONB,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAutomationRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT,
  "runKey" TEXT NOT NULL,
  "mode" "ComplianceAutomationRunMode" NOT NULL DEFAULT 'PREVIEW',
  "status" "ComplianceAutomationRunStatus" NOT NULL DEFAULT 'QUEUED',
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  "idempotencyKey" TEXT,
  "rateLimitKey" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  "taskType" "ComplianceAutomationTaskType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ComplianceAutomationTaskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ComplianceAutomationPriority" NOT NULL DEFAULT 'MEDIUM',
  "assigneeUserId" TEXT,
  "reviewerUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "sourceRuleId" TEXT,
  "sourceEventId" TEXT,
  "aiSystemId" TEXT,
  "riskAssessmentId" TEXT,
  "evidenceId" TEXT,
  "auditSessionId" TEXT,
  "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  "completionEvidence" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceTaskAssignment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'ASSIGNEE',
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ComplianceTaskAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceReviewSchedule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scheduleKey" TEXT NOT NULL,
  "scheduleType" "ComplianceReviewScheduleType" NOT NULL,
  "aiSystemId" TEXT,
  "cadence" TEXT,
  "nextDueAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "status" "ComplianceAutomationJobStatus" NOT NULL DEFAULT 'ACTIVE',
  "config" JSONB,
  "overdueEscalated" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceReviewSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceScoreSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "complianceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "documentationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "evidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "auditReadinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "correctiveActionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overallStatus" "ComplianceMonitoringStatus" NOT NULL DEFAULT 'ACTION_REQUIRED',
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ComplianceScoreSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceStatusHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "fromStatus" "ComplianceMonitoringStatus",
  "toStatus" "ComplianceMonitoringStatus" NOT NULL,
  "reason" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceNotification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "channel" "ComplianceNotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "status" "ComplianceNotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payload" JSONB,
  "recipientUserId" TEXT,
  "severity" "ComplianceAutomationSeverity" NOT NULL DEFAULT 'MEDIUM',
  "relatedTaskId" TEXT,
  "relatedEventId" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEscalation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "taskId" TEXT,
  "eventId" TEXT,
  "level" INTEGER NOT NULL DEFAULT 1,
  "status" "ComplianceEscalationStatus" NOT NULL DEFAULT 'OPEN',
  "policyKey" TEXT,
  "reason" TEXT,
  "escalatedTo" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceEscalation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRecommendation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "ComplianceAutomationPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueAtSuggested" TIMESTAMP(3),
  "suggestedOwner" TEXT,
  "requiredEvidence" TEXT,
  "relatedObligation" TEXT,
  "expectedImpact" TEXT,
  "status" "ComplianceRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "sourceRuleId" TEXT,
  "sourceEventId" TEXT,
  "isRecommendation" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidenceCollection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "requestKey" TEXT NOT NULL,
  "status" "ComplianceEvidenceCollectionStatus" NOT NULL DEFAULT 'PENDING',
  "sourceMapping" JSONB,
  "evidenceId" TEXT,
  "failureReason" TEXT,
  "fallbackManual" BOOLEAN NOT NULL DEFAULT false,
  "linkedTaskId" TEXT,
  "runCount" INTEGER NOT NULL DEFAULT 0,
  "lastRunAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceEvidenceCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAutomationAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceAutomationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceRule_organizationId_ruleKey_key" ON "ComplianceRule"("organizationId", "ruleKey");
CREATE INDEX "ComplianceRule_organizationId_status_idx" ON "ComplianceRule"("organizationId", "status");
CREATE INDEX "ComplianceRule_organizationId_scopeType_idx" ON "ComplianceRule"("organizationId", "scopeType");
CREATE INDEX "ComplianceRule_organizationId_priority_idx" ON "ComplianceRule"("organizationId", "priority");

CREATE UNIQUE INDEX "ComplianceRuleVersion_ruleId_version_key" ON "ComplianceRuleVersion"("ruleId", "version");
CREATE INDEX "ComplianceRuleVersion_ruleId_createdAt_idx" ON "ComplianceRuleVersion"("ruleId", "createdAt");

CREATE INDEX "ComplianceRuleEvaluation_organizationId_startedAt_idx" ON "ComplianceRuleEvaluation"("organizationId", "startedAt");
CREATE INDEX "ComplianceRuleEvaluation_ruleId_startedAt_idx" ON "ComplianceRuleEvaluation"("ruleId", "startedAt");
CREATE INDEX "ComplianceRuleEvaluation_eventId_idx" ON "ComplianceRuleEvaluation"("eventId");

CREATE UNIQUE INDEX "ComplianceEvent_organizationId_eventKey_key" ON "ComplianceEvent"("organizationId", "eventKey");
CREATE UNIQUE INDEX "ComplianceEvent_organizationId_idempotencyKey_key" ON "ComplianceEvent"("organizationId", "idempotencyKey");
CREATE INDEX "ComplianceEvent_organizationId_status_idx" ON "ComplianceEvent"("organizationId", "status");
CREATE INDEX "ComplianceEvent_organizationId_eventType_idx" ON "ComplianceEvent"("organizationId", "eventType");
CREATE INDEX "ComplianceEvent_organizationId_dedupeKey_idx" ON "ComplianceEvent"("organizationId", "dedupeKey");
CREATE INDEX "ComplianceEvent_correlationKey_idx" ON "ComplianceEvent"("correlationKey");
CREATE INDEX "ComplianceEvent_aiSystemId_createdAt_idx" ON "ComplianceEvent"("aiSystemId", "createdAt");

CREATE UNIQUE INDEX "ComplianceEventCorrelation_organizationId_correlationKey_key" ON "ComplianceEventCorrelation"("organizationId", "correlationKey");
CREATE INDEX "ComplianceEventCorrelation_organizationId_createdAt_idx" ON "ComplianceEventCorrelation"("organizationId", "createdAt");

CREATE UNIQUE INDEX "ComplianceAutomationJob_organizationId_jobKey_key" ON "ComplianceAutomationJob"("organizationId", "jobKey");
CREATE INDEX "ComplianceAutomationJob_organizationId_status_idx" ON "ComplianceAutomationJob"("organizationId", "status");
CREATE INDEX "ComplianceAutomationJob_nextRunAt_idx" ON "ComplianceAutomationJob"("nextRunAt");

CREATE UNIQUE INDEX "ComplianceAutomationRun_organizationId_runKey_key" ON "ComplianceAutomationRun"("organizationId", "runKey");
CREATE UNIQUE INDEX "ComplianceAutomationRun_organizationId_idempotencyKey_key" ON "ComplianceAutomationRun"("organizationId", "idempotencyKey");
CREATE INDEX "ComplianceAutomationRun_organizationId_status_idx" ON "ComplianceAutomationRun"("organizationId", "status");
CREATE INDEX "ComplianceAutomationRun_organizationId_mode_idx" ON "ComplianceAutomationRun"("organizationId", "mode");
CREATE INDEX "ComplianceAutomationRun_jobId_createdAt_idx" ON "ComplianceAutomationRun"("jobId", "createdAt");

CREATE UNIQUE INDEX "ComplianceTask_organizationId_taskKey_key" ON "ComplianceTask"("organizationId", "taskKey");
CREATE INDEX "ComplianceTask_organizationId_status_idx" ON "ComplianceTask"("organizationId", "status");
CREATE INDEX "ComplianceTask_organizationId_taskType_idx" ON "ComplianceTask"("organizationId", "taskType");
CREATE INDEX "ComplianceTask_assigneeUserId_status_idx" ON "ComplianceTask"("assigneeUserId", "status");
CREATE INDEX "ComplianceTask_dueAt_status_idx" ON "ComplianceTask"("dueAt", "status");
CREATE INDEX "ComplianceTask_aiSystemId_idx" ON "ComplianceTask"("aiSystemId");

CREATE UNIQUE INDEX "ComplianceTaskAssignment_taskId_userId_role_key" ON "ComplianceTaskAssignment"("taskId", "userId", "role");
CREATE INDEX "ComplianceTaskAssignment_userId_isActive_idx" ON "ComplianceTaskAssignment"("userId", "isActive");

CREATE UNIQUE INDEX "ComplianceReviewSchedule_organizationId_scheduleKey_key" ON "ComplianceReviewSchedule"("organizationId", "scheduleKey");
CREATE INDEX "ComplianceReviewSchedule_organizationId_status_idx" ON "ComplianceReviewSchedule"("organizationId", "status");
CREATE INDEX "ComplianceReviewSchedule_nextDueAt_status_idx" ON "ComplianceReviewSchedule"("nextDueAt", "status");
CREATE INDEX "ComplianceReviewSchedule_aiSystemId_idx" ON "ComplianceReviewSchedule"("aiSystemId");

CREATE INDEX "ComplianceScoreSnapshot_organizationId_computedAt_idx" ON "ComplianceScoreSnapshot"("organizationId", "computedAt");
CREATE INDEX "ComplianceScoreSnapshot_aiSystemId_computedAt_idx" ON "ComplianceScoreSnapshot"("aiSystemId", "computedAt");
CREATE INDEX "ComplianceScoreSnapshot_organizationId_overallStatus_idx" ON "ComplianceScoreSnapshot"("organizationId", "overallStatus");

CREATE INDEX "ComplianceStatusHistory_organizationId_createdAt_idx" ON "ComplianceStatusHistory"("organizationId", "createdAt");
CREATE INDEX "ComplianceStatusHistory_aiSystemId_createdAt_idx" ON "ComplianceStatusHistory"("aiSystemId", "createdAt");

CREATE INDEX "ComplianceNotification_organizationId_status_idx" ON "ComplianceNotification"("organizationId", "status");
CREATE INDEX "ComplianceNotification_recipientUserId_status_idx" ON "ComplianceNotification"("recipientUserId", "status");
CREATE INDEX "ComplianceNotification_organizationId_createdAt_idx" ON "ComplianceNotification"("organizationId", "createdAt");

CREATE INDEX "ComplianceEscalation_organizationId_status_idx" ON "ComplianceEscalation"("organizationId", "status");
CREATE INDEX "ComplianceEscalation_taskId_level_idx" ON "ComplianceEscalation"("taskId", "level");
CREATE INDEX "ComplianceEscalation_organizationId_createdAt_idx" ON "ComplianceEscalation"("organizationId", "createdAt");

CREATE INDEX "ComplianceRecommendation_organizationId_status_idx" ON "ComplianceRecommendation"("organizationId", "status");
CREATE INDEX "ComplianceRecommendation_aiSystemId_status_idx" ON "ComplianceRecommendation"("aiSystemId", "status");
CREATE INDEX "ComplianceRecommendation_organizationId_priority_idx" ON "ComplianceRecommendation"("organizationId", "priority");

CREATE UNIQUE INDEX "ComplianceEvidenceCollection_organizationId_requestKey_key" ON "ComplianceEvidenceCollection"("organizationId", "requestKey");
CREATE INDEX "ComplianceEvidenceCollection_organizationId_status_idx" ON "ComplianceEvidenceCollection"("organizationId", "status");
CREATE INDEX "ComplianceEvidenceCollection_aiSystemId_status_idx" ON "ComplianceEvidenceCollection"("aiSystemId", "status");

CREATE INDEX "ComplianceAutomationAuditLog_organizationId_createdAt_idx" ON "ComplianceAutomationAuditLog"("organizationId", "createdAt");
CREATE INDEX "ComplianceAutomationAuditLog_action_createdAt_idx" ON "ComplianceAutomationAuditLog"("action", "createdAt");

ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceRuleVersion" ADD CONSTRAINT "ComplianceRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ComplianceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceRuleEvaluation" ADD CONSTRAINT "ComplianceRuleEvaluation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ComplianceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceRuleEvaluation" ADD CONSTRAINT "ComplianceRuleEvaluation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "ComplianceRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAutomationRun" ADD CONSTRAINT "ComplianceAutomationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAutomationRun" ADD CONSTRAINT "ComplianceAutomationRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ComplianceAutomationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_sourceRuleId_fkey" FOREIGN KEY ("sourceRuleId") REFERENCES "ComplianceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "ComplianceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceTaskAssignment" ADD CONSTRAINT "ComplianceTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ComplianceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceScoreSnapshot" ADD CONSTRAINT "ComplianceScoreSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceScoreSnapshot" ADD CONSTRAINT "ComplianceScoreSnapshot_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEscalation" ADD CONSTRAINT "ComplianceEscalation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ComplianceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."ComplianceRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceRuleVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceRuleEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEventCorrelation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAutomationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAutomationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceTaskAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceReviewSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceScoreSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEscalation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceRecommendation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvidenceCollection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAutomationAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ComplianceRule_select" ON public."ComplianceRule"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceRule_write" ON public."ComplianceRule"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceRuleVersion_all" ON public."ComplianceRuleVersion"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceRule" r WHERE r.id = "ruleId" AND public.is_org_member(r."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceRule" r WHERE r.id = "ruleId" AND public.is_org_admin(r."organizationId"))
  );

CREATE POLICY "ComplianceRuleEvaluation_all" ON public."ComplianceRuleEvaluation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEvent_select" ON public."ComplianceEvent"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceEvent_write" ON public."ComplianceEvent"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEventCorrelation_all" ON public."ComplianceEventCorrelation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceAutomationJob_all" ON public."ComplianceAutomationJob"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceAutomationRun_select" ON public."ComplianceAutomationRun"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceAutomationRun_write" ON public."ComplianceAutomationRun"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceTask_select" ON public."ComplianceTask"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceTask_write" ON public."ComplianceTask"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceTaskAssignment_all" ON public."ComplianceTaskAssignment"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceTask" t WHERE t.id = "taskId" AND public.is_org_member(t."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceTask" t WHERE t.id = "taskId" AND public.is_org_admin(t."organizationId"))
  );

CREATE POLICY "ComplianceReviewSchedule_all" ON public."ComplianceReviewSchedule"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceScoreSnapshot_all" ON public."ComplianceScoreSnapshot"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceStatusHistory_all" ON public."ComplianceStatusHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceNotification_all" ON public."ComplianceNotification"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEscalation_all" ON public."ComplianceEscalation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceRecommendation_all" ON public."ComplianceRecommendation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEvidenceCollection_all" ON public."ComplianceEvidenceCollection"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceAutomationAuditLog_all" ON public."ComplianceAutomationAuditLog"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));
