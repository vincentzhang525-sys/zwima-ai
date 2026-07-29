-- M5.9 Provider Model Sync

CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'PLANNING', 'READY', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED', 'ROLLING_BACK', 'ROLLED_BACK');
CREATE TYPE "SyncOperationStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'ROLLED_BACK', 'MANUAL_REVIEW_REQUIRED');
CREATE TYPE "SyncOperationType" AS ENUM (
  'CREATE_MODEL', 'UPDATE_MODEL_METADATA', 'CREATE_VERSION', 'UPDATE_VERSION_METADATA',
  'SYNC_CAPABILITIES', 'SYNC_CONTEXT_WINDOW', 'SYNC_REGIONS', 'SYNC_RELEASE_METADATA',
  'SYNC_AVAILABILITY_METADATA', 'CREATE_PRICING_SIGNAL', 'MARK_PROVIDER_MISSING',
  'CREATE_DEPRECATION_PROPOSAL', 'UPDATE_MAPPING'
);
CREATE TYPE "SyncTriggerType" AS ENUM ('MANUAL', 'APPROVAL_APPLIED', 'SCHEDULED', 'RETRY', 'INTERNAL');
CREATE TYPE "SyncConflictType" AS ENUM (
  'INTERNAL_VALUE_CHANGED', 'MAPPING_CONFLICT', 'VERSION_CONFLICT', 'CAPABILITY_CONFLICT',
  'REGION_CONFLICT', 'RELEASE_CHANNEL_CONFLICT', 'MANUAL_OVERRIDE_PRESENT', 'STALE_DISCOVERY_DATA',
  'TARGET_NOT_FOUND', 'DUPLICATE_TARGET', 'UNSAFE_CHANGE'
);
CREATE TYPE "SyncConflictStatus" AS ENUM (
  'OPEN', 'RESOLVED_INTERNAL_WINS', 'RESOLVED_PROVIDER_WINS', 'RESOLVED_MERGED', 'IGNORED', 'CANCELLED'
);
CREATE TYPE "PricingSignalStatus" AS ENUM ('NEW', 'REVIEWED', 'FORWARDED_TO_PRICING', 'IGNORED', 'RESOLVED');

CREATE TABLE "ProviderSyncProfile" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "profileKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "automaticPlanningEnabled" BOOLEAN NOT NULL DEFAULT false,
  "automaticExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "requireApproval" BOOLEAN NOT NULL DEFAULT true,
  "allowedOperationTypes" JSONB NOT NULL,
  "batchSize" INTEGER NOT NULL DEFAULT 20,
  "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
  "retryLimit" INTEGER NOT NULL DEFAULT 2,
  "concurrencyLimit" INTEGER NOT NULL DEFAULT 1,
  "conflictStrategy" TEXT NOT NULL DEFAULT 'MANUAL_REVIEW',
  "rollbackEnabled" BOOLEAN NOT NULL DEFAULT true,
  "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
  "scheduleExpression" TEXT,
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastFailedSyncAt" TIMESTAMP(3),
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncJob" (
  "id" TEXT NOT NULL,
  "syncKey" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "discoveryRunId" TEXT,
  "triggerType" "SyncTriggerType" NOT NULL DEFAULT 'MANUAL',
  "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "plannedOperations" INTEGER NOT NULL DEFAULT 0,
  "completedOperations" INTEGER NOT NULL DEFAULT 0,
  "failedOperations" INTEGER NOT NULL DEFAULT 0,
  "skippedOperations" INTEGER NOT NULL DEFAULT 0,
  "rollbackOperations" INTEGER NOT NULL DEFAULT 0,
  "requestedBy" TEXT,
  "approvedBy" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "planSummary" JSONB,
  "resultSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncOperation" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "discoveryApprovalId" TEXT,
  "discoveryItemId" TEXT,
  "discoveryChangeId" TEXT,
  "operationKey" TEXT NOT NULL,
  "operationType" "SyncOperationType" NOT NULL,
  "status" "SyncOperationStatus" NOT NULL DEFAULT 'PENDING',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "targetEntityType" TEXT,
  "targetEntityId" TEXT,
  "sourcePayload" JSONB,
  "plannedPayload" JSONB,
  "previousSnapshot" JSONB,
  "appliedSnapshot" JSONB,
  "validationResult" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncConflict" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "conflictType" "SyncConflictType" NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "internalValue" JSONB,
  "providerValue" JSONB,
  "recommendedResolution" TEXT,
  "status" "SyncConflictStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncHistory" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "operationId" TEXT,
  "action" TEXT NOT NULL,
  "previousState" JSONB,
  "newState" JSONB,
  "note" TEXT,
  "changedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderSyncHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderPricingChangeSignal" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "discoveryChangeId" TEXT,
  "modelRegistryId" TEXT,
  "modelVersionId" TEXT,
  "externalModelId" TEXT NOT NULL,
  "signalType" TEXT NOT NULL DEFAULT 'PRICING_CHANGED',
  "previousPricingMetadata" JSONB,
  "discoveredPricingMetadata" JSONB,
  "status" "PricingSignalStatus" NOT NULL DEFAULT 'NEW',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderPricingChangeSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderSyncProfile_providerId_profileKey_key" ON "ProviderSyncProfile"("providerId", "profileKey");
CREATE INDEX "ProviderSyncProfile_isEnabled_scheduleEnabled_idx" ON "ProviderSyncProfile"("isEnabled", "scheduleEnabled");
CREATE UNIQUE INDEX "ProviderSyncJob_syncKey_key" ON "ProviderSyncJob"("syncKey");
CREATE INDEX "ProviderSyncJob_providerId_status_idx" ON "ProviderSyncJob"("providerId", "status");
CREATE INDEX "ProviderSyncJob_profileId_status_idx" ON "ProviderSyncJob"("profileId", "status");
CREATE INDEX "ProviderSyncJob_status_createdAt_idx" ON "ProviderSyncJob"("status", "createdAt");
CREATE UNIQUE INDEX "ProviderSyncOperation_jobId_operationKey_key" ON "ProviderSyncOperation"("jobId", "operationKey");
CREATE INDEX "ProviderSyncOperation_jobId_sequence_idx" ON "ProviderSyncOperation"("jobId", "sequence");
CREATE INDEX "ProviderSyncOperation_status_idx" ON "ProviderSyncOperation"("status");
CREATE INDEX "ProviderSyncOperation_discoveryApprovalId_idx" ON "ProviderSyncOperation"("discoveryApprovalId");
CREATE INDEX "ProviderSyncConflict_jobId_status_idx" ON "ProviderSyncConflict"("jobId", "status");
CREATE INDEX "ProviderSyncConflict_operationId_idx" ON "ProviderSyncConflict"("operationId");
CREATE INDEX "ProviderSyncConflict_providerId_conflictType_idx" ON "ProviderSyncConflict"("providerId", "conflictType");
CREATE INDEX "ProviderSyncHistory_jobId_createdAt_idx" ON "ProviderSyncHistory"("jobId", "createdAt");
CREATE INDEX "ProviderSyncHistory_operationId_idx" ON "ProviderSyncHistory"("operationId");
CREATE INDEX "ProviderPricingChangeSignal_providerId_status_idx" ON "ProviderPricingChangeSignal"("providerId", "status");
CREATE INDEX "ProviderPricingChangeSignal_externalModelId_idx" ON "ProviderPricingChangeSignal"("externalModelId");
CREATE INDEX "ProviderPricingChangeSignal_status_detectedAt_idx" ON "ProviderPricingChangeSignal"("status", "detectedAt");

ALTER TABLE "ProviderSyncProfile" ADD CONSTRAINT "ProviderSyncProfile_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncJob" ADD CONSTRAINT "ProviderSyncJob_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncJob" ADD CONSTRAINT "ProviderSyncJob_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProviderSyncProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncOperation" ADD CONSTRAINT "ProviderSyncOperation_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ProviderSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncConflict" ADD CONSTRAINT "ProviderSyncConflict_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ProviderSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncConflict" ADD CONSTRAINT "ProviderSyncConflict_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "ProviderSyncOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncConflict" ADD CONSTRAINT "ProviderSyncConflict_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncHistory" ADD CONSTRAINT "ProviderSyncHistory_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ProviderSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncHistory" ADD CONSTRAINT "ProviderSyncHistory_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "ProviderSyncOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderPricingChangeSignal" ADD CONSTRAINT "ProviderPricingChangeSignal_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."ProviderSyncProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderSyncJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderSyncOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderSyncConflict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderSyncHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderPricingChangeSignal" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ProviderSyncProfile_select" ON public."ProviderSyncProfile";
CREATE POLICY "ProviderSyncProfile_select" ON public."ProviderSyncProfile"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ProviderSyncProfile_admin_write" ON public."ProviderSyncProfile";
CREATE POLICY "ProviderSyncProfile_admin_write" ON public."ProviderSyncProfile"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ProviderSyncJob_select" ON public."ProviderSyncJob";
CREATE POLICY "ProviderSyncJob_select" ON public."ProviderSyncJob"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ProviderSyncJob_admin_write" ON public."ProviderSyncJob";
CREATE POLICY "ProviderSyncJob_admin_write" ON public."ProviderSyncJob"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ProviderSyncOperation_select" ON public."ProviderSyncOperation";
CREATE POLICY "ProviderSyncOperation_select" ON public."ProviderSyncOperation"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ProviderSyncOperation_service_write" ON public."ProviderSyncOperation";
CREATE POLICY "ProviderSyncOperation_service_write" ON public."ProviderSyncOperation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ProviderSyncConflict_select" ON public."ProviderSyncConflict";
CREATE POLICY "ProviderSyncConflict_select" ON public."ProviderSyncConflict"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ProviderSyncConflict_admin_write" ON public."ProviderSyncConflict";
CREATE POLICY "ProviderSyncConflict_admin_write" ON public."ProviderSyncConflict"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ProviderSyncHistory_select" ON public."ProviderSyncHistory";
CREATE POLICY "ProviderSyncHistory_select" ON public."ProviderSyncHistory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ProviderSyncHistory_service_write" ON public."ProviderSyncHistory";
CREATE POLICY "ProviderSyncHistory_service_write" ON public."ProviderSyncHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ProviderPricingChangeSignal_select" ON public."ProviderPricingChangeSignal";
CREATE POLICY "ProviderPricingChangeSignal_select" ON public."ProviderPricingChangeSignal"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ProviderPricingChangeSignal_admin_write" ON public."ProviderPricingChangeSignal";
CREATE POLICY "ProviderPricingChangeSignal_admin_write" ON public."ProviderPricingChangeSignal"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
