-- ZWIMA v1 — Clerk-compatible Row Level Security (public schema)
-- Resolves Supabase Security Advisor: rls_disabled_in_public
-- Backend (Prisma / postgres / service_role) bypasses RLS by design.

-- ─── Helper functions ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.requesting_clerk_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    COALESCE(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(auth.jwt() ->> 'sub', '')
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public."User" u
  WHERE u."clerkId" = public.requesting_clerk_id()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true) = 'service_role',
    (auth.jwt() ->> 'role') = 'service_role',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_service_role()
    OR COALESCE(
      (auth.jwt() -> 'public_metadata' ->> 'role') = 'admin',
      (auth.jwt() -> 'unsafe_metadata' ->> 'role') = 'admin',
      false
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_service_role()
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public."OrganizationMember" om
      WHERE om."organizationId" = org_id
        AND om."userId" = public.requesting_user_id()
        AND om.accepted = true
    )
    OR EXISTS (
      SELECT 1
      FROM public."Organization" o
      WHERE o.id = org_id
        AND o."ownerId" = public.requesting_user_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_service_role()
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public."OrganizationMember" om
      WHERE om."organizationId" = org_id
        AND om."userId" = public.requesting_user_id()
        AND om.accepted = true
        AND om.role IN ('OWNER', 'ADMIN', 'BILLING')
    )
    OR EXISTS (
      SELECT 1
      FROM public."Organization" o
      WHERE o.id = org_id
        AND o."ownerId" = public.requesting_user_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_user_row(target_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_service_role()
    OR public.is_platform_admin()
    OR (target_user_id IS NOT NULL AND target_user_id = public.requesting_user_id());
$$;

-- ─── Enable RLS on all public application tables ───────────────────────────

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrganizationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Provider" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelComplianceProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelPricingRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderHealth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelPricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoutingPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoutingWeightConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PlatformConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AiAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SecurityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IdempotencyRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarginRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CreditPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CreditBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Referral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExchangeRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

-- Prisma migration history (deny direct client access)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
  ) THEN
    EXECUTE 'ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ─── User & Organization ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "User_select" ON public."User";
CREATE POLICY "User_select" ON public."User"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR "clerkId" = public.requesting_clerk_id()
  );

DROP POLICY IF EXISTS "User_insert" ON public."User";
CREATE POLICY "User_insert" ON public."User"
  FOR INSERT WITH CHECK (
    public.is_service_role()
    OR public.is_platform_admin()
    OR "clerkId" = public.requesting_clerk_id()
  );

DROP POLICY IF EXISTS "User_update" ON public."User";
CREATE POLICY "User_update" ON public."User"
  FOR UPDATE USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR "clerkId" = public.requesting_clerk_id()
  );

DROP POLICY IF EXISTS "Organization_select" ON public."Organization";
CREATE POLICY "Organization_select" ON public."Organization"
  FOR SELECT USING (public.is_org_member(id));

DROP POLICY IF EXISTS "Organization_insert" ON public."Organization";
CREATE POLICY "Organization_insert" ON public."Organization"
  FOR INSERT WITH CHECK (
    public.is_service_role()
    OR public.is_platform_admin()
    OR "ownerId" = public.requesting_user_id()
  );

DROP POLICY IF EXISTS "Organization_update" ON public."Organization";
CREATE POLICY "Organization_update" ON public."Organization"
  FOR UPDATE USING (public.is_org_admin(id));

DROP POLICY IF EXISTS "OrganizationMember_select" ON public."OrganizationMember";
CREATE POLICY "OrganizationMember_select" ON public."OrganizationMember"
  FOR SELECT USING (public.is_org_member("organizationId"));

DROP POLICY IF EXISTS "OrganizationMember_insert" ON public."OrganizationMember";
CREATE POLICY "OrganizationMember_insert" ON public."OrganizationMember"
  FOR INSERT WITH CHECK (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.is_org_admin("organizationId")
    OR "userId" = public.requesting_user_id()
  );

DROP POLICY IF EXISTS "OrganizationMember_update" ON public."OrganizationMember";
CREATE POLICY "OrganizationMember_update" ON public."OrganizationMember"
  FOR UPDATE USING (public.is_org_admin("organizationId"));

DROP POLICY IF EXISTS "OrganizationMember_delete" ON public."OrganizationMember";
CREATE POLICY "OrganizationMember_delete" ON public."OrganizationMember"
  FOR DELETE USING (public.is_org_admin("organizationId"));

-- ─── API Keys ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ApiKey_select" ON public."ApiKey";
CREATE POLICY "ApiKey_select" ON public."ApiKey"
  FOR SELECT USING (
    public.owns_user_row("userId")
    OR ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"))
  );

DROP POLICY IF EXISTS "ApiKey_insert" ON public."ApiKey";
CREATE POLICY "ApiKey_insert" ON public."ApiKey"
  FOR INSERT WITH CHECK (
    public.is_service_role()
    OR public.owns_user_row("userId")
    OR ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"))
  );

DROP POLICY IF EXISTS "ApiKey_update" ON public."ApiKey";
CREATE POLICY "ApiKey_update" ON public."ApiKey"
  FOR UPDATE USING (
    public.owns_user_row("userId")
    OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId"))
  );

DROP POLICY IF EXISTS "ApiKey_delete" ON public."ApiKey";
CREATE POLICY "ApiKey_delete" ON public."ApiKey"
  FOR DELETE USING (
    public.owns_user_row("userId")
    OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId"))
  );

-- ─── Platform catalog (read authenticated, write admin/service) ─────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'Provider',
    'ProviderModel',
    'ModelComplianceProfile',
    'ModelPricingRecord',
    'ProviderHealth',
    'ModelPricing',
    'RoutingWeightConfig',
    'MarginRule'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL)',
      tbl || '_select', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_service_write', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin())',
      tbl || '_service_write', tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "PlatformConfig_select" ON public."PlatformConfig";
CREATE POLICY "PlatformConfig_select" ON public."PlatformConfig"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "PlatformConfig_write" ON public."PlatformConfig";
CREATE POLICY "PlatformConfig_write" ON public."PlatformConfig"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "CreditPackage_select" ON public."CreditPackage";
CREATE POLICY "CreditPackage_select" ON public."CreditPackage"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "CreditPackage_write" ON public."CreditPackage";
CREATE POLICY "CreditPackage_write" ON public."CreditPackage"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Coupon_select" ON public."Coupon";
CREATE POLICY "Coupon_select" ON public."Coupon"
  FOR SELECT USING (enabled = true OR public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Coupon_write" ON public."Coupon";
CREATE POLICY "Coupon_write" ON public."Coupon"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ExchangeRate_select" ON public."ExchangeRate";
CREATE POLICY "ExchangeRate_select" ON public."ExchangeRate"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ExchangeRate_write" ON public."ExchangeRate";
CREATE POLICY "ExchangeRate_write" ON public."ExchangeRate"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- ─── Routing (org-scoped) ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "RoutingPolicy_select" ON public."RoutingPolicy";
CREATE POLICY "RoutingPolicy_select" ON public."RoutingPolicy"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR ("organizationId" IS NULL)
    OR public.is_org_member("organizationId")
  );

DROP POLICY IF EXISTS "RoutingPolicy_write" ON public."RoutingPolicy";
CREATE POLICY "RoutingPolicy_write" ON public."RoutingPolicy"
  FOR ALL USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId"))
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_platform_admin()
    OR ("organizationId" IS NOT NULL AND public.is_org_admin("organizationId"))
  );

-- ─── User-owned billing & usage ─────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'Transaction',
    'Payment',
    'Invoice',
    'UsageLog',
    'CreditBalance',
    'Subscription',
    'Referral',
    'Notification'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.owns_user_row("userId"))',
      tbl || '_select', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_service_role() OR public.owns_user_row("userId"))',
      tbl || '_insert', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_service_role() OR public.owns_user_row("userId"))',
      tbl || '_update', tbl
    );
  END LOOP;
END $$;

-- ─── Audit & security ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "AiAuditLog_select" ON public."AiAuditLog";
CREATE POLICY "AiAuditLog_select" ON public."AiAuditLog"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.owns_user_row("userId")
    OR ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"))
  );

DROP POLICY IF EXISTS "AiAuditLog_insert" ON public."AiAuditLog";
CREATE POLICY "AiAuditLog_insert" ON public."AiAuditLog"
  FOR INSERT WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "SecurityEvent_select" ON public."SecurityEvent";
CREATE POLICY "SecurityEvent_select" ON public."SecurityEvent"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"))
  );

DROP POLICY IF EXISTS "SecurityEvent_insert" ON public."SecurityEvent";
CREATE POLICY "SecurityEvent_insert" ON public."SecurityEvent"
  FOR INSERT WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "AuditLog_select" ON public."AuditLog";
CREATE POLICY "AuditLog_select" ON public."AuditLog"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.owns_user_row("userId")
  );

DROP POLICY IF EXISTS "AuditLog_insert" ON public."AuditLog";
CREATE POLICY "AuditLog_insert" ON public."AuditLog"
  FOR INSERT WITH CHECK (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.owns_user_row("userId")
  );

-- ─── Backend-only tables ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "IdempotencyRecord_service" ON public."IdempotencyRecord";
CREATE POLICY "IdempotencyRecord_service" ON public."IdempotencyRecord"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "_prisma_migrations_service" ON public."_prisma_migrations"';
    EXECUTE 'CREATE POLICY "_prisma_migrations_service" ON public."_prisma_migrations" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin())';
  END IF;
END $$;

-- ─── Grants (preserve Supabase role access) ────────────────────────────────

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
