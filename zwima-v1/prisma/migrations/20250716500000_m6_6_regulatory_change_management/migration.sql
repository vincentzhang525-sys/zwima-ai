-- M6.6 EU AI Act Regulatory Change Management

CREATE TYPE "RegulatorySourceType" AS ENUM ('EU_AI_ACT', 'IMPLEMENTING_ACT', 'HARMONISED_STANDARD', 'REGULATORY_GUIDANCE', 'MEMBER_STATE_SUPPLEMENT');
CREATE TYPE "RegulatoryRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "RegulatoryLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN', 'TRANSITION');
CREATE TYPE "RegulatoryChangeSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RegulatoryChangeClass" AS ENUM ('EDITORIAL', 'CLARIFICATION', 'SUBSTANTIVE', 'NEW_OBLIGATION', 'REPEAL', 'TRANSITIONAL');
CREATE TYPE "RegulatoryChangeStatus" AS ENUM ('DETECTED', 'CLASSIFIED', 'IMPACT_ANALYZED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTING', 'CLOSED');
CREATE TYPE "RegulatoryAnalysisStatus" AS ENUM ('DRAFT', 'COMPLETE', 'SUPERSEDED');
CREATE TYPE "RegulatoryMappingStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'APPLIED');
CREATE TYPE "RegulatoryDeltaType" AS ENUM ('ADDED', 'MODIFIED', 'REMOVED', 'REINTERPRETED');
CREATE TYPE "RegulatoryActionType" AS ENUM ('REVIEW', 'DOCUMENTATION_UPDATE', 'RISK_REASSESSMENT', 'EVIDENCE_COLLECTION', 'GAP_REMEDIATION', 'AUTOMATION_TRIGGER', 'ESCALATION');
CREATE TYPE "RegulatoryActionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'QUEUED_FOR_AUTOMATION', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RegulatoryTransitionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RegulatoryExecutionStatus" AS ENUM ('QUEUED', 'LINKED', 'FAILED', 'CANCELLED');

CREATE TABLE "RegulatorySource" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sourceType" "RegulatorySourceType" NOT NULL,
  "jurisdiction" TEXT NOT NULL DEFAULT 'EU',
  "issuer" TEXT,
  "officialUrl" TEXT,
  "status" "RegulatoryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatorySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryVersion" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "versionLabel" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "lifecycleStatus" "RegulatoryLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "transitionStartsAt" TIMESTAMP(3),
  "transitionEndsAt" TIMESTAMP(3),
  "contentMarkdown" TEXT,
  "contentJson" JSONB,
  "checksum" TEXT,
  "supersedesVersionId" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChange" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "changeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "fromVersionId" TEXT,
  "toVersionId" TEXT NOT NULL,
  "detectionMethod" TEXT NOT NULL DEFAULT 'MANUAL',
  "severity" "RegulatoryChangeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "changeClass" "RegulatoryChangeClass" NOT NULL DEFAULT 'SUBSTANTIVE',
  "status" "RegulatoryChangeStatus" NOT NULL DEFAULT 'DETECTED',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveAt" TIMESTAMP(3),
  "payload" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChangeClassification" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subcategory" TEXT,
  "rationale" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryChangeClassification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryImpactAnalysis" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "analysisKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "impactLevel" "RegulatoryChangeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "affectedScope" JSONB,
  "findings" JSONB,
  "recommendations" JSONB,
  "status" "RegulatoryAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryImpactAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryAffectedSystem" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "impactSummary" TEXT,
  "impactLevel" "RegulatoryChangeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "mappingStatus" "RegulatoryMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryAffectedSystem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryObligationDelta" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "obligationCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "deltaType" "RegulatoryDeltaType" NOT NULL DEFAULT 'MODIFIED',
  "beforeState" TEXT,
  "afterState" TEXT,
  "relatedObligationId" TEXT,
  "status" "RegulatoryMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryObligationDelta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryGapRecalc" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "gapCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "currentState" TEXT,
  "requiredState" TEXT,
  "priority" "RegulatoryChangeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "RegulatoryMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "linkedGapId" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryGapRecalc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryRequiredAction" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "actionType" "RegulatoryActionType" NOT NULL DEFAULT 'REVIEW',
  "priority" "RegulatoryChangeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "RegulatoryActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "aiSystemId" TEXT,
  "dueAt" TIMESTAMP(3),
  "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "linkedTaskId" TEXT,
  "linkedAutomationRunId" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryRequiredAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryReview" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "actionId" TEXT,
  "organizationId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "comment" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryTransitionPeriod" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "RegulatoryTransitionStatus" NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryTransitionPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryTimelineEvent" (
  "id" TEXT NOT NULL,
  "changeId" TEXT,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,
  "sourceRef" TEXT,
  "metadata" JSONB,
  CONSTRAINT "RegulatoryTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChangeEvidence" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT,
  "title" TEXT NOT NULL,
  "referenceUrl" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryChangeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryExecutionLink" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "automationRunId" TEXT,
  "automationTaskId" TEXT,
  "status" "RegulatoryExecutionStatus" NOT NULL DEFAULT 'QUEUED',
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryExecutionLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegulatorySource_organizationId_sourceKey_key" ON "RegulatorySource"("organizationId", "sourceKey");
CREATE INDEX "RegulatorySource_organizationId_sourceType_idx" ON "RegulatorySource"("organizationId", "sourceType");
CREATE INDEX "RegulatorySource_organizationId_status_idx" ON "RegulatorySource"("organizationId", "status");

CREATE UNIQUE INDEX "RegulatoryVersion_sourceId_versionLabel_key" ON "RegulatoryVersion"("sourceId", "versionLabel");
CREATE INDEX "RegulatoryVersion_organizationId_lifecycleStatus_idx" ON "RegulatoryVersion"("organizationId", "lifecycleStatus");
CREATE INDEX "RegulatoryVersion_effectiveAt_idx" ON "RegulatoryVersion"("effectiveAt");
CREATE INDEX "RegulatoryVersion_sourceId_createdAt_idx" ON "RegulatoryVersion"("sourceId", "createdAt");

CREATE UNIQUE INDEX "RegulatoryChange_organizationId_changeKey_key" ON "RegulatoryChange"("organizationId", "changeKey");
CREATE INDEX "RegulatoryChange_organizationId_status_idx" ON "RegulatoryChange"("organizationId", "status");
CREATE INDEX "RegulatoryChange_sourceId_detectedAt_idx" ON "RegulatoryChange"("sourceId", "detectedAt");
CREATE INDEX "RegulatoryChange_severity_status_idx" ON "RegulatoryChange"("severity", "status");

CREATE INDEX "RegulatoryChangeClassification_changeId_idx" ON "RegulatoryChangeClassification"("changeId");
CREATE INDEX "RegulatoryChangeClassification_organizationId_category_idx" ON "RegulatoryChangeClassification"("organizationId", "category");

CREATE UNIQUE INDEX "RegulatoryImpactAnalysis_changeId_analysisKey_key" ON "RegulatoryImpactAnalysis"("changeId", "analysisKey");
CREATE INDEX "RegulatoryImpactAnalysis_organizationId_status_idx" ON "RegulatoryImpactAnalysis"("organizationId", "status");

CREATE UNIQUE INDEX "RegulatoryAffectedSystem_changeId_aiSystemId_key" ON "RegulatoryAffectedSystem"("changeId", "aiSystemId");
CREATE INDEX "RegulatoryAffectedSystem_organizationId_aiSystemId_idx" ON "RegulatoryAffectedSystem"("organizationId", "aiSystemId");
CREATE INDEX "RegulatoryAffectedSystem_mappingStatus_idx" ON "RegulatoryAffectedSystem"("mappingStatus");

CREATE INDEX "RegulatoryObligationDelta_changeId_deltaType_idx" ON "RegulatoryObligationDelta"("changeId", "deltaType");
CREATE INDEX "RegulatoryObligationDelta_organizationId_status_idx" ON "RegulatoryObligationDelta"("organizationId", "status");

CREATE INDEX "RegulatoryGapRecalc_changeId_status_idx" ON "RegulatoryGapRecalc"("changeId", "status");
CREATE INDEX "RegulatoryGapRecalc_organizationId_aiSystemId_idx" ON "RegulatoryGapRecalc"("organizationId", "aiSystemId");

CREATE UNIQUE INDEX "RegulatoryRequiredAction_changeId_actionKey_key" ON "RegulatoryRequiredAction"("changeId", "actionKey");
CREATE INDEX "RegulatoryRequiredAction_organizationId_status_idx" ON "RegulatoryRequiredAction"("organizationId", "status");
CREATE INDEX "RegulatoryRequiredAction_dueAt_status_idx" ON "RegulatoryRequiredAction"("dueAt", "status");

CREATE INDEX "RegulatoryReview_changeId_createdAt_idx" ON "RegulatoryReview"("changeId", "createdAt");
CREATE INDEX "RegulatoryReview_organizationId_createdAt_idx" ON "RegulatoryReview"("organizationId", "createdAt");

CREATE INDEX "RegulatoryTransitionPeriod_organizationId_status_idx" ON "RegulatoryTransitionPeriod"("organizationId", "status");
CREATE INDEX "RegulatoryTransitionPeriod_startsAt_endsAt_idx" ON "RegulatoryTransitionPeriod"("startsAt", "endsAt");

CREATE INDEX "RegulatoryTimelineEvent_organizationId_occurredAt_idx" ON "RegulatoryTimelineEvent"("organizationId", "occurredAt");
CREATE INDEX "RegulatoryTimelineEvent_changeId_occurredAt_idx" ON "RegulatoryTimelineEvent"("changeId", "occurredAt");

CREATE INDEX "RegulatoryChangeEvidence_changeId_idx" ON "RegulatoryChangeEvidence"("changeId");
CREATE INDEX "RegulatoryChangeEvidence_organizationId_createdAt_idx" ON "RegulatoryChangeEvidence"("organizationId", "createdAt");

CREATE INDEX "RegulatoryExecutionLink_changeId_status_idx" ON "RegulatoryExecutionLink"("changeId", "status");
CREATE INDEX "RegulatoryExecutionLink_organizationId_createdAt_idx" ON "RegulatoryExecutionLink"("organizationId", "createdAt");

CREATE INDEX "RegulatoryAuditLog_organizationId_createdAt_idx" ON "RegulatoryAuditLog"("organizationId", "createdAt");
CREATE INDEX "RegulatoryAuditLog_action_createdAt_idx" ON "RegulatoryAuditLog"("action", "createdAt");

ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryVersion" ADD CONSTRAINT "RegulatoryVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "RegulatoryVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "RegulatoryVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChangeClassification" ADD CONSTRAINT "RegulatoryChangeClassification_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryImpactAnalysis" ADD CONSTRAINT "RegulatoryImpactAnalysis_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryAffectedSystem" ADD CONSTRAINT "RegulatoryAffectedSystem_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryAffectedSystem" ADD CONSTRAINT "RegulatoryAffectedSystem_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryObligationDelta" ADD CONSTRAINT "RegulatoryObligationDelta_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryGapRecalc" ADD CONSTRAINT "RegulatoryGapRecalc_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryRequiredAction" ADD CONSTRAINT "RegulatoryRequiredAction_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryReview" ADD CONSTRAINT "RegulatoryReview_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryReview" ADD CONSTRAINT "RegulatoryReview_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RegulatoryRequiredAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryTransitionPeriod" ADD CONSTRAINT "RegulatoryTransitionPeriod_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RegulatoryVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryTimelineEvent" ADD CONSTRAINT "RegulatoryTimelineEvent_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChangeEvidence" ADD CONSTRAINT "RegulatoryChangeEvidence_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryExecutionLink" ADD CONSTRAINT "RegulatoryExecutionLink_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryExecutionLink" ADD CONSTRAINT "RegulatoryExecutionLink_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RegulatoryRequiredAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."RegulatorySource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryChangeClassification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryImpactAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryAffectedSystem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryObligationDelta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryGapRecalc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryRequiredAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryTransitionPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryTimelineEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryChangeEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryExecutionLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RegulatoryAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RegulatorySource_select" ON public."RegulatorySource"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "RegulatorySource_write" ON public."RegulatorySource"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryVersion_select" ON public."RegulatoryVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "RegulatoryVersion_write" ON public."RegulatoryVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryChange_select" ON public."RegulatoryChange"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "RegulatoryChange_write" ON public."RegulatoryChange"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryChangeClassification_all" ON public."RegulatoryChangeClassification"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR public.is_org_member("organizationId")
    OR EXISTS (SELECT 1 FROM public."RegulatoryChange" c WHERE c.id = "changeId" AND public.is_org_member(c."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR public.is_org_admin("organizationId")
    OR EXISTS (SELECT 1 FROM public."RegulatoryChange" c WHERE c.id = "changeId" AND public.is_org_admin(c."organizationId"))
  );

CREATE POLICY "RegulatoryImpactAnalysis_all" ON public."RegulatoryImpactAnalysis"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryAffectedSystem_all" ON public."RegulatoryAffectedSystem"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryObligationDelta_all" ON public."RegulatoryObligationDelta"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryGapRecalc_all" ON public."RegulatoryGapRecalc"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryRequiredAction_select" ON public."RegulatoryRequiredAction"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "RegulatoryRequiredAction_write" ON public."RegulatoryRequiredAction"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryReview_all" ON public."RegulatoryReview"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR public.is_org_member("organizationId")
    OR EXISTS (SELECT 1 FROM public."RegulatoryChange" c WHERE c.id = "changeId" AND public.is_org_member(c."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR public.is_org_admin("organizationId")
    OR EXISTS (SELECT 1 FROM public."RegulatoryChange" c WHERE c.id = "changeId" AND public.is_org_admin(c."organizationId"))
  );

CREATE POLICY "RegulatoryTransitionPeriod_all" ON public."RegulatoryTransitionPeriod"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryTimelineEvent_all" ON public."RegulatoryTimelineEvent"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryChangeEvidence_all" ON public."RegulatoryChangeEvidence"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryExecutionLink_all" ON public."RegulatoryExecutionLink"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "RegulatoryAuditLog_all" ON public."RegulatoryAuditLog"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));
