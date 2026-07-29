-- M6.3 EU AI Act Documentation Center

CREATE TYPE "ComplianceDocumentType" AS ENUM (
  'TECHNICAL_DOCUMENTATION', 'RISK_ASSESSMENT_REPORT', 'COMPLIANCE_REPORT',
  'GAP_REPORT', 'EXECUTIVE_SUMMARY', 'AUDIT_PACKAGE'
);
CREATE TYPE "ComplianceDocumentStatus" AS ENUM (
  'DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED'
);
CREATE TYPE "ComplianceExportFormat" AS ENUM (
  'PDF', 'JSON', 'MARKDOWN', 'ZIP'
);
CREATE TYPE "ComplianceExportStatus" AS ENUM (
  'READY', 'FAILED', 'EXPIRED'
);

CREATE TABLE "ComplianceDocument" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "documentType" "ComplianceDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ComplianceDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "contentJson" JSONB,
  "contentMarkdown" TEXT,
  "generatedFrom" JSONB,
  "evidenceCoverage" JSONB,
  "ownerUserId" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "submittedBy" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "supersedesId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceDocumentSection" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "sourceReferences" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceDocumentSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ComplianceDocumentStatus" NOT NULL,
  "snapshotJson" JSONB,
  "snapshotMarkdown" TEXT,
  "changeSummary" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceDocumentReview" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "ComplianceDocumentStatus",
  "toStatus" "ComplianceDocumentStatus",
  "comment" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceDocumentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceDocumentExport" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "format" "ComplianceExportFormat" NOT NULL,
  "version" INTEGER NOT NULL,
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
  CONSTRAINT "ComplianceDocumentExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceDocumentEvidenceLink" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "role" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "ComplianceDocumentEvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidenceCategory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "ComplianceEvidenceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidenceAttachment" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "referenceUrl" TEXT,
  "documentReference" TEXT,
  "mimeType" TEXT,
  "checksum" TEXT,
  "sizeBytes" INTEGER,
  "confidentiality" "ComplianceConfidentiality" NOT NULL DEFAULT 'INTERNAL',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ComplianceEvidenceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidenceHistory" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeValue" JSONB,
  "afterValue" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceEvidenceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComplianceDocument_organizationId_documentType_idx" ON "ComplianceDocument"("organizationId", "documentType");
CREATE INDEX "ComplianceDocument_organizationId_status_idx" ON "ComplianceDocument"("organizationId", "status");
CREATE INDEX "ComplianceDocument_aiSystemId_isCurrent_idx" ON "ComplianceDocument"("aiSystemId", "isCurrent");
CREATE INDEX "ComplianceDocument_organizationId_archivedAt_idx" ON "ComplianceDocument"("organizationId", "archivedAt");

CREATE UNIQUE INDEX "ComplianceDocumentSection_documentId_sectionKey_key" ON "ComplianceDocumentSection"("documentId", "sectionKey");
CREATE INDEX "ComplianceDocumentSection_documentId_sortOrder_idx" ON "ComplianceDocumentSection"("documentId", "sortOrder");

CREATE UNIQUE INDEX "ComplianceDocumentVersion_documentId_version_key" ON "ComplianceDocumentVersion"("documentId", "version");
CREATE INDEX "ComplianceDocumentVersion_documentId_createdAt_idx" ON "ComplianceDocumentVersion"("documentId", "createdAt");

CREATE INDEX "ComplianceDocumentReview_documentId_createdAt_idx" ON "ComplianceDocumentReview"("documentId", "createdAt");

CREATE INDEX "ComplianceDocumentExport_documentId_exportedAt_idx" ON "ComplianceDocumentExport"("documentId", "exportedAt");
CREATE INDEX "ComplianceDocumentExport_organizationId_format_idx" ON "ComplianceDocumentExport"("organizationId", "format");

CREATE UNIQUE INDEX "ComplianceDocumentEvidenceLink_documentId_evidenceId_key" ON "ComplianceDocumentEvidenceLink"("documentId", "evidenceId");
CREATE INDEX "ComplianceDocumentEvidenceLink_evidenceId_idx" ON "ComplianceDocumentEvidenceLink"("evidenceId");

CREATE UNIQUE INDEX "ComplianceEvidenceCategory_organizationId_code_key" ON "ComplianceEvidenceCategory"("organizationId", "code");
CREATE INDEX "ComplianceEvidenceCategory_organizationId_isActive_idx" ON "ComplianceEvidenceCategory"("organizationId", "isActive");

CREATE INDEX "ComplianceEvidenceAttachment_evidenceId_idx" ON "ComplianceEvidenceAttachment"("evidenceId");
CREATE INDEX "ComplianceEvidenceAttachment_organizationId_idx" ON "ComplianceEvidenceAttachment"("organizationId");

CREATE INDEX "ComplianceEvidenceHistory_evidenceId_createdAt_idx" ON "ComplianceEvidenceHistory"("evidenceId", "createdAt");

ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocumentSection" ADD CONSTRAINT "ComplianceDocumentSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocumentVersion" ADD CONSTRAINT "ComplianceDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocumentReview" ADD CONSTRAINT "ComplianceDocumentReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocumentExport" ADD CONSTRAINT "ComplianceDocumentExport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocumentEvidenceLink" ADD CONSTRAINT "ComplianceDocumentEvidenceLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."ComplianceDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceDocumentSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceDocumentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceDocumentReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceDocumentExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceDocumentEvidenceLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvidenceCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvidenceAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvidenceHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ComplianceDocument_select" ON public."ComplianceDocument"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceDocument_write" ON public."ComplianceDocument"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceDocumentSection_all" ON public."ComplianceDocumentSection"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_member(d."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_admin(d."organizationId"))
  );

CREATE POLICY "ComplianceDocumentVersion_all" ON public."ComplianceDocumentVersion"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_member(d."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_admin(d."organizationId"))
  );

CREATE POLICY "ComplianceDocumentReview_all" ON public."ComplianceDocumentReview"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_member(d."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_admin(d."organizationId"))
  );

CREATE POLICY "ComplianceDocumentExport_all" ON public."ComplianceDocumentExport"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId")
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")
  );

CREATE POLICY "ComplianceDocumentEvidenceLink_all" ON public."ComplianceDocumentEvidenceLink"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_member(d."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."ComplianceDocument" d WHERE d.id = "documentId" AND public.is_org_admin(d."organizationId"))
  );

CREATE POLICY "ComplianceEvidenceCategory_select" ON public."ComplianceEvidenceCategory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceEvidenceCategory_write" ON public."ComplianceEvidenceCategory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEvidenceAttachment_select" ON public."ComplianceEvidenceAttachment"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceEvidenceAttachment_write" ON public."ComplianceEvidenceAttachment"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEvidenceHistory_select" ON public."ComplianceEvidenceHistory"
  FOR SELECT USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public."ComplianceEvidence" e
      WHERE e.id = "evidenceId" AND public.is_org_member(e."organizationId")
    )
  );
CREATE POLICY "ComplianceEvidenceHistory_write" ON public."ComplianceEvidenceHistory"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public."ComplianceEvidence" e
      WHERE e.id = "evidenceId" AND public.is_org_admin(e."organizationId")
    )
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public."ComplianceEvidence" e
      WHERE e.id = "evidenceId" AND public.is_org_admin(e."organizationId")
    )
  );
