-- M5.4 Model Deprecation Management (additive)

CREATE TYPE "ModelDeprecationStatus" AS ENUM (
  'ACTIVE', 'DEPRECATION_ANNOUNCED', 'DEPRECATED', 'SUNSET_SCHEDULED', 'RETIRED', 'DISABLED'
);
CREATE TYPE "DeprecationNotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "DeprecationNotificationType" AS ENUM (
  'ANNOUNCEMENT', 'REMINDER_30D', 'REMINDER_14D', 'REMINDER_7D', 'REMINDER_1D',
  'SUNSET_DAY', 'POSTPONED', 'EMERGENCY_DISABLE'
);
CREATE TYPE "DeprecationNotificationStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "ModelDeprecationPolicy" (
    "id" TEXT NOT NULL,
    "modelRegistryId" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "status" "ModelDeprecationStatus" NOT NULL DEFAULT 'ACTIVE',
    "announcementDate" TIMESTAMP(3),
    "deprecationDate" TIMESTAMP(3),
    "sunsetDate" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "replacementModelRegistryId" TEXT,
    "replacementModelVersionId" TEXT,
    "reason" TEXT,
    "customerMessage" TEXT,
    "internalNotes" TEXT,
    "migrationGuideUrl" TEXT,
    "source" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelDeprecationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDeprecationHistory" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "modelRegistryId" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "action" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelDeprecationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDeprecationNotification" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "channel" "DeprecationNotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "notificationType" "DeprecationNotificationType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "DeprecationNotificationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelDeprecationNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelDeprecationPolicy_one_active_model_policy"
  ON "ModelDeprecationPolicy"("modelRegistryId")
  WHERE "modelVersionId" IS NULL AND "archived" = false;

CREATE UNIQUE INDEX "ModelDeprecationPolicy_one_active_version_policy"
  ON "ModelDeprecationPolicy"("modelVersionId")
  WHERE "modelVersionId" IS NOT NULL AND "archived" = false;

CREATE INDEX "ModelDeprecationPolicy_modelRegistryId_archived_idx"
  ON "ModelDeprecationPolicy"("modelRegistryId", "archived");
CREATE INDEX "ModelDeprecationPolicy_modelVersionId_archived_idx"
  ON "ModelDeprecationPolicy"("modelVersionId", "archived");
CREATE INDEX "ModelDeprecationPolicy_status_sunsetDate_idx"
  ON "ModelDeprecationPolicy"("status", "sunsetDate");

CREATE INDEX "ModelDeprecationHistory_policyId_createdAt_idx"
  ON "ModelDeprecationHistory"("policyId", "createdAt");
CREATE INDEX "ModelDeprecationHistory_modelRegistryId_createdAt_idx"
  ON "ModelDeprecationHistory"("modelRegistryId", "createdAt");

CREATE UNIQUE INDEX "ModelDeprecationNotification_policyId_notificationType_channel_key"
  ON "ModelDeprecationNotification"("policyId", "notificationType", "channel");
CREATE INDEX "ModelDeprecationNotification_policyId_scheduledAt_idx"
  ON "ModelDeprecationNotification"("policyId", "scheduledAt");
CREATE INDEX "ModelDeprecationNotification_status_scheduledAt_idx"
  ON "ModelDeprecationNotification"("status", "scheduledAt");

ALTER TABLE "ModelDeprecationPolicy" ADD CONSTRAINT "ModelDeprecationPolicy_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDeprecationPolicy" ADD CONSTRAINT "ModelDeprecationPolicy_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDeprecationPolicy" ADD CONSTRAINT "ModelDeprecationPolicy_replacementModelRegistryId_fkey"
  FOREIGN KEY ("replacementModelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelDeprecationPolicy" ADD CONSTRAINT "ModelDeprecationPolicy_replacementModelVersionId_fkey"
  FOREIGN KEY ("replacementModelVersionId") REFERENCES "ModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelDeprecationHistory" ADD CONSTRAINT "ModelDeprecationHistory_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "ModelDeprecationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelDeprecationNotification" ADD CONSTRAINT "ModelDeprecationNotification_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "ModelDeprecationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (platform catalog pattern)
ALTER TABLE public."ModelDeprecationPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDeprecationHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDeprecationNotification" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelDeprecationPolicy_select" ON public."ModelDeprecationPolicy";
CREATE POLICY "ModelDeprecationPolicy_select" ON public."ModelDeprecationPolicy"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelDeprecationPolicy_service_write" ON public."ModelDeprecationPolicy";
CREATE POLICY "ModelDeprecationPolicy_service_write" ON public."ModelDeprecationPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDeprecationHistory_select" ON public."ModelDeprecationHistory";
CREATE POLICY "ModelDeprecationHistory_select" ON public."ModelDeprecationHistory"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelDeprecationHistory_service_write" ON public."ModelDeprecationHistory";
CREATE POLICY "ModelDeprecationHistory_service_write" ON public."ModelDeprecationHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDeprecationNotification_select" ON public."ModelDeprecationNotification";
CREATE POLICY "ModelDeprecationNotification_select" ON public."ModelDeprecationNotification"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelDeprecationNotification_service_write" ON public."ModelDeprecationNotification";
CREATE POLICY "ModelDeprecationNotification_service_write" ON public."ModelDeprecationNotification"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
