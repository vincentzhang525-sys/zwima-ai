-- ZWIMA v1 — RLS security gap fix (M8–M11 / V1.1 additive tables)
-- Generated: 2026-07-22T08:47:59.752Z
-- DO NOT auto-apply. Review + authorize before execution.
-- Idempotent: safe to re-run. Wrapped in transaction. No data deletion.

BEGIN;


-- ═══════════════════════════════════════════════════════════════════
-- GROUP A
-- ═══════════════════════════════════════════════════════════════════

-- [Group A] CostCalculation
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."CostCalculation" FROM anon;
REVOKE ALL ON TABLE public."CostCalculation" FROM authenticated;
ALTER TABLE public."CostCalculation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CostCalculation_select" ON public."CostCalculation";
DROP POLICY IF EXISTS "CostCalculation_service_all" ON public."CostCalculation";
CREATE POLICY "CostCalculation_service_all" ON public."CostCalculation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] CostProfile
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."CostProfile" FROM anon;
REVOKE ALL ON TABLE public."CostProfile" FROM authenticated;
ALTER TABLE public."CostProfile" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CostProfile_select" ON public."CostProfile";
CREATE POLICY "CostProfile_select" ON public."CostProfile"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "CostProfile_service_write" ON public."CostProfile";
CREATE POLICY "CostProfile_service_write" ON public."CostProfile"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] ModelEffectiveCostSnapshot
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ModelEffectiveCostSnapshot" FROM anon;
REVOKE ALL ON TABLE public."ModelEffectiveCostSnapshot" FROM authenticated;
ALTER TABLE public."ModelEffectiveCostSnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ModelEffectiveCostSnapshot_select" ON public."ModelEffectiveCostSnapshot";
DROP POLICY IF EXISTS "ModelEffectiveCostSnapshot_service_all" ON public."ModelEffectiveCostSnapshot";
CREATE POLICY "ModelEffectiveCostSnapshot_service_all" ON public."ModelEffectiveCostSnapshot"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] ModelMigrationPolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ModelMigrationPolicy" FROM anon;
REVOKE ALL ON TABLE public."ModelMigrationPolicy" FROM authenticated;
ALTER TABLE public."ModelMigrationPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ModelMigrationPolicy_select" ON public."ModelMigrationPolicy";
CREATE POLICY "ModelMigrationPolicy_select" ON public."ModelMigrationPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelMigrationPolicy_service_write" ON public."ModelMigrationPolicy";
CREATE POLICY "ModelMigrationPolicy_service_write" ON public."ModelMigrationPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] PriceHistory
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."PriceHistory" FROM anon;
REVOKE ALL ON TABLE public."PriceHistory" FROM authenticated;
ALTER TABLE public."PriceHistory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PriceHistory_select" ON public."PriceHistory";
CREATE POLICY "PriceHistory_select" ON public."PriceHistory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "PriceHistory_service_write" ON public."PriceHistory";
CREATE POLICY "PriceHistory_service_write" ON public."PriceHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] PriceVersion
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."PriceVersion" FROM anon;
REVOKE ALL ON TABLE public."PriceVersion" FROM authenticated;
ALTER TABLE public."PriceVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PriceVersion_select" ON public."PriceVersion";
CREATE POLICY "PriceVersion_select" ON public."PriceVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "PriceVersion_service_write" ON public."PriceVersion";
CREATE POLICY "PriceVersion_service_write" ON public."PriceVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] ProcessingRegionRegistry
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ProcessingRegionRegistry" FROM anon;
REVOKE ALL ON TABLE public."ProcessingRegionRegistry" FROM authenticated;
ALTER TABLE public."ProcessingRegionRegistry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ProcessingRegionRegistry_select" ON public."ProcessingRegionRegistry";
CREATE POLICY "ProcessingRegionRegistry_select" ON public."ProcessingRegionRegistry"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ProcessingRegionRegistry_service_write" ON public."ProcessingRegionRegistry";
CREATE POLICY "ProcessingRegionRegistry_service_write" ON public."ProcessingRegionRegistry"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] ProviderRegionCapability
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ProviderRegionCapability" FROM anon;
REVOKE ALL ON TABLE public."ProviderRegionCapability" FROM authenticated;
ALTER TABLE public."ProviderRegionCapability" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ProviderRegionCapability_select" ON public."ProviderRegionCapability";
CREATE POLICY "ProviderRegionCapability_select" ON public."ProviderRegionCapability"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ProviderRegionCapability_service_write" ON public."ProviderRegionCapability";
CREATE POLICY "ProviderRegionCapability_service_write" ON public."ProviderRegionCapability"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group A] TaskCostProfile
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."TaskCostProfile" FROM anon;
REVOKE ALL ON TABLE public."TaskCostProfile" FROM authenticated;
ALTER TABLE public."TaskCostProfile" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TaskCostProfile_select" ON public."TaskCostProfile";
CREATE POLICY "TaskCostProfile_select" ON public."TaskCostProfile"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "TaskCostProfile_service_write" ON public."TaskCostProfile";
CREATE POLICY "TaskCostProfile_service_write" ON public."TaskCostProfile"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- ═══════════════════════════════════════════════════════════════════
-- GROUP C
-- ═══════════════════════════════════════════════════════════════════

-- [Group C] ComplianceDisclaimerVersion
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ComplianceDisclaimerVersion" FROM anon;
REVOKE ALL ON TABLE public."ComplianceDisclaimerVersion" FROM authenticated;
ALTER TABLE public."ComplianceDisclaimerVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ComplianceDisclaimerVersion_select" ON public."ComplianceDisclaimerVersion";
CREATE POLICY "ComplianceDisclaimerVersion_select" ON public."ComplianceDisclaimerVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ComplianceDisclaimerVersion_write" ON public."ComplianceDisclaimerVersion";
CREATE POLICY "ComplianceDisclaimerVersion_write" ON public."ComplianceDisclaimerVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group C] RetentionPolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."RetentionPolicy" FROM anon;
REVOKE ALL ON TABLE public."RetentionPolicy" FROM authenticated;
ALTER TABLE public."RetentionPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RetentionPolicy_select" ON public."RetentionPolicy";
CREATE POLICY "RetentionPolicy_select" ON public."RetentionPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "RetentionPolicy_write" ON public."RetentionPolicy";
CREATE POLICY "RetentionPolicy_write" ON public."RetentionPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- ═══════════════════════════════════════════════════════════════════
-- GROUP B
-- ═══════════════════════════════════════════════════════════════════

-- [Group B] AIEvent
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AIEvent" FROM anon;
REVOKE ALL ON TABLE public."AIEvent" FROM authenticated;
ALTER TABLE public."AIEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AIEvent_select" ON public."AIEvent";
CREATE POLICY "AIEvent_select" ON public."AIEvent"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AIEvent_write" ON public."AIEvent";
CREATE POLICY "AIEvent_write" ON public."AIEvent"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentDefinition
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentDefinition" FROM anon;
REVOKE ALL ON TABLE public."AgentDefinition" FROM authenticated;
ALTER TABLE public."AgentDefinition" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentDefinition_select" ON public."AgentDefinition";
CREATE POLICY "AgentDefinition_select" ON public."AgentDefinition"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentDefinition_write" ON public."AgentDefinition";
CREATE POLICY "AgentDefinition_write" ON public."AgentDefinition"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentDelegation
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentDelegation" FROM anon;
REVOKE ALL ON TABLE public."AgentDelegation" FROM authenticated;
ALTER TABLE public."AgentDelegation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentDelegation_select" ON public."AgentDelegation";
CREATE POLICY "AgentDelegation_select" ON public."AgentDelegation"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentDelegation_write" ON public."AgentDelegation";
CREATE POLICY "AgentDelegation_write" ON public."AgentDelegation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentMemory
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentMemory" FROM anon;
REVOKE ALL ON TABLE public."AgentMemory" FROM authenticated;
ALTER TABLE public."AgentMemory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentMemory_select" ON public."AgentMemory";
CREATE POLICY "AgentMemory_select" ON public."AgentMemory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentMemory_write" ON public."AgentMemory";
CREATE POLICY "AgentMemory_write" ON public."AgentMemory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentOrgPolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentOrgPolicy" FROM anon;
REVOKE ALL ON TABLE public."AgentOrgPolicy" FROM authenticated;
ALTER TABLE public."AgentOrgPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentOrgPolicy_select" ON public."AgentOrgPolicy";
CREATE POLICY "AgentOrgPolicy_select" ON public."AgentOrgPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentOrgPolicy_write" ON public."AgentOrgPolicy";
CREATE POLICY "AgentOrgPolicy_write" ON public."AgentOrgPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentResourceAccess
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentResourceAccess" FROM anon;
REVOKE ALL ON TABLE public."AgentResourceAccess" FROM authenticated;
ALTER TABLE public."AgentResourceAccess" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentResourceAccess_select" ON public."AgentResourceAccess";
CREATE POLICY "AgentResourceAccess_select" ON public."AgentResourceAccess"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentResourceAccess_write" ON public."AgentResourceAccess";
CREATE POLICY "AgentResourceAccess_write" ON public."AgentResourceAccess"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentReviewLink
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentReviewLink" FROM anon;
REVOKE ALL ON TABLE public."AgentReviewLink" FROM authenticated;
ALTER TABLE public."AgentReviewLink" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentReviewLink_select" ON public."AgentReviewLink";
CREATE POLICY "AgentReviewLink_select" ON public."AgentReviewLink"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentReviewLink_write" ON public."AgentReviewLink";
CREATE POLICY "AgentReviewLink_write" ON public."AgentReviewLink"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentRun
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentRun" FROM anon;
REVOKE ALL ON TABLE public."AgentRun" FROM authenticated;
ALTER TABLE public."AgentRun" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentRun_select" ON public."AgentRun";
CREATE POLICY "AgentRun_select" ON public."AgentRun"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentRun_write" ON public."AgentRun";
CREATE POLICY "AgentRun_write" ON public."AgentRun"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentRunStep
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentRunStep" FROM anon;
REVOKE ALL ON TABLE public."AgentRunStep" FROM authenticated;
ALTER TABLE public."AgentRunStep" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentRunStep_select" ON public."AgentRunStep";
CREATE POLICY "AgentRunStep_select" ON public."AgentRunStep"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."AgentRun" p WHERE p."runId" = "AgentRunStep"."runId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "AgentRunStep_write" ON public."AgentRunStep";
CREATE POLICY "AgentRunStep_write" ON public."AgentRunStep"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."AgentRun" p WHERE p."runId" = "AgentRunStep"."runId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."AgentRun" p WHERE p."runId" = "AgentRunStep"."runId" AND public.is_org_admin(p."organizationId")));

-- [Group B] AgentToolExecution
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentToolExecution" FROM anon;
REVOKE ALL ON TABLE public."AgentToolExecution" FROM authenticated;
ALTER TABLE public."AgentToolExecution" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentToolExecution_select" ON public."AgentToolExecution";
CREATE POLICY "AgentToolExecution_select" ON public."AgentToolExecution"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "AgentToolExecution_write" ON public."AgentToolExecution";
CREATE POLICY "AgentToolExecution_write" ON public."AgentToolExecution"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] AgentVersion
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."AgentVersion" FROM anon;
REVOKE ALL ON TABLE public."AgentVersion" FROM authenticated;
ALTER TABLE public."AgentVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentVersion_select" ON public."AgentVersion";
CREATE POLICY "AgentVersion_select" ON public."AgentVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."AgentDefinition" p WHERE p."agentId" = "AgentVersion"."agentId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "AgentVersion_write" ON public."AgentVersion";
CREATE POLICY "AgentVersion_write" ON public."AgentVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."AgentDefinition" p WHERE p."agentId" = "AgentVersion"."agentId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."AgentDefinition" p WHERE p."agentId" = "AgentVersion"."agentId" AND public.is_org_admin(p."organizationId")));

-- [Group B] CompliancePolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."CompliancePolicy" FROM anon;
REVOKE ALL ON TABLE public."CompliancePolicy" FROM authenticated;
ALTER TABLE public."CompliancePolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CompliancePolicy_select" ON public."CompliancePolicy";
CREATE POLICY "CompliancePolicy_select" ON public."CompliancePolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR ("organizationId" IS NOT NULL AND public.is_org_member("organizationId")));
DROP POLICY IF EXISTS "CompliancePolicy_write" ON public."CompliancePolicy";
CREATE POLICY "CompliancePolicy_write" ON public."CompliancePolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId")));

-- [Group B] ComplianceReportExport
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ComplianceReportExport" FROM anon;
REVOKE ALL ON TABLE public."ComplianceReportExport" FROM authenticated;
ALTER TABLE public."ComplianceReportExport" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ComplianceReportExport_select" ON public."ComplianceReportExport";
CREATE POLICY "ComplianceReportExport_select" ON public."ComplianceReportExport"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "ComplianceReportExport_write" ON public."ComplianceReportExport";
CREATE POLICY "ComplianceReportExport_write" ON public."ComplianceReportExport"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] DashboardAlertPreference
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."DashboardAlertPreference" FROM anon;
REVOKE ALL ON TABLE public."DashboardAlertPreference" FROM authenticated;
ALTER TABLE public."DashboardAlertPreference" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DashboardAlertPreference_select" ON public."DashboardAlertPreference";
CREATE POLICY "DashboardAlertPreference_select" ON public."DashboardAlertPreference"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "DashboardAlertPreference_write" ON public."DashboardAlertPreference";
CREATE POLICY "DashboardAlertPreference_write" ON public."DashboardAlertPreference"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] DashboardExport
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."DashboardExport" FROM anon;
REVOKE ALL ON TABLE public."DashboardExport" FROM authenticated;
ALTER TABLE public."DashboardExport" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DashboardExport_select" ON public."DashboardExport";
CREATE POLICY "DashboardExport_select" ON public."DashboardExport"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "DashboardExport_write" ON public."DashboardExport";
CREATE POLICY "DashboardExport_write" ON public."DashboardExport"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] DashboardSavedView
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."DashboardSavedView" FROM anon;
REVOKE ALL ON TABLE public."DashboardSavedView" FROM authenticated;
ALTER TABLE public."DashboardSavedView" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DashboardSavedView_select" ON public."DashboardSavedView";
CREATE POLICY "DashboardSavedView_select" ON public."DashboardSavedView"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "DashboardSavedView_write" ON public."DashboardSavedView";
CREATE POLICY "DashboardSavedView_write" ON public."DashboardSavedView"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] DashboardSnapshot
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."DashboardSnapshot" FROM anon;
REVOKE ALL ON TABLE public."DashboardSnapshot" FROM authenticated;
ALTER TABLE public."DashboardSnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DashboardSnapshot_select" ON public."DashboardSnapshot";
CREATE POLICY "DashboardSnapshot_select" ON public."DashboardSnapshot"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR ("organizationId" IS NOT NULL AND public.is_org_member("organizationId")));
DROP POLICY IF EXISTS "DashboardSnapshot_write" ON public."DashboardSnapshot";
CREATE POLICY "DashboardSnapshot_write" ON public."DashboardSnapshot"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId")));

-- [Group B] DashboardWidgetPreference
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."DashboardWidgetPreference" FROM anon;
REVOKE ALL ON TABLE public."DashboardWidgetPreference" FROM authenticated;
ALTER TABLE public."DashboardWidgetPreference" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DashboardWidgetPreference_select" ON public."DashboardWidgetPreference";
CREATE POLICY "DashboardWidgetPreference_select" ON public."DashboardWidgetPreference"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "DashboardWidgetPreference_write" ON public."DashboardWidgetPreference";
CREATE POLICY "DashboardWidgetPreference_write" ON public."DashboardWidgetPreference"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] EnterpriseAIModelScore
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."EnterpriseAIModelScore" FROM anon;
REVOKE ALL ON TABLE public."EnterpriseAIModelScore" FROM authenticated;
ALTER TABLE public."EnterpriseAIModelScore" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "EnterpriseAIModelScore_select" ON public."EnterpriseAIModelScore";
CREATE POLICY "EnterpriseAIModelScore_select" ON public."EnterpriseAIModelScore"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "EnterpriseAIModelScore_write" ON public."EnterpriseAIModelScore";
CREATE POLICY "EnterpriseAIModelScore_write" ON public."EnterpriseAIModelScore"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] HumanReviewCase
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."HumanReviewCase" FROM anon;
REVOKE ALL ON TABLE public."HumanReviewCase" FROM authenticated;
ALTER TABLE public."HumanReviewCase" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HumanReviewCase_select" ON public."HumanReviewCase";
CREATE POLICY "HumanReviewCase_select" ON public."HumanReviewCase"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "HumanReviewCase_write" ON public."HumanReviewCase";
CREATE POLICY "HumanReviewCase_write" ON public."HumanReviewCase"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] PromptTemplate
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."PromptTemplate" FROM anon;
REVOKE ALL ON TABLE public."PromptTemplate" FROM authenticated;
ALTER TABLE public."PromptTemplate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PromptTemplate_select" ON public."PromptTemplate";
CREATE POLICY "PromptTemplate_select" ON public."PromptTemplate"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "PromptTemplate_write" ON public."PromptTemplate";
CREATE POLICY "PromptTemplate_write" ON public."PromptTemplate"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] PromptTestCase
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."PromptTestCase" FROM anon;
REVOKE ALL ON TABLE public."PromptTestCase" FROM authenticated;
ALTER TABLE public."PromptTestCase" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PromptTestCase_select" ON public."PromptTestCase";
CREATE POLICY "PromptTestCase_select" ON public."PromptTestCase"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."PromptTemplate" p WHERE p."templateId" = "PromptTestCase"."templateId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "PromptTestCase_write" ON public."PromptTestCase";
CREATE POLICY "PromptTestCase_write" ON public."PromptTestCase"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."PromptTemplate" p WHERE p."templateId" = "PromptTestCase"."templateId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."PromptTemplate" p WHERE p."templateId" = "PromptTestCase"."templateId" AND public.is_org_admin(p."organizationId")));

-- [Group B] PromptVersion
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."PromptVersion" FROM anon;
REVOKE ALL ON TABLE public."PromptVersion" FROM authenticated;
ALTER TABLE public."PromptVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PromptVersion_select" ON public."PromptVersion";
CREATE POLICY "PromptVersion_select" ON public."PromptVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."PromptTemplate" p WHERE p."templateId" = "PromptVersion"."templateId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "PromptVersion_write" ON public."PromptVersion";
CREATE POLICY "PromptVersion_write" ON public."PromptVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."PromptTemplate" p WHERE p."templateId" = "PromptVersion"."templateId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."PromptTemplate" p WHERE p."templateId" = "PromptVersion"."templateId" AND public.is_org_admin(p."organizationId")));

-- [Group B] ToolDefinition
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ToolDefinition" FROM anon;
REVOKE ALL ON TABLE public."ToolDefinition" FROM authenticated;
ALTER TABLE public."ToolDefinition" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ToolDefinition_select" ON public."ToolDefinition";
CREATE POLICY "ToolDefinition_select" ON public."ToolDefinition"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "ToolDefinition_write" ON public."ToolDefinition";
CREATE POLICY "ToolDefinition_write" ON public."ToolDefinition"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] ToolExecution
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ToolExecution" FROM anon;
REVOKE ALL ON TABLE public."ToolExecution" FROM authenticated;
ALTER TABLE public."ToolExecution" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ToolExecution_select" ON public."ToolExecution";
CREATE POLICY "ToolExecution_select" ON public."ToolExecution"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "ToolExecution_write" ON public."ToolExecution";
CREATE POLICY "ToolExecution_write" ON public."ToolExecution"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] ToolVersion
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ToolVersion" FROM anon;
REVOKE ALL ON TABLE public."ToolVersion" FROM authenticated;
ALTER TABLE public."ToolVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ToolVersion_select" ON public."ToolVersion";
CREATE POLICY "ToolVersion_select" ON public."ToolVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."ToolDefinition" p WHERE p."toolId" = "ToolVersion"."toolId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "ToolVersion_write" ON public."ToolVersion";
CREATE POLICY "ToolVersion_write" ON public."ToolVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."ToolDefinition" p WHERE p."toolId" = "ToolVersion"."toolId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."ToolDefinition" p WHERE p."toolId" = "ToolVersion"."toolId" AND public.is_org_admin(p."organizationId")));

-- [Group B] WorkflowApproval
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowApproval" FROM anon;
REVOKE ALL ON TABLE public."WorkflowApproval" FROM authenticated;
ALTER TABLE public."WorkflowApproval" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowApproval_select" ON public."WorkflowApproval";
CREATE POLICY "WorkflowApproval_select" ON public."WorkflowApproval"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowApproval_write" ON public."WorkflowApproval";
CREATE POLICY "WorkflowApproval_write" ON public."WorkflowApproval"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowDefinition
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowDefinition" FROM anon;
REVOKE ALL ON TABLE public."WorkflowDefinition" FROM authenticated;
ALTER TABLE public."WorkflowDefinition" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowDefinition_select" ON public."WorkflowDefinition";
CREATE POLICY "WorkflowDefinition_select" ON public."WorkflowDefinition"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowDefinition_write" ON public."WorkflowDefinition";
CREATE POLICY "WorkflowDefinition_write" ON public."WorkflowDefinition"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowEdge
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowEdge" FROM anon;
REVOKE ALL ON TABLE public."WorkflowEdge" FROM authenticated;
ALTER TABLE public."WorkflowEdge" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowEdge_select" ON public."WorkflowEdge";
CREATE POLICY "WorkflowEdge_select" ON public."WorkflowEdge"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowEdge"."versionId"
        AND public.is_org_member(wd."organizationId")
    ));
DROP POLICY IF EXISTS "WorkflowEdge_write" ON public."WorkflowEdge";
CREATE POLICY "WorkflowEdge_write" ON public."WorkflowEdge"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowEdge"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowEdge"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ));

-- [Group B] WorkflowErrorPolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowErrorPolicy" FROM anon;
REVOKE ALL ON TABLE public."WorkflowErrorPolicy" FROM authenticated;
ALTER TABLE public."WorkflowErrorPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowErrorPolicy_select" ON public."WorkflowErrorPolicy";
CREATE POLICY "WorkflowErrorPolicy_select" ON public."WorkflowErrorPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowErrorPolicy"."versionId"
        AND public.is_org_member(wd."organizationId")
    ));
DROP POLICY IF EXISTS "WorkflowErrorPolicy_write" ON public."WorkflowErrorPolicy";
CREATE POLICY "WorkflowErrorPolicy_write" ON public."WorkflowErrorPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowErrorPolicy"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowErrorPolicy"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ));

-- [Group B] WorkflowExecution
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowExecution" FROM anon;
REVOKE ALL ON TABLE public."WorkflowExecution" FROM authenticated;
ALTER TABLE public."WorkflowExecution" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowExecution_select" ON public."WorkflowExecution";
CREATE POLICY "WorkflowExecution_select" ON public."WorkflowExecution"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowExecution_write" ON public."WorkflowExecution";
CREATE POLICY "WorkflowExecution_write" ON public."WorkflowExecution"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowNode
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowNode" FROM anon;
REVOKE ALL ON TABLE public."WorkflowNode" FROM authenticated;
ALTER TABLE public."WorkflowNode" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowNode_select" ON public."WorkflowNode";
CREATE POLICY "WorkflowNode_select" ON public."WorkflowNode"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowNode"."versionId"
        AND public.is_org_member(wd."organizationId")
    ));
DROP POLICY IF EXISTS "WorkflowNode_write" ON public."WorkflowNode";
CREATE POLICY "WorkflowNode_write" ON public."WorkflowNode"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowNode"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowNode"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ));

-- [Group B] WorkflowPolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowPolicy" FROM anon;
REVOKE ALL ON TABLE public."WorkflowPolicy" FROM authenticated;
ALTER TABLE public."WorkflowPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowPolicy_select" ON public."WorkflowPolicy";
CREATE POLICY "WorkflowPolicy_select" ON public."WorkflowPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowPolicy_write" ON public."WorkflowPolicy";
CREATE POLICY "WorkflowPolicy_write" ON public."WorkflowPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowRetryPolicy
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowRetryPolicy" FROM anon;
REVOKE ALL ON TABLE public."WorkflowRetryPolicy" FROM authenticated;
ALTER TABLE public."WorkflowRetryPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowRetryPolicy_select" ON public."WorkflowRetryPolicy";
CREATE POLICY "WorkflowRetryPolicy_select" ON public."WorkflowRetryPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowRetryPolicy"."versionId"
        AND public.is_org_member(wd."organizationId")
    ));
DROP POLICY IF EXISTS "WorkflowRetryPolicy_write" ON public."WorkflowRetryPolicy";
CREATE POLICY "WorkflowRetryPolicy_write" ON public."WorkflowRetryPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowRetryPolicy"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowRetryPolicy"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ));

-- [Group B] WorkflowSchedule
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowSchedule" FROM anon;
REVOKE ALL ON TABLE public."WorkflowSchedule" FROM authenticated;
ALTER TABLE public."WorkflowSchedule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowSchedule_select" ON public."WorkflowSchedule";
CREATE POLICY "WorkflowSchedule_select" ON public."WorkflowSchedule"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowSchedule_write" ON public."WorkflowSchedule";
CREATE POLICY "WorkflowSchedule_write" ON public."WorkflowSchedule"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowSecretReference
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowSecretReference" FROM anon;
REVOKE ALL ON TABLE public."WorkflowSecretReference" FROM authenticated;
ALTER TABLE public."WorkflowSecretReference" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowSecretReference_select" ON public."WorkflowSecretReference";
CREATE POLICY "WorkflowSecretReference_select" ON public."WorkflowSecretReference"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowSecretReference_write" ON public."WorkflowSecretReference";
CREATE POLICY "WorkflowSecretReference_write" ON public."WorkflowSecretReference"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowStepExecution
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowStepExecution" FROM anon;
REVOKE ALL ON TABLE public."WorkflowStepExecution" FROM authenticated;
ALTER TABLE public."WorkflowStepExecution" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowStepExecution_select" ON public."WorkflowStepExecution";
CREATE POLICY "WorkflowStepExecution_select" ON public."WorkflowStepExecution"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowExecution" p WHERE p."executionId" = "WorkflowStepExecution"."executionId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "WorkflowStepExecution_write" ON public."WorkflowStepExecution";
CREATE POLICY "WorkflowStepExecution_write" ON public."WorkflowStepExecution"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowExecution" p WHERE p."executionId" = "WorkflowStepExecution"."executionId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowExecution" p WHERE p."executionId" = "WorkflowStepExecution"."executionId" AND public.is_org_admin(p."organizationId")));

-- [Group B] WorkflowTrigger
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowTrigger" FROM anon;
REVOKE ALL ON TABLE public."WorkflowTrigger" FROM authenticated;
ALTER TABLE public."WorkflowTrigger" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowTrigger_select" ON public."WorkflowTrigger";
CREATE POLICY "WorkflowTrigger_select" ON public."WorkflowTrigger"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowTrigger_write" ON public."WorkflowTrigger";
CREATE POLICY "WorkflowTrigger_write" ON public."WorkflowTrigger"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- [Group B] WorkflowVariable
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowVariable" FROM anon;
REVOKE ALL ON TABLE public."WorkflowVariable" FROM authenticated;
ALTER TABLE public."WorkflowVariable" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowVariable_select" ON public."WorkflowVariable";
CREATE POLICY "WorkflowVariable_select" ON public."WorkflowVariable"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowVariable"."versionId"
        AND public.is_org_member(wd."organizationId")
    ));
DROP POLICY IF EXISTS "WorkflowVariable_write" ON public."WorkflowVariable";
CREATE POLICY "WorkflowVariable_write" ON public."WorkflowVariable"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowVariable"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public."WorkflowVersion" wv
      JOIN public."WorkflowDefinition" wd ON wd."workflowId" = wv."workflowId"
      WHERE wv."versionId" = "WorkflowVariable"."versionId"
        AND public.is_org_admin(wd."organizationId")
    ));

-- [Group B] WorkflowVersion
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowVersion" FROM anon;
REVOKE ALL ON TABLE public."WorkflowVersion" FROM authenticated;
ALTER TABLE public."WorkflowVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowVersion_select" ON public."WorkflowVersion";
CREATE POLICY "WorkflowVersion_select" ON public."WorkflowVersion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowDefinition" p WHERE p."workflowId" = "WorkflowVersion"."workflowId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "WorkflowVersion_write" ON public."WorkflowVersion";
CREATE POLICY "WorkflowVersion_write" ON public."WorkflowVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowDefinition" p WHERE p."workflowId" = "WorkflowVersion"."workflowId" AND public.is_org_admin(p."organizationId")))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowDefinition" p WHERE p."workflowId" = "WorkflowVersion"."workflowId" AND public.is_org_admin(p."organizationId")));

-- [Group B] WorkflowWebhookConfig
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowWebhookConfig" FROM anon;
REVOKE ALL ON TABLE public."WorkflowWebhookConfig" FROM authenticated;
ALTER TABLE public."WorkflowWebhookConfig" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowWebhookConfig_select" ON public."WorkflowWebhookConfig";
CREATE POLICY "WorkflowWebhookConfig_select" ON public."WorkflowWebhookConfig"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowWebhookConfig_write" ON public."WorkflowWebhookConfig";
CREATE POLICY "WorkflowWebhookConfig_write" ON public."WorkflowWebhookConfig"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- ═══════════════════════════════════════════════════════════════════
-- GROUP E
-- ═══════════════════════════════════════════════════════════════════

-- [Group E] ComplianceAuditRecord
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."ComplianceAuditRecord" FROM anon;
REVOKE ALL ON TABLE public."ComplianceAuditRecord" FROM authenticated;
ALTER TABLE public."ComplianceAuditRecord" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ComplianceAuditRecord_select" ON public."ComplianceAuditRecord";
CREATE POLICY "ComplianceAuditRecord_select" ON public."ComplianceAuditRecord"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "ComplianceAuditRecord_service_write" ON public."ComplianceAuditRecord";
CREATE POLICY "ComplianceAuditRecord_service_write" ON public."ComplianceAuditRecord"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group E] HumanReviewHistory
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."HumanReviewHistory" FROM anon;
REVOKE ALL ON TABLE public."HumanReviewHistory" FROM authenticated;
ALTER TABLE public."HumanReviewHistory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HumanReviewHistory_select" ON public."HumanReviewHistory";
CREATE POLICY "HumanReviewHistory_select" ON public."HumanReviewHistory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."HumanReviewCase" p WHERE p."id" = "HumanReviewHistory"."reviewCaseId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "HumanReviewHistory_service_write" ON public."HumanReviewHistory";
CREATE POLICY "HumanReviewHistory_service_write" ON public."HumanReviewHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group E] WorkflowExecutionHistory
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowExecutionHistory" FROM anon;
REVOKE ALL ON TABLE public."WorkflowExecutionHistory" FROM authenticated;
ALTER TABLE public."WorkflowExecutionHistory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowExecutionHistory_select" ON public."WorkflowExecutionHistory";
CREATE POLICY "WorkflowExecutionHistory_select" ON public."WorkflowExecutionHistory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "WorkflowExecutionHistory_service_write" ON public."WorkflowExecutionHistory";
CREATE POLICY "WorkflowExecutionHistory_service_write" ON public."WorkflowExecutionHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- [Group E] WorkflowExecutionLog
-- Revoke direct API role access (Prisma/postgres bypass RLS)
REVOKE ALL ON TABLE public."WorkflowExecutionLog" FROM anon;
REVOKE ALL ON TABLE public."WorkflowExecutionLog" FROM authenticated;
ALTER TABLE public."WorkflowExecutionLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowExecutionLog_select" ON public."WorkflowExecutionLog";
CREATE POLICY "WorkflowExecutionLog_select" ON public."WorkflowExecutionLog"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR EXISTS (SELECT 1 FROM public."WorkflowExecution" p WHERE p."executionId" = "WorkflowExecutionLog"."executionId" AND public.is_org_member(p."organizationId")));
DROP POLICY IF EXISTS "WorkflowExecutionLog_service_write" ON public."WorkflowExecutionLog";
CREATE POLICY "WorkflowExecutionLog_service_write" ON public."WorkflowExecutionLog"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

COMMIT;
