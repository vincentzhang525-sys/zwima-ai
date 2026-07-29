-- M5.5 Model Availability Management (additive)

CREATE TYPE "ModelAvailabilityState" AS ENUM (
  'AVAILABLE', 'DEGRADED', 'LIMITED', 'RATE_LIMITED', 'MAINTENANCE',
  'REGION_RESTRICTED', 'PROVIDER_OUTAGE', 'UNAVAILABLE', 'UNKNOWN'
);

CREATE TABLE "ModelAvailabilityStatus" (
    "id" TEXT NOT NULL,
    "modelRegistryId" TEXT,
    "modelVersionId" TEXT,
    "providerId" TEXT,
    "region" TEXT,
    "status" "ModelAvailabilityState" NOT NULL DEFAULT 'UNKNOWN',
    "availabilityPercent" DOUBLE PRECISION,
    "latencyP50Ms" INTEGER,
    "latencyP95Ms" INTEGER,
    "latencyP99Ms" INTEGER,
    "errorRate" DECIMAL(8,6),
    "rateLimitRemaining" INTEGER,
    "rateLimitResetAt" TIMESTAMP(3),
    "reasonCode" TEXT,
    "reasonMessage" TEXT,
    "source" TEXT,
    "observationId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelAvailabilityStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelAvailabilityHistory" (
    "id" TEXT NOT NULL,
    "availabilityStatusId" TEXT NOT NULL,
    "modelRegistryId" TEXT,
    "modelVersionId" TEXT,
    "region" TEXT,
    "previousStatus" "ModelAvailabilityState",
    "newStatus" "ModelAvailabilityState" NOT NULL,
    "previousMetrics" JSONB,
    "newMetrics" JSONB,
    "reason" TEXT,
    "source" TEXT,
    "changedBy" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelAvailabilityHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelAvailabilityOverride" (
    "id" TEXT NOT NULL,
    "modelRegistryId" TEXT,
    "modelVersionId" TEXT,
    "region" TEXT,
    "forcedStatus" "ModelAvailabilityState" NOT NULL,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelAvailabilityStatus_observationId_key"
  ON "ModelAvailabilityStatus"("observationId");

CREATE UNIQUE INDEX "ModelAvailabilityStatus_one_current_target"
  ON "ModelAvailabilityStatus"(
    COALESCE("modelRegistryId", ''),
    COALESCE("modelVersionId", ''),
    COALESCE("providerId", ''),
    COALESCE("region", ''),
    COALESCE("source", '')
  )
  WHERE "isCurrent" = true AND "archived" = false;

CREATE INDEX "ModelAvailabilityStatus_modelRegistryId_isCurrent_archived_idx"
  ON "ModelAvailabilityStatus"("modelRegistryId", "isCurrent", "archived");
CREATE INDEX "ModelAvailabilityStatus_modelVersionId_isCurrent_archived_idx"
  ON "ModelAvailabilityStatus"("modelVersionId", "isCurrent", "archived");
CREATE INDEX "ModelAvailabilityStatus_providerId_region_isCurrent_idx"
  ON "ModelAvailabilityStatus"("providerId", "region", "isCurrent");
CREATE INDEX "ModelAvailabilityStatus_status_validUntil_idx"
  ON "ModelAvailabilityStatus"("status", "validUntil");
CREATE INDEX "ModelAvailabilityStatus_lastCheckedAt_idx"
  ON "ModelAvailabilityStatus"("lastCheckedAt");

CREATE INDEX "ModelAvailabilityHistory_availabilityStatusId_createdAt_idx"
  ON "ModelAvailabilityHistory"("availabilityStatusId", "createdAt");
CREATE INDEX "ModelAvailabilityHistory_modelRegistryId_createdAt_idx"
  ON "ModelAvailabilityHistory"("modelRegistryId", "createdAt");

CREATE INDEX "ModelAvailabilityOverride_modelRegistryId_isActive_idx"
  ON "ModelAvailabilityOverride"("modelRegistryId", "isActive");
CREATE INDEX "ModelAvailabilityOverride_modelVersionId_isActive_idx"
  ON "ModelAvailabilityOverride"("modelVersionId", "isActive");
CREATE INDEX "ModelAvailabilityOverride_endsAt_isActive_idx"
  ON "ModelAvailabilityOverride"("endsAt", "isActive");

ALTER TABLE "ModelAvailabilityStatus" ADD CONSTRAINT "ModelAvailabilityStatus_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelAvailabilityStatus" ADD CONSTRAINT "ModelAvailabilityStatus_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelAvailabilityStatus" ADD CONSTRAINT "ModelAvailabilityStatus_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelAvailabilityHistory" ADD CONSTRAINT "ModelAvailabilityHistory_availabilityStatusId_fkey"
  FOREIGN KEY ("availabilityStatusId") REFERENCES "ModelAvailabilityStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelAvailabilityOverride" ADD CONSTRAINT "ModelAvailabilityOverride_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelAvailabilityOverride" ADD CONSTRAINT "ModelAvailabilityOverride_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (platform catalog pattern)
ALTER TABLE public."ModelAvailabilityStatus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelAvailabilityHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelAvailabilityOverride" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelAvailabilityStatus_select" ON public."ModelAvailabilityStatus";
CREATE POLICY "ModelAvailabilityStatus_select" ON public."ModelAvailabilityStatus"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelAvailabilityStatus_service_write" ON public."ModelAvailabilityStatus";
CREATE POLICY "ModelAvailabilityStatus_service_write" ON public."ModelAvailabilityStatus"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelAvailabilityHistory_select" ON public."ModelAvailabilityHistory";
CREATE POLICY "ModelAvailabilityHistory_select" ON public."ModelAvailabilityHistory"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelAvailabilityHistory_service_write" ON public."ModelAvailabilityHistory";
CREATE POLICY "ModelAvailabilityHistory_service_write" ON public."ModelAvailabilityHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelAvailabilityOverride_select" ON public."ModelAvailabilityOverride";
CREATE POLICY "ModelAvailabilityOverride_select" ON public."ModelAvailabilityOverride"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelAvailabilityOverride_admin_write" ON public."ModelAvailabilityOverride";
CREATE POLICY "ModelAvailabilityOverride_admin_write" ON public."ModelAvailabilityOverride"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
