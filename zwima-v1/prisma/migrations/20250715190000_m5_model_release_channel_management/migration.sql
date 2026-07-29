-- M5.7 Model Release Channel Management (additive)

CREATE TYPE "ReleaseAssignmentStatus" AS ENUM (
  'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ROLLED_BACK', 'CANCELLED'
);
CREATE TYPE "ReleasePromotionStatus" AS ENUM (
  'REQUESTED', 'VALIDATING', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS',
  'COMPLETED', 'FAILED', 'ROLLED_BACK', 'CANCELLED'
);
CREATE TYPE "ReleaseAccessType" AS ENUM (
  'PUBLIC', 'ORGANIZATION_ALLOWLIST', 'USER_ALLOWLIST', 'REGION_ALLOWLIST',
  'REGION_BLOCKLIST', 'INTERNAL_ONLY', 'OPT_IN_REQUIRED'
);

CREATE TABLE "ModelReleaseChannel" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "stabilityLevel" INTEGER NOT NULL DEFAULT 50,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "allowsProduction" BOOLEAN NOT NULL DEFAULT false,
    "allowsNewCustomers" BOOLEAN NOT NULL DEFAULT true,
    "requiresExplicitOptIn" BOOLEAN NOT NULL DEFAULT false,
    "requiresOrganizationAllowlist" BOOLEAN NOT NULL DEFAULT false,
    "minimumHealthScore" DOUBLE PRECISION,
    "minimumAvailabilityPercent" DOUBLE PRECISION,
    "supportPolicy" TEXT,
    "requiredCapabilities" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelReleaseChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelVersionReleaseAssignment" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "releaseChannelId" TEXT NOT NULL,
    "status" "ReleaseAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "promotedFromChannelId" TEXT,
    "promotionReason" TEXT,
    "rollbackReason" TEXT,
    "assignedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelVersionReleaseAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelReleasePromotion" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "fromChannelId" TEXT NOT NULL,
    "toChannelId" TEXT NOT NULL,
    "status" "ReleasePromotionStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "rollbackAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "reason" TEXT,
    "overrideReason" TEXT,
    "validationResult" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelReleasePromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelReleasePromotionHistory" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "note" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelReleasePromotionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelReleaseAccessPolicy" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "releaseChannelId" TEXT,
    "organizationId" TEXT,
    "userId" TEXT,
    "region" TEXT,
    "accessType" "ReleaseAccessType" NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelReleaseAccessPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelReleaseChannel_channelKey_key" ON "ModelReleaseChannel"("channelKey");

CREATE UNIQUE INDEX "ModelVersionReleaseAssignment_one_active"
  ON "ModelVersionReleaseAssignment"("modelVersionId")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "ModelVersionReleaseAssignment_modelVersionId_status_idx"
  ON "ModelVersionReleaseAssignment"("modelVersionId", "status");
CREATE INDEX "ModelVersionReleaseAssignment_releaseChannelId_status_idx"
  ON "ModelVersionReleaseAssignment"("releaseChannelId", "status");
CREATE INDEX "ModelVersionReleaseAssignment_effectiveFrom_effectiveUntil_idx"
  ON "ModelVersionReleaseAssignment"("effectiveFrom", "effectiveUntil");

CREATE INDEX "ModelReleasePromotion_modelVersionId_status_idx"
  ON "ModelReleasePromotion"("modelVersionId", "status");
CREATE INDEX "ModelReleasePromotion_status_scheduledAt_idx"
  ON "ModelReleasePromotion"("status", "scheduledAt");

CREATE INDEX "ModelReleasePromotionHistory_promotionId_createdAt_idx"
  ON "ModelReleasePromotionHistory"("promotionId", "createdAt");

CREATE INDEX "ModelReleaseAccessPolicy_modelVersionId_accessType_idx"
  ON "ModelReleaseAccessPolicy"("modelVersionId", "accessType");
CREATE INDEX "ModelReleaseAccessPolicy_releaseChannelId_accessType_idx"
  ON "ModelReleaseAccessPolicy"("releaseChannelId", "accessType");
CREATE INDEX "ModelReleaseAccessPolicy_organizationId_idx"
  ON "ModelReleaseAccessPolicy"("organizationId");
CREATE INDEX "ModelReleaseAccessPolicy_userId_idx"
  ON "ModelReleaseAccessPolicy"("userId");

CREATE INDEX "ModelReleaseChannel_isActive_stabilityLevel_idx"
  ON "ModelReleaseChannel"("isActive", "stabilityLevel");

ALTER TABLE "ModelVersionReleaseAssignment" ADD CONSTRAINT "ModelVersionReleaseAssignment_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelVersionReleaseAssignment" ADD CONSTRAINT "ModelVersionReleaseAssignment_releaseChannelId_fkey"
  FOREIGN KEY ("releaseChannelId") REFERENCES "ModelReleaseChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModelVersionReleaseAssignment" ADD CONSTRAINT "ModelVersionReleaseAssignment_promotedFromChannelId_fkey"
  FOREIGN KEY ("promotedFromChannelId") REFERENCES "ModelReleaseChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelReleasePromotion" ADD CONSTRAINT "ModelReleasePromotion_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelReleasePromotion" ADD CONSTRAINT "ModelReleasePromotion_fromChannelId_fkey"
  FOREIGN KEY ("fromChannelId") REFERENCES "ModelReleaseChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModelReleasePromotion" ADD CONSTRAINT "ModelReleasePromotion_toChannelId_fkey"
  FOREIGN KEY ("toChannelId") REFERENCES "ModelReleaseChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModelReleasePromotionHistory" ADD CONSTRAINT "ModelReleasePromotionHistory_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "ModelReleasePromotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelReleaseAccessPolicy" ADD CONSTRAINT "ModelReleaseAccessPolicy_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelReleaseAccessPolicy" ADD CONSTRAINT "ModelReleaseAccessPolicy_releaseChannelId_fkey"
  FOREIGN KEY ("releaseChannelId") REFERENCES "ModelReleaseChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE public."ModelReleaseChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelVersionReleaseAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelReleasePromotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelReleasePromotionHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelReleaseAccessPolicy" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelReleaseChannel_select" ON public."ModelReleaseChannel";
CREATE POLICY "ModelReleaseChannel_select" ON public."ModelReleaseChannel"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelReleaseChannel_admin_write" ON public."ModelReleaseChannel";
CREATE POLICY "ModelReleaseChannel_admin_write" ON public."ModelReleaseChannel"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelVersionReleaseAssignment_select" ON public."ModelVersionReleaseAssignment";
CREATE POLICY "ModelVersionReleaseAssignment_select" ON public."ModelVersionReleaseAssignment"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelVersionReleaseAssignment_admin_write" ON public."ModelVersionReleaseAssignment";
CREATE POLICY "ModelVersionReleaseAssignment_admin_write" ON public."ModelVersionReleaseAssignment"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelReleasePromotion_select" ON public."ModelReleasePromotion";
CREATE POLICY "ModelReleasePromotion_select" ON public."ModelReleasePromotion"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelReleasePromotion_admin_write" ON public."ModelReleasePromotion";
CREATE POLICY "ModelReleasePromotion_admin_write" ON public."ModelReleasePromotion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelReleasePromotionHistory_select" ON public."ModelReleasePromotionHistory";
CREATE POLICY "ModelReleasePromotionHistory_select" ON public."ModelReleasePromotionHistory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelReleasePromotionHistory_service_write" ON public."ModelReleasePromotionHistory";
CREATE POLICY "ModelReleasePromotionHistory_service_write" ON public."ModelReleasePromotionHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelReleaseAccessPolicy_select" ON public."ModelReleaseAccessPolicy";
CREATE POLICY "ModelReleaseAccessPolicy_select" ON public."ModelReleaseAccessPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelReleaseAccessPolicy_admin_write" ON public."ModelReleaseAccessPolicy";
CREATE POLICY "ModelReleaseAccessPolicy_admin_write" ON public."ModelReleaseAccessPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
