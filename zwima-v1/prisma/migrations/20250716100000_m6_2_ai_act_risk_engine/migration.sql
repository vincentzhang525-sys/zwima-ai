-- M6.2 EU AI Act Risk Engine

CREATE TYPE "AIActRiskTier" AS ENUM (
  'MINIMAL_RISK', 'LIMITED_RISK', 'HIGH_RISK', 'PROHIBITED'
);
CREATE TYPE "AIActRiskClassificationMethod" AS ENUM (
  'RULE_BASED', 'MANUAL_OVERRIDE'
);
CREATE TYPE "AIActRiskClassificationStatus" AS ENUM (
  'DRAFT', 'CONFIRMED', 'SUPERSEDED'
);
CREATE TYPE "AIActObligationType" AS ENUM (
  'REQUIRED_DOCUMENTATION', 'HUMAN_OVERSIGHT', 'LOGGING_REQUIREMENT',
  'TRANSPARENCY_REQUIREMENT', 'DATA_GOVERNANCE_REQUIREMENT',
  'POST_MARKET_MONITORING', 'REGISTRATION_REQUIREMENT', 'INCIDENT_REPORTING'
);
CREATE TYPE "AIActObligationStatus" AS ENUM (
  'REQUIRED', 'IN_PROGRESS', 'FULFILLED', 'WAIVED'
);
CREATE TYPE "AIActRiskOverallStatus" AS ENUM (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NOT_ASSESSED'
);
CREATE TYPE "AIActMitigationStatus" AS ENUM (
  'NONE', 'PLANNED', 'IN_PROGRESS', 'COMPLETE'
);
CREATE TYPE "AIActGapPriority" AS ENUM (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);
CREATE TYPE "AIActGapStatus" AS ENUM (
  'OPEN', 'IN_PROGRESS', 'CLOSED'
);
CREATE TYPE "AIActRecommendationStatus" AS ENUM (
  'OPEN', 'ACKNOWLEDGED', 'COMPLETED', 'DISMISSED'
);

CREATE TABLE "AISystemRiskClassification" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "riskTier" "AIActRiskTier" NOT NULL,
  "classificationMethod" "AIActRiskClassificationMethod" NOT NULL,
  "status" "AIActRiskClassificationStatus" NOT NULL DEFAULT 'DRAFT',
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "ruleVersion" TEXT NOT NULL DEFAULT 'eu-ai-act-rules-v1',
  "summary" TEXT,
  "explainability" JSONB,
  "annexIIICategories" JSONB,
  "evidenceId" TEXT,
  "overriddenBy" TEXT,
  "overrideReason" TEXT,
  "confirmedBy" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemRiskClassification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemRiskRuleResult" (
  "id" TEXT NOT NULL,
  "classificationId" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "ruleCode" TEXT NOT NULL,
  "ruleName" TEXT NOT NULL,
  "triggered" BOOLEAN NOT NULL DEFAULT false,
  "weight" INTEGER NOT NULL DEFAULT 0,
  "contribution" TEXT,
  "sourceFieldPath" TEXT,
  "sourceValue" TEXT,
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AISystemRiskRuleResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemRiskClassificationHistory" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "classificationId" TEXT,
  "previousTier" "AIActRiskTier",
  "newTier" "AIActRiskTier" NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "method" "AIActRiskClassificationMethod" NOT NULL,
  "reason" TEXT,
  "changedBy" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidenceReferences" JSONB,
  CONSTRAINT "AISystemRiskClassificationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemRiskAssessment" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "classificationId" TEXT,
  "version" INTEGER NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "likelihood" INTEGER NOT NULL,
  "severity" INTEGER NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "residualRiskScore" INTEGER NOT NULL,
  "matrixPosition" TEXT,
  "mitigationStatus" "AIActMitigationStatus" NOT NULL DEFAULT 'NONE',
  "overallStatus" "AIActRiskOverallStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "assessedBy" TEXT,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemRiskAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemRiskObligation" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "obligationType" "AIActObligationType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "AIActObligationStatus" NOT NULL DEFAULT 'REQUIRED',
  "priority" "AIActGapPriority" NOT NULL DEFAULT 'MEDIUM',
  "ownerUserId" TEXT,
  "deadline" TIMESTAMP(3),
  "evidenceId" TEXT,
  "sourceRiskTier" "AIActRiskTier",
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemRiskObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemComplianceGap" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "gapCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "currentState" TEXT NOT NULL,
  "requiredState" TEXT NOT NULL,
  "priority" "AIActGapPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "AIActGapStatus" NOT NULL DEFAULT 'OPEN',
  "ownerUserId" TEXT,
  "deadline" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemComplianceGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISystemRiskRecommendation" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendationType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "AIActGapPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "AIActRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "relatedGapId" TEXT,
  "relatedObligationId" TEXT,
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISystemRiskRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AISystemRiskClassification_aiSystemId_version_key" ON "AISystemRiskClassification"("aiSystemId", "version");
CREATE INDEX "AISystemRiskClassification_aiSystemId_isCurrent_idx" ON "AISystemRiskClassification"("aiSystemId", "isCurrent");
CREATE INDEX "AISystemRiskClassification_organizationId_riskTier_idx" ON "AISystemRiskClassification"("organizationId", "riskTier");
CREATE INDEX "AISystemRiskClassification_organizationId_status_idx" ON "AISystemRiskClassification"("organizationId", "status");

CREATE INDEX "AISystemRiskRuleResult_classificationId_idx" ON "AISystemRiskRuleResult"("classificationId");
CREATE INDEX "AISystemRiskRuleResult_aiSystemId_ruleCode_idx" ON "AISystemRiskRuleResult"("aiSystemId", "ruleCode");

CREATE INDEX "AISystemRiskClassificationHistory_aiSystemId_changedAt_idx" ON "AISystemRiskClassificationHistory"("aiSystemId", "changedAt");

CREATE UNIQUE INDEX "AISystemRiskAssessment_aiSystemId_version_key" ON "AISystemRiskAssessment"("aiSystemId", "version");
CREATE INDEX "AISystemRiskAssessment_aiSystemId_isCurrent_idx" ON "AISystemRiskAssessment"("aiSystemId", "isCurrent");
CREATE INDEX "AISystemRiskAssessment_organizationId_overallStatus_idx" ON "AISystemRiskAssessment"("organizationId", "overallStatus");

CREATE INDEX "AISystemRiskObligation_aiSystemId_obligationType_idx" ON "AISystemRiskObligation"("aiSystemId", "obligationType");
CREATE INDEX "AISystemRiskObligation_organizationId_status_idx" ON "AISystemRiskObligation"("organizationId", "status");
CREATE INDEX "AISystemRiskObligation_deadline_idx" ON "AISystemRiskObligation"("deadline");

CREATE INDEX "AISystemComplianceGap_aiSystemId_status_idx" ON "AISystemComplianceGap"("aiSystemId", "status");
CREATE INDEX "AISystemComplianceGap_organizationId_priority_idx" ON "AISystemComplianceGap"("organizationId", "priority");

CREATE INDEX "AISystemRiskRecommendation_aiSystemId_status_idx" ON "AISystemRiskRecommendation"("aiSystemId", "status");
CREATE INDEX "AISystemRiskRecommendation_organizationId_priority_idx" ON "AISystemRiskRecommendation"("organizationId", "priority");

ALTER TABLE "AISystemRiskClassification" ADD CONSTRAINT "AISystemRiskClassification_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRiskRuleResult" ADD CONSTRAINT "AISystemRiskRuleResult_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AISystemRiskClassification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRiskClassificationHistory" ADD CONSTRAINT "AISystemRiskClassificationHistory_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AISystemRiskClassification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRiskAssessment" ADD CONSTRAINT "AISystemRiskAssessment_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRiskAssessment" ADD CONSTRAINT "AISystemRiskAssessment_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AISystemRiskClassification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRiskObligation" ADD CONSTRAINT "AISystemRiskObligation_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemComplianceGap" ADD CONSTRAINT "AISystemComplianceGap_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AISystemRiskRecommendation" ADD CONSTRAINT "AISystemRiskRecommendation_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."AISystemRiskClassification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemRiskRuleResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemRiskClassificationHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemRiskAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemRiskObligation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemComplianceGap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AISystemRiskRecommendation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AISystemRiskClassification_all" ON public."AISystemRiskClassification"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemRiskRuleResult_all" ON public."AISystemRiskRuleResult"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemRiskClassificationHistory_all" ON public."AISystemRiskClassificationHistory"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemRiskAssessment_all" ON public."AISystemRiskAssessment"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemRiskObligation_all" ON public."AISystemRiskObligation"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemComplianceGap_all" ON public."AISystemComplianceGap"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );

CREATE POLICY "AISystemRiskRecommendation_all" ON public."AISystemRiskRecommendation"
  FOR ALL USING (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_member(s."organizationId"))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public."AISystem" s WHERE s.id = "aiSystemId" AND public.is_org_admin(s."organizationId"))
  );
