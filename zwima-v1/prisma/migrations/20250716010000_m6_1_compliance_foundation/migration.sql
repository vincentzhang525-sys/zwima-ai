-- M6.1 EU AI Act Compliance Foundation & AI System Registry

CREATE TYPE "ComplianceWorkspaceRole" AS ENUM (
  'COMPLIANCE_VIEWER', 'COMPLIANCE_EDITOR', 'COMPLIANCE_REVIEWER', 'COMPLIANCE_ADMIN'
);
CREATE TYPE "ComplianceRecordStatus" AS ENUM (
  'DRAFT', 'IN_REVIEW', 'INFORMATION_REQUIRED', 'APPROVED',
  'CONDITIONALLY_APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED'
);
CREATE TYPE "AISystemLifecycleStatus" AS ENUM (
  'DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED', 'ARCHIVED'
);
CREATE TYPE "AIActOperatorRoleType" AS ENUM (
  'PROVIDER', 'DEPLOYER', 'IMPORTER', 'DISTRIBUTOR',
  'PRODUCT_MANUFACTURER', 'AUTHORIZED_REPRESENTATIVE', 'OPERATOR', 'OTHER'
);
CREATE TYPE "ComplianceEvidenceType" AS ENUM (
  'POLICY', 'CONTRACT', 'DPA', 'DPIA', 'TECHNICAL_DOCUMENT', 'TEST_REPORT',
  'MODEL_CARD', 'DATA_SHEET', 'RISK_ASSESSMENT', 'SECURITY_REPORT',
  'AUDIT_REPORT', 'PROVIDER_DOCUMENT', 'HUMAN_OVERSIGHT_PROCEDURE',
  'INCIDENT_REPORT', 'APPROVAL_RECORD', 'OTHER'
);
CREATE TYPE "ComplianceConfidentiality" AS ENUM (
  'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'
);

CREATE TABLE "ComplianceRoleAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ComplianceWorkspaceRole" NOT NULL,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "intendedPurposeSummary" TEXT,
  "prohibitedPurpose" TEXT,
  "systemType" TEXT,
  "lifecycleStatus" "AISystemLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "deploymentStatus" TEXT,
  "complianceStatus" "ComplianceRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "geographicScope" TEXT,
  "targetUsers" TEXT,
  "affectedPersons" TEXT,
  "industrySector" TEXT,
  "decisionImpact" TEXT,
  "automationLevel" TEXT,
  "humanOversightRequired" BOOLEAN NOT NULL DEFAULT true,
  "humanOversightOwner" TEXT,
  "ownerUserId" TEXT,
  "complianceOwnerUserId" TEXT,
  "technicalOwnerUserId" TEXT,
  "primaryProviderId" TEXT,
  "primaryModelId" TEXT,
  "primaryModelVersionId" TEXT,
  "submittedForReviewBy" TEXT,
  "submittedForReviewAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "AISystem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemChangeLog" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fieldPath" TEXT,
  "beforeValue" JSONB,
  "afterValue" JSONB,
  "reason" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AISystemChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemIntendedPurpose" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "businessPurpose" TEXT NOT NULL,
  "userScenario" TEXT,
  "inputDescription" TEXT,
  "outputDescription" TEXT,
  "decisionSupported" TEXT,
  "decisionAutomated" BOOLEAN NOT NULL DEFAULT false,
  "decisionConsequences" TEXT,
  "intendedUsers" TEXT,
  "affectedGroups" TEXT,
  "usageEnvironment" TEXT,
  "prohibitedUses" TEXT,
  "knownLimitations" TEXT,
  "humanReviewProcess" TEXT,
  "fallbackProcess" TEXT,
  "monitoringProcess" TEXT,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersedesId" TEXT,
  CONSTRAINT "AISystemIntendedPurpose_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemProviderMapping" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "usagePurpose" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "approvedForProduction" BOOLEAN NOT NULL DEFAULT false,
  "allowedRegions" TEXT,
  "prohibitedRegions" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemProviderMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemModelMapping" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "modelRegistryId" TEXT NOT NULL,
  "usagePurpose" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "approvedForProduction" BOOLEAN NOT NULL DEFAULT false,
  "allowedRegions" TEXT,
  "prohibitedRegions" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemModelMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemModelVersionMapping" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "modelVersionId" TEXT NOT NULL,
  "usagePurpose" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "approvedForProduction" BOOLEAN NOT NULL DEFAULT false,
  "allowedRegions" TEXT,
  "prohibitedRegions" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemModelVersionMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemRoutingPolicyMapping" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "routingPolicyId" TEXT NOT NULL,
  "usagePurpose" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "approvedForProduction" BOOLEAN NOT NULL DEFAULT false,
  "allowedRegions" TEXT,
  "prohibitedRegions" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemRoutingPolicyMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemDeployment" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "region" TEXT,
  "country" TEXT,
  "endpointReference" TEXT,
  "deploymentOwner" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "currentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "processingMode" TEXT,
  "realTimeOrBatch" TEXT,
  "humanInTheLoop" BOOLEAN NOT NULL DEFAULT true,
  "fallbackAvailable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "AISystemDeployment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemOperatorRole" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "organizationId" TEXT,
  "roleType" "AIActOperatorRoleType" NOT NULL,
  "jurisdiction" TEXT,
  "legalEntityName" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "contactPerson" TEXT,
  "contactEmail" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "evidenceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "confirmedBy" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemOperatorRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemDataCategory" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "dataCategory" TEXT NOT NULL,
  "inputOrOutput" TEXT NOT NULL,
  "source" TEXT,
  "purpose" TEXT,
  "retentionSummary" TEXT,
  "crossBorderTransfer" BOOLEAN NOT NULL DEFAULT false,
  "storageRegion" TEXT,
  "containsPersonalData" BOOLEAN NOT NULL DEFAULT false,
  "containsSpecialCategory" BOOLEAN NOT NULL DEFAULT false,
  "legalBasisReference" TEXT,
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "AISystemDataCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidence" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aiSystemId" TEXT,
  "evidenceType" "ComplianceEvidenceType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "source" TEXT,
  "sourceUrl" TEXT,
  "documentReference" TEXT,
  "version" TEXT NOT NULL DEFAULT '1',
  "issuedAt" TIMESTAMP(3),
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "ownerUserId" TEXT,
  "checksum" TEXT,
  "confidentiality" "ComplianceConfidentiality" NOT NULL DEFAULT 'INTERNAL',
  "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "ComplianceEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemStatusTransition" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "previousStatus" "ComplianceRecordStatus" NOT NULL,
  "newStatus" "ComplianceRecordStatus" NOT NULL,
  "reason" TEXT,
  "changedBy" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidenceReferences" JSONB,
  "approvalReference" TEXT,
  CONSTRAINT "AISystemStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemReviewAction" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "ComplianceRecordStatus",
  "toStatus" "ComplianceRecordStatus",
  "comment" TEXT,
  "conditions" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AISystemReviewAction_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "ComplianceRoleAssignment_organizationId_userId_role_key" ON "ComplianceRoleAssignment"("organizationId", "userId", "role");
CREATE INDEX "ComplianceRoleAssignment_organizationId_isActive_idx" ON "ComplianceRoleAssignment"("organizationId", "isActive");
CREATE INDEX "ComplianceRoleAssignment_userId_isActive_idx" ON "ComplianceRoleAssignment"("userId", "isActive");

CREATE UNIQUE INDEX "AISystem_workspaceId_systemKey_key" ON "AISystem"("workspaceId", "systemKey");
CREATE INDEX "AISystem_organizationId_complianceStatus_idx" ON "AISystem"("organizationId", "complianceStatus");
CREATE INDEX "AISystem_organizationId_archivedAt_idx" ON "AISystem"("organizationId", "archivedAt");
CREATE INDEX "AISystem_ownerUserId_idx" ON "AISystem"("ownerUserId");
CREATE INDEX "AISystem_complianceOwnerUserId_idx" ON "AISystem"("complianceOwnerUserId");

CREATE INDEX "AISystemChangeLog_aiSystemId_createdAt_idx" ON "AISystemChangeLog"("aiSystemId", "createdAt");
CREATE UNIQUE INDEX "AISystemIntendedPurpose_aiSystemId_version_key" ON "AISystemIntendedPurpose"("aiSystemId", "version");
CREATE INDEX "AISystemIntendedPurpose_aiSystemId_isCurrent_idx" ON "AISystemIntendedPurpose"("aiSystemId", "isCurrent");

CREATE UNIQUE INDEX "AISystemProviderMapping_aiSystemId_providerId_key" ON "AISystemProviderMapping"("aiSystemId", "providerId");
CREATE INDEX "AISystemProviderMapping_aiSystemId_idx" ON "AISystemProviderMapping"("aiSystemId");
CREATE INDEX "AISystemProviderMapping_providerId_idx" ON "AISystemProviderMapping"("providerId");

CREATE UNIQUE INDEX "AISystemModelMapping_aiSystemId_modelRegistryId_key" ON "AISystemModelMapping"("aiSystemId", "modelRegistryId");
CREATE INDEX "AISystemModelMapping_aiSystemId_idx" ON "AISystemModelMapping"("aiSystemId");
CREATE INDEX "AISystemModelMapping_modelRegistryId_idx" ON "AISystemModelMapping"("modelRegistryId");

CREATE UNIQUE INDEX "AISystemModelVersionMapping_aiSystemId_modelVersionId_key" ON "AISystemModelVersionMapping"("aiSystemId", "modelVersionId");
CREATE INDEX "AISystemModelVersionMapping_aiSystemId_idx" ON "AISystemModelVersionMapping"("aiSystemId");
CREATE INDEX "AISystemModelVersionMapping_modelVersionId_idx" ON "AISystemModelVersionMapping"("modelVersionId");

CREATE UNIQUE INDEX "AISystemRoutingPolicyMapping_aiSystemId_routingPolicyId_key" ON "AISystemRoutingPolicyMapping"("aiSystemId", "routingPolicyId");
CREATE INDEX "AISystemRoutingPolicyMapping_aiSystemId_idx" ON "AISystemRoutingPolicyMapping"("aiSystemId");

CREATE INDEX "AISystemDeployment_aiSystemId_environment_idx" ON "AISystemDeployment"("aiSystemId", "environment");
CREATE INDEX "AISystemDeployment_aiSystemId_currentStatus_idx" ON "AISystemDeployment"("aiSystemId", "currentStatus");

CREATE INDEX "AISystemOperatorRole_aiSystemId_roleType_idx" ON "AISystemOperatorRole"("aiSystemId", "roleType");
CREATE INDEX "AISystemOperatorRole_status_idx" ON "AISystemOperatorRole"("status");

CREATE INDEX "AISystemDataCategory_aiSystemId_dataCategory_idx" ON "AISystemDataCategory"("aiSystemId", "dataCategory");

CREATE INDEX "ComplianceEvidence_organizationId_evidenceType_idx" ON "ComplianceEvidence"("organizationId", "evidenceType");
CREATE INDEX "ComplianceEvidence_aiSystemId_idx" ON "ComplianceEvidence"("aiSystemId");
CREATE INDEX "ComplianceEvidence_validUntil_idx" ON "ComplianceEvidence"("validUntil");
CREATE INDEX "ComplianceEvidence_verificationStatus_idx" ON "ComplianceEvidence"("verificationStatus");

CREATE INDEX "AISystemStatusTransition_aiSystemId_changedAt_idx" ON "AISystemStatusTransition"("aiSystemId", "changedAt");
CREATE INDEX "AISystemReviewAction_aiSystemId_createdAt_idx" ON "AISystemReviewAction"("aiSystemId", "createdAt");
CREATE INDEX "AISystemReviewAction_action_idx" ON "AISystemReviewAction"("action");

-- FKs (Restrict — no cascade delete of compliance history)
ALTER TABLE "ComplianceRoleAssignment" ADD CONSTRAINT "ComplianceRoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceRoleAssignment" ADD CONSTRAINT "ComplianceRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystem" ADD CONSTRAINT "AISystem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemChangeLog" ADD CONSTRAINT "AISystemChangeLog_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemIntendedPurpose" ADD CONSTRAINT "AISystemIntendedPurpose_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemProviderMapping" ADD CONSTRAINT "AISystemProviderMapping_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemModelMapping" ADD CONSTRAINT "AISystemModelMapping_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemModelVersionMapping" ADD CONSTRAINT "AISystemModelVersionMapping_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRoutingPolicyMapping" ADD CONSTRAINT "AISystemRoutingPolicyMapping_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemDeployment" ADD CONSTRAINT "AISystemDeployment_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemOperatorRole" ADD CONSTRAINT "AISystemOperatorRole_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemDataCategory" ADD CONSTRAINT "AISystemDataCategory_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemStatusTransition" ADD CONSTRAINT "AISystemStatusTransition_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemReviewAction" ADD CONSTRAINT "AISystemReviewAction_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE public."ComplianceRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemChangeLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemIntendedPurpose" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemProviderMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemModelMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemModelVersionMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemRoutingPolicyMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemDeployment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemOperatorRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemDataCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemStatusTransition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemReviewAction" ENABLE ROW LEVEL SECURITY;

-- Org-scoped policies
CREATE POLICY "ComplianceRoleAssignment_select" ON public."ComplianceRoleAssignment"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceRoleAssignment_write" ON public."ComplianceRoleAssignment"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "AISystem_select" ON public."AISystem"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "AISystem_write" ON public."AISystem"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "ComplianceEvidence_select" ON public."ComplianceEvidence"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "ComplianceEvidence_write" ON public."ComplianceEvidence"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- Child tables via AISystem membership (join-safe: service/admin or org via parent)
CREATE POLICY "AISystemChangeLog_all" ON public."AISystemChangeLog"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemIntendedPurpose_all" ON public."AISystemIntendedPurpose"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemProviderMapping_all" ON public."AISystemProviderMapping"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemModelMapping_all" ON public."AISystemModelMapping"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemModelVersionMapping_all" ON public."AISystemModelVersionMapping"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemRoutingPolicyMapping_all" ON public."AISystemRoutingPolicyMapping"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemDeployment_all" ON public."AISystemDeployment"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemOperatorRole_all" ON public."AISystemOperatorRole"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemDataCategory_all" ON public."AISystemDataCategory"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemStatusTransition_all" ON public."AISystemStatusTransition"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemReviewAction_all" ON public."AISystemReviewAction"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );
