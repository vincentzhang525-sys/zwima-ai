-- M5.8 Model Auto Discovery

CREATE TYPE "DiscoveryRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');
CREATE TYPE "DiscoveredItemStatus" AS ENUM ('NEW', 'MATCHED', 'CHANGED', 'MISSING', 'CONFLICT', 'IGNORED', 'APPROVED', 'REJECTED', 'APPLIED');
CREATE TYPE "DiscoveryChangeType" AS ENUM (
  'MODEL_CREATED', 'MODEL_UPDATED', 'VERSION_CREATED', 'VERSION_UPDATED', 'CAPABILITY_CHANGED',
  'CONTEXT_WINDOW_CHANGED', 'PRICING_CHANGED', 'REGION_CHANGED', 'AVAILABILITY_CHANGED',
  'RELEASE_CHANNEL_CHANGED', 'MODEL_MISSING', 'POSSIBLE_DEPRECATION', 'METADATA_CHANGED'
);
CREATE TYPE "DiscoveryTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'INTERNAL', 'RETRY');
CREATE TYPE "DiscoverySourceType" AS ENUM ('PROVIDER_API', 'PROVIDER_CATALOG', 'MANUAL');
CREATE TYPE "DiscoveryAuthenticationType" AS ENUM ('ENV_API_KEY', 'PROVIDER_CONFIG', 'NONE');
CREATE TYPE "DiscoveryMappingType" AS ENUM ('AUTOMATIC', 'MANUAL', 'ALIAS', 'LEGACY');
CREATE TYPE "DiscoveryApprovalAction" AS ENUM (
  'CREATE_MODEL', 'CREATE_VERSION', 'UPDATE_METADATA', 'UPDATE_CAPABILITIES', 'UPDATE_CONTEXT_WINDOW',
  'FLAG_PRICING_CHANGE', 'UPDATE_REGIONS', 'MARK_MISSING', 'PROPOSE_DEPRECATION', 'IGNORE_CHANGE'
);
CREATE TYPE "DiscoveryApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'FAILED');
CREATE TYPE "DiscoveryChangeStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'IGNORED', 'APPLIED');

CREATE TABLE "ModelDiscoverySource" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceType" "DiscoverySourceType" NOT NULL DEFAULT 'PROVIDER_API',
  "endpoint" TEXT,
  "authenticationType" "DiscoveryAuthenticationType" NOT NULL DEFAULT 'ENV_API_KEY',
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
  "scheduleExpression" TEXT,
  "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
  "retryLimit" INTEGER NOT NULL DEFAULT 2,
  "lastSuccessfulRunAt" TIMESTAMP(3),
  "lastFailedRunAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelDiscoverySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDiscoveryRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'PENDING',
  "triggerType" "DiscoveryTriggerType" NOT NULL DEFAULT 'MANUAL',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "modelsReceived" INTEGER NOT NULL DEFAULT 0,
  "modelsMatched" INTEGER NOT NULL DEFAULT 0,
  "modelsNew" INTEGER NOT NULL DEFAULT 0,
  "modelsChanged" INTEGER NOT NULL DEFAULT 0,
  "modelsMissing" INTEGER NOT NULL DEFAULT 0,
  "conflicts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "requestMetadata" JSONB,
  "resultMetadata" JSONB,
  "triggeredBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelDiscoveryRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDiscoveryItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalModelId" TEXT NOT NULL,
  "externalVersionId" TEXT NOT NULL DEFAULT '',
  "normalizedModelKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "normalizedPayload" JSONB NOT NULL,
  "matchedModelRegistryId" TEXT,
  "matchedModelVersionId" TEXT,
  "status" "DiscoveredItemStatus" NOT NULL DEFAULT 'NEW',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelDiscoveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDiscoveryChange" (
  "id" TEXT NOT NULL,
  "discoveryItemId" TEXT NOT NULL,
  "changeType" "DiscoveryChangeType" NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "previousValue" JSONB,
  "discoveredValue" JSONB,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "status" "DiscoveryChangeStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelDiscoveryChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDiscoveryMapping" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalModelId" TEXT NOT NULL,
  "externalVersionId" TEXT NOT NULL DEFAULT '',
  "modelRegistryId" TEXT NOT NULL,
  "modelVersionId" TEXT,
  "mappingType" "DiscoveryMappingType" NOT NULL DEFAULT 'AUTOMATIC',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "consecutiveMissCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelDiscoveryMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelDiscoveryApproval" (
  "id" TEXT NOT NULL,
  "runId" TEXT,
  "discoveryItemId" TEXT,
  "discoveryChangeId" TEXT,
  "action" "DiscoveryApprovalAction" NOT NULL,
  "status" "DiscoveryApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT,
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "applyResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelDiscoveryApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelDiscoverySource_providerId_sourceKey_key" ON "ModelDiscoverySource"("providerId", "sourceKey");
CREATE INDEX "ModelDiscoverySource_isEnabled_scheduleEnabled_idx" ON "ModelDiscoverySource"("isEnabled", "scheduleEnabled");
CREATE INDEX "ModelDiscoveryRun_sourceId_status_idx" ON "ModelDiscoveryRun"("sourceId", "status");
CREATE INDEX "ModelDiscoveryRun_providerId_status_idx" ON "ModelDiscoveryRun"("providerId", "status");
CREATE INDEX "ModelDiscoveryRun_status_createdAt_idx" ON "ModelDiscoveryRun"("status", "createdAt");
CREATE UNIQUE INDEX "ModelDiscoveryItem_runId_externalModelId_externalVersionId_key" ON "ModelDiscoveryItem"("runId", "externalModelId", "externalVersionId");
CREATE INDEX "ModelDiscoveryItem_providerId_externalModelId_idx" ON "ModelDiscoveryItem"("providerId", "externalModelId");
CREATE INDEX "ModelDiscoveryItem_status_idx" ON "ModelDiscoveryItem"("status");
CREATE INDEX "ModelDiscoveryItem_normalizedModelKey_idx" ON "ModelDiscoveryItem"("normalizedModelKey");
CREATE INDEX "ModelDiscoveryChange_discoveryItemId_changeType_idx" ON "ModelDiscoveryChange"("discoveryItemId", "changeType");
CREATE INDEX "ModelDiscoveryChange_status_idx" ON "ModelDiscoveryChange"("status");
CREATE INDEX "ModelDiscoveryMapping_providerId_externalModelId_idx" ON "ModelDiscoveryMapping"("providerId", "externalModelId");
CREATE INDEX "ModelDiscoveryMapping_modelRegistryId_idx" ON "ModelDiscoveryMapping"("modelRegistryId");
CREATE INDEX "ModelDiscoveryMapping_isConfirmed_mappingType_idx" ON "ModelDiscoveryMapping"("isConfirmed", "mappingType");
CREATE INDEX "ModelDiscoveryApproval_status_action_idx" ON "ModelDiscoveryApproval"("status", "action");
CREATE INDEX "ModelDiscoveryApproval_runId_idx" ON "ModelDiscoveryApproval"("runId");

ALTER TABLE "ModelDiscoverySource" ADD CONSTRAINT "ModelDiscoverySource_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryRun" ADD CONSTRAINT "ModelDiscoveryRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ModelDiscoverySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryItem" ADD CONSTRAINT "ModelDiscoveryItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "ModelDiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryChange" ADD CONSTRAINT "ModelDiscoveryChange_discoveryItemId_fkey"
  FOREIGN KEY ("discoveryItemId") REFERENCES "ModelDiscoveryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryMapping" ADD CONSTRAINT "ModelDiscoveryMapping_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryMapping" ADD CONSTRAINT "ModelDiscoveryMapping_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryApproval" ADD CONSTRAINT "ModelDiscoveryApproval_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "ModelDiscoveryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryApproval" ADD CONSTRAINT "ModelDiscoveryApproval_discoveryItemId_fkey"
  FOREIGN KEY ("discoveryItemId") REFERENCES "ModelDiscoveryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelDiscoveryApproval" ADD CONSTRAINT "ModelDiscoveryApproval_discoveryChangeId_fkey"
  FOREIGN KEY ("discoveryChangeId") REFERENCES "ModelDiscoveryChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE public."ModelDiscoverySource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDiscoveryRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDiscoveryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDiscoveryChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDiscoveryMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelDiscoveryApproval" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelDiscoverySource_select" ON public."ModelDiscoverySource";
CREATE POLICY "ModelDiscoverySource_select" ON public."ModelDiscoverySource"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelDiscoverySource_admin_write" ON public."ModelDiscoverySource";
CREATE POLICY "ModelDiscoverySource_admin_write" ON public."ModelDiscoverySource"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDiscoveryRun_select" ON public."ModelDiscoveryRun";
CREATE POLICY "ModelDiscoveryRun_select" ON public."ModelDiscoveryRun"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelDiscoveryRun_service_write" ON public."ModelDiscoveryRun";
CREATE POLICY "ModelDiscoveryRun_service_write" ON public."ModelDiscoveryRun"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDiscoveryItem_select" ON public."ModelDiscoveryItem";
CREATE POLICY "ModelDiscoveryItem_select" ON public."ModelDiscoveryItem"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelDiscoveryItem_service_write" ON public."ModelDiscoveryItem";
CREATE POLICY "ModelDiscoveryItem_service_write" ON public."ModelDiscoveryItem"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDiscoveryChange_select" ON public."ModelDiscoveryChange";
CREATE POLICY "ModelDiscoveryChange_select" ON public."ModelDiscoveryChange"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelDiscoveryChange_service_write" ON public."ModelDiscoveryChange";
CREATE POLICY "ModelDiscoveryChange_service_write" ON public."ModelDiscoveryChange"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDiscoveryMapping_select" ON public."ModelDiscoveryMapping";
CREATE POLICY "ModelDiscoveryMapping_select" ON public."ModelDiscoveryMapping"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelDiscoveryMapping_admin_write" ON public."ModelDiscoveryMapping";
CREATE POLICY "ModelDiscoveryMapping_admin_write" ON public."ModelDiscoveryMapping"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelDiscoveryApproval_select" ON public."ModelDiscoveryApproval";
CREATE POLICY "ModelDiscoveryApproval_select" ON public."ModelDiscoveryApproval"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelDiscoveryApproval_admin_write" ON public."ModelDiscoveryApproval";
CREATE POLICY "ModelDiscoveryApproval_admin_write" ON public."ModelDiscoveryApproval"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
