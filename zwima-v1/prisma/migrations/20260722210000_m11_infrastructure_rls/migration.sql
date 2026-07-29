-- M11 Digital Infrastructure — RLS enable (additive, idempotent)
-- Compatible with live emergency recovery already applied on Production (tgvn…fphf).
-- Does not DROP tables, alter columns, or DISABLE RLS.
-- Safe to re-run: ENABLE RLS + DROP POLICY IF EXISTS + CREATE POLICY.

-- BackgroundJob
REVOKE ALL ON TABLE public."BackgroundJob" FROM anon;
REVOKE ALL ON TABLE public."BackgroundJob" FROM authenticated;
ALTER TABLE public."BackgroundJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BackgroundJob_select" ON public."BackgroundJob";
CREATE POLICY "BackgroundJob_select" ON public."BackgroundJob" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "BackgroundJob_write" ON public."BackgroundJob";
CREATE POLICY "BackgroundJob_write" ON public."BackgroundJob" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- BackupRecord
REVOKE ALL ON TABLE public."BackupRecord" FROM anon;
REVOKE ALL ON TABLE public."BackupRecord" FROM authenticated;
ALTER TABLE public."BackupRecord" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BackupRecord_select" ON public."BackupRecord";
CREATE POLICY "BackupRecord_select" ON public."BackupRecord" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "BackupRecord_write" ON public."BackupRecord";
CREATE POLICY "BackupRecord_write" ON public."BackupRecord" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- DeploymentGateResult
REVOKE ALL ON TABLE public."DeploymentGateResult" FROM anon;
REVOKE ALL ON TABLE public."DeploymentGateResult" FROM authenticated;
ALTER TABLE public."DeploymentGateResult" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DeploymentGateResult_select" ON public."DeploymentGateResult";
CREATE POLICY "DeploymentGateResult_select" ON public."DeploymentGateResult" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "DeploymentGateResult_write" ON public."DeploymentGateResult";
CREATE POLICY "DeploymentGateResult_write" ON public."DeploymentGateResult" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- DeploymentRelease
REVOKE ALL ON TABLE public."DeploymentRelease" FROM anon;
REVOKE ALL ON TABLE public."DeploymentRelease" FROM authenticated;
ALTER TABLE public."DeploymentRelease" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DeploymentRelease_select" ON public."DeploymentRelease";
CREATE POLICY "DeploymentRelease_select" ON public."DeploymentRelease" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "DeploymentRelease_write" ON public."DeploymentRelease";
CREATE POLICY "DeploymentRelease_write" ON public."DeploymentRelease" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- InfrastructureAuditEvent
REVOKE ALL ON TABLE public."InfrastructureAuditEvent" FROM anon;
REVOKE ALL ON TABLE public."InfrastructureAuditEvent" FROM authenticated;
ALTER TABLE public."InfrastructureAuditEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InfrastructureAuditEvent_select" ON public."InfrastructureAuditEvent";
CREATE POLICY "InfrastructureAuditEvent_select" ON public."InfrastructureAuditEvent" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "InfrastructureAuditEvent_write" ON public."InfrastructureAuditEvent";
CREATE POLICY "InfrastructureAuditEvent_write" ON public."InfrastructureAuditEvent" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- InfrastructureEnvironment
REVOKE ALL ON TABLE public."InfrastructureEnvironment" FROM anon;
REVOKE ALL ON TABLE public."InfrastructureEnvironment" FROM authenticated;
ALTER TABLE public."InfrastructureEnvironment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InfrastructureEnvironment_select" ON public."InfrastructureEnvironment";
CREATE POLICY "InfrastructureEnvironment_select" ON public."InfrastructureEnvironment" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "InfrastructureEnvironment_write" ON public."InfrastructureEnvironment";
CREATE POLICY "InfrastructureEnvironment_write" ON public."InfrastructureEnvironment" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- InfrastructureHealthCheck
REVOKE ALL ON TABLE public."InfrastructureHealthCheck" FROM anon;
REVOKE ALL ON TABLE public."InfrastructureHealthCheck" FROM authenticated;
ALTER TABLE public."InfrastructureHealthCheck" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InfrastructureHealthCheck_select" ON public."InfrastructureHealthCheck";
CREATE POLICY "InfrastructureHealthCheck_select" ON public."InfrastructureHealthCheck" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "InfrastructureHealthCheck_write" ON public."InfrastructureHealthCheck";
CREATE POLICY "InfrastructureHealthCheck_write" ON public."InfrastructureHealthCheck" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- InfrastructureIncident
REVOKE ALL ON TABLE public."InfrastructureIncident" FROM anon;
REVOKE ALL ON TABLE public."InfrastructureIncident" FROM authenticated;
ALTER TABLE public."InfrastructureIncident" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InfrastructureIncident_select" ON public."InfrastructureIncident";
CREATE POLICY "InfrastructureIncident_select" ON public."InfrastructureIncident" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "InfrastructureIncident_write" ON public."InfrastructureIncident";
CREATE POLICY "InfrastructureIncident_write" ON public."InfrastructureIncident" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- InfrastructureService
REVOKE ALL ON TABLE public."InfrastructureService" FROM anon;
REVOKE ALL ON TABLE public."InfrastructureService" FROM authenticated;
ALTER TABLE public."InfrastructureService" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InfrastructureService_select" ON public."InfrastructureService";
CREATE POLICY "InfrastructureService_select" ON public."InfrastructureService" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "InfrastructureService_write" ON public."InfrastructureService";
CREATE POLICY "InfrastructureService_write" ON public."InfrastructureService" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- ProviderSecretReference
REVOKE ALL ON TABLE public."ProviderSecretReference" FROM anon;
REVOKE ALL ON TABLE public."ProviderSecretReference" FROM authenticated;
ALTER TABLE public."ProviderSecretReference" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ProviderSecretReference_select" ON public."ProviderSecretReference";
CREATE POLICY "ProviderSecretReference_select" ON public."ProviderSecretReference" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ProviderSecretReference_write" ON public."ProviderSecretReference";
CREATE POLICY "ProviderSecretReference_write" ON public."ProviderSecretReference" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- RateLimitPolicy
REVOKE ALL ON TABLE public."RateLimitPolicy" FROM anon;
REVOKE ALL ON TABLE public."RateLimitPolicy" FROM authenticated;
ALTER TABLE public."RateLimitPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RateLimitPolicy_select" ON public."RateLimitPolicy";
CREATE POLICY "RateLimitPolicy_select" ON public."RateLimitPolicy" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "RateLimitPolicy_write" ON public."RateLimitPolicy";
CREATE POLICY "RateLimitPolicy_write" ON public."RateLimitPolicy" FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")) WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

-- RestoreDrill
REVOKE ALL ON TABLE public."RestoreDrill" FROM anon;
REVOKE ALL ON TABLE public."RestoreDrill" FROM authenticated;
ALTER TABLE public."RestoreDrill" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RestoreDrill_select" ON public."RestoreDrill";
CREATE POLICY "RestoreDrill_select" ON public."RestoreDrill" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "RestoreDrill_write" ON public."RestoreDrill";
CREATE POLICY "RestoreDrill_write" ON public."RestoreDrill" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- ServiceLevelObjective
REVOKE ALL ON TABLE public."ServiceLevelObjective" FROM anon;
REVOKE ALL ON TABLE public."ServiceLevelObjective" FROM authenticated;
ALTER TABLE public."ServiceLevelObjective" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ServiceLevelObjective_select" ON public."ServiceLevelObjective";
CREATE POLICY "ServiceLevelObjective_select" ON public."ServiceLevelObjective" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
DROP POLICY IF EXISTS "ServiceLevelObjective_write" ON public."ServiceLevelObjective";
CREATE POLICY "ServiceLevelObjective_write" ON public."ServiceLevelObjective" FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId")) WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));
