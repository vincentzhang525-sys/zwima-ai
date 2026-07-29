-- M6.4 Audit & Evidence Center

CREATE TYPE "ComplianceAuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'REGULATORY', 'FOLLOW_UP');
CREATE TYPE "ComplianceAuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ComplianceAuditCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASS', 'FAIL', 'NOT_APPLICABLE');
CREATE TYPE "ComplianceAuditSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ComplianceAuditFindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED', 'CLOSED');
CREATE TYPE "ComplianceCorrectiveStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');
CREATE TYPE "ComplianceAuditAssigneeRole" AS ENUM ('LEAD_AUDITOR', 'REVIEWER', 'APPROVER', 'OBSERVER');
CREATE TYPE "ComplianceIntegrityStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISMATCH', 'FAILED');

CREATE TABLE "ComplianceAuditSession" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "sessionKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "auditType" "ComplianceAuditType" NOT NULL DEFAULT 'INTERNAL',
  "status" "ComplianceAuditStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedStartAt" TIMESTAMP(3),
  "plannedEndAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "scopeSummary" TEXT,
  "planningNotes" TEXT,
  "ownerUserId" TEXT,
  "leadAuditorUserId" TEXT,
  "submittedBy" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAuditSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditChecklistItem" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "ComplianceAuditCheckStatus" NOT NULL DEFAULT 'PENDING',
  "evidenceId" TEXT,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAuditChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditFinding" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "findingKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" "ComplianceAuditSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "ComplianceAuditFindingStatus" NOT NULL DEFAULT 'OPEN',
  "criterionRef" TEXT,
  "evidenceId" TEXT,
  "documentId" TEXT,
  "ownerUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAuditFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditCorrectiveAction" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "findingId" TEXT,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ComplianceCorrectiveStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ComplianceAuditSeverity" NOT NULL DEFAULT 'MEDIUM',
  "ownerUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAuditCorrectiveAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditEvidenceLink" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "findingId" TEXT,
  "checklistItemId" TEXT,
  "role" TEXT,
  "integrityHash" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceAuditEvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditAssignment" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ComplianceAuditAssigneeRole" NOT NULL DEFAULT 'REVIEWER',
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ComplianceAuditAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditReview" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "ComplianceAuditStatus",
  "toStatus" "ComplianceAuditStatus",
  "comment" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceAuditReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditReport" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ComplianceDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "contentMarkdown" TEXT,
  "contentJson" JSONB,
  "generatedFrom" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAuditReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditExport" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "format" "ComplianceExportFormat" NOT NULL,
  "fileName" TEXT NOT NULL,
  "checksum" TEXT,
  "byteSize" INTEGER NOT NULL DEFAULT 0,
  "contentBase64" TEXT,
  "status" "ComplianceExportStatus" NOT NULL DEFAULT 'READY',
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "lastDownloadedAt" TIMESTAMP(3),
  "exportedBy" TEXT,
  "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceAuditExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAuditTimelineEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "evidenceId" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "actorUserId" TEXT,
  "sourceRef" TEXT,
  "integrityHash" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "ComplianceAuditTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidenceIntegrityRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'sha256',
  "status" "ComplianceIntegrityStatus" NOT NULL DEFAULT 'VERIFIED',
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceEvidenceIntegrityRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceAuditSession_organizationId_sessionKey_key" ON "ComplianceAuditSession"("organizationId", "sessionKey");
CREATE INDEX "ComplianceAuditSession_organizationId_status_idx" ON "ComplianceAuditSession"("organizationId", "status");
CREATE INDEX "ComplianceAuditSession_aiSystemId_status_idx" ON "ComplianceAuditSession"("aiSystemId", "status");
CREATE INDEX "ComplianceAuditSession_organizationId_archivedAt_idx" ON "ComplianceAuditSession"("organizationId", "archivedAt");

CREATE UNIQUE INDEX "ComplianceAuditChecklistItem_sessionId_itemKey_key" ON "ComplianceAuditChecklistItem"("sessionId", "itemKey");
CREATE INDEX "ComplianceAuditChecklistItem_sessionId_status_idx" ON "ComplianceAuditChecklistItem"("sessionId", "status");

CREATE UNIQUE INDEX "ComplianceAuditFinding_sessionId_findingKey_key" ON "ComplianceAuditFinding"("sessionId", "findingKey");
CREATE INDEX "ComplianceAuditFinding_sessionId_status_idx" ON "ComplianceAuditFinding"("sessionId", "status");
CREATE INDEX "ComplianceAuditFinding_organizationId_severity_idx" ON "ComplianceAuditFinding"("organizationId", "severity");

CREATE INDEX "ComplianceAuditCorrectiveAction_sessionId_status_idx" ON "ComplianceAuditCorrectiveAction"("sessionId", "status");
CREATE INDEX "ComplianceAuditCorrectiveAction_organizationId_status_idx" ON "ComplianceAuditCorrectiveAction"("organizationId", "status");
CREATE INDEX "ComplianceAuditCorrectiveAction_findingId_idx" ON "ComplianceAuditCorrectiveAction"("findingId");

CREATE UNIQUE INDEX "ComplianceAuditEvidenceLink_sessionId_evidenceId_role_key" ON "ComplianceAuditEvidenceLink"("sessionId", "evidenceId", "role");
CREATE INDEX "ComplianceAuditEvidenceLink_evidenceId_idx" ON "ComplianceAuditEvidenceLink"("evidenceId");
CREATE INDEX "ComplianceAuditEvidenceLink_sessionId_idx" ON "ComplianceAuditEvidenceLink"("sessionId");

CREATE UNIQUE INDEX "ComplianceAuditAssignment_sessionId_userId_role_key" ON "ComplianceAuditAssignment"("sessionId", "userId", "role");
CREATE INDEX "ComplianceAuditAssignment_userId_isActive_idx" ON "ComplianceAuditAssignment"("userId", "isActive");

CREATE INDEX "ComplianceAuditReview_sessionId_createdAt_idx" ON "ComplianceAuditReview"("sessionId", "createdAt");

CREATE INDEX "ComplianceAuditReport_sessionId_version_idx" ON "ComplianceAuditReport"("sessionId", "version");
CREATE INDEX "ComplianceAuditReport_organizationId_idx" ON "ComplianceAuditReport"("organizationId");

CREATE INDEX "ComplianceAuditExport_sessionId_exportedAt_idx" ON "ComplianceAuditExport"("sessionId", "exportedAt");
CREATE INDEX "ComplianceAuditExport_organizationId_format_idx" ON "ComplianceAuditExport"("organizationId", "format");

CREATE INDEX "ComplianceAuditTimelineEvent_organizationId_occurredAt_idx" ON "ComplianceAuditTimelineEvent"("organizationId", "occurredAt");
CREATE INDEX "ComplianceAuditTimelineEvent_sessionId_occurredAt_idx" ON "ComplianceAuditTimelineEvent"("sessionId", "occurredAt");
CREATE INDEX "ComplianceAuditTimelineEvent_evidenceId_occurredAt_idx" ON "ComplianceAuditTimelineEvent"("evidenceId", "occurredAt");

CREATE INDEX "ComplianceEvidenceIntegrityRecord_evidenceId_verifiedAt_idx" ON "ComplianceEvidenceIntegrityRecord"("evidenceId", "verifiedAt");
CREATE INDEX "ComplianceEvidenceIntegrityRecord_organizationId_status_idx" ON "ComplianceEvidenceIntegrityRecord"("organizationId", "status");

ALTER TABLE "ComplianceAuditSession" ADD CONSTRAINT "ComplianceAuditSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditSession" ADD CONSTRAINT "ComplianceAuditSession_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditChecklistItem" ADD CONSTRAINT "ComplianceAuditChecklistItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditFinding" ADD CONSTRAINT "ComplianceAuditFinding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditCorrectiveAction" ADD CONSTRAINT "ComplianceAuditCorrectiveAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditCorrectiveAction" ADD CONSTRAINT "ComplianceAuditCorrectiveAction_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ComplianceAuditFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditEvidenceLink" ADD CONSTRAINT "ComplianceAuditEvidenceLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditAssignment" ADD CONSTRAINT "ComplianceAuditAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditReview" ADD CONSTRAINT "ComplianceAuditReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditReport" ADD CONSTRAINT "ComplianceAuditReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditExport" ADD CONSTRAINT "ComplianceAuditExport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAuditTimelineEvent" ADD CONSTRAINT "ComplianceAuditTimelineEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComplianceAuditSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."ComplianceAuditSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditCorrectiveAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditEvidenceLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceAuditTimelineEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvidenceIntegrityRecord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ComplianceAuditSession_select" ON public."ComplianceAuditSession"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceAuditSession_write" ON public."ComplianceAuditSession"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceAuditChecklistItem_all" ON public."ComplianceAuditChecklistItem"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "ComplianceAuditFinding_all" ON public."ComplianceAuditFinding"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );

CREATE POLICY "ComplianceAuditCorrectiveAction_all" ON public."ComplianceAuditCorrectiveAction"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );

CREATE POLICY "ComplianceAuditEvidenceLink_all" ON public."ComplianceAuditEvidenceLink"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "ComplianceAuditAssignment_all" ON public."ComplianceAuditAssignment"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "ComplianceAuditReview_all" ON public."ComplianceAuditReview"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceAuditSession" s WHERE s.id = "sessionId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "ComplianceAuditReport_all" ON public."ComplianceAuditReport"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );

CREATE POLICY "ComplianceAuditExport_all" ON public."ComplianceAuditExport"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );

CREATE POLICY "ComplianceAuditTimelineEvent_all" ON public."ComplianceAuditTimelineEvent"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );

CREATE POLICY "ComplianceEvidenceIntegrityRecord_all" ON public."ComplianceEvidenceIntegrityRecord"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );
