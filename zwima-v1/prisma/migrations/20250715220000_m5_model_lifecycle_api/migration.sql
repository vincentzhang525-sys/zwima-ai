-- M5.10 Unified Model Lifecycle API

CREATE TABLE "ModelLifecycleSnapshot" (
  "id" TEXT NOT NULL,
  "modelRegistryId" TEXT,
  "providerId" TEXT,
  "snapshotType" TEXT NOT NULL,
  "snapshotKey" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "ModelLifecycleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelLifecycleActionRecord" (
  "id" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "modelId" TEXT,
  "versionId" TEXT,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "requestHash" TEXT,
  "requestBody" JSONB,
  "result" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ModelLifecycleActionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelLifecycleSnapshot_snapshotKey_key" ON "ModelLifecycleSnapshot"("snapshotKey");
CREATE INDEX "ModelLifecycleSnapshot_modelRegistryId_createdAt_idx" ON "ModelLifecycleSnapshot"("modelRegistryId", "createdAt");
CREATE INDEX "ModelLifecycleSnapshot_providerId_createdAt_idx" ON "ModelLifecycleSnapshot"("providerId", "createdAt");
CREATE INDEX "ModelLifecycleSnapshot_snapshotType_createdAt_idx" ON "ModelLifecycleSnapshot"("snapshotType", "createdAt");
CREATE INDEX "ModelLifecycleSnapshot_expiresAt_idx" ON "ModelLifecycleSnapshot"("expiresAt");
CREATE INDEX "ModelLifecycleActionRecord_actionType_createdAt_idx" ON "ModelLifecycleActionRecord"("actionType", "createdAt");
CREATE INDEX "ModelLifecycleActionRecord_actorUserId_createdAt_idx" ON "ModelLifecycleActionRecord"("actorUserId", "createdAt");
CREATE INDEX "ModelLifecycleActionRecord_status_idx" ON "ModelLifecycleActionRecord"("status");

ALTER TABLE public."ModelLifecycleSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelLifecycleActionRecord" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelLifecycleSnapshot_select" ON public."ModelLifecycleSnapshot";
CREATE POLICY "ModelLifecycleSnapshot_select" ON public."ModelLifecycleSnapshot"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ModelLifecycleSnapshot_admin_write" ON public."ModelLifecycleSnapshot";
CREATE POLICY "ModelLifecycleSnapshot_admin_write" ON public."ModelLifecycleSnapshot"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelLifecycleActionRecord_select" ON public."ModelLifecycleActionRecord";
CREATE POLICY "ModelLifecycleActionRecord_select" ON public."ModelLifecycleActionRecord"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "ModelLifecycleActionRecord_admin_write" ON public."ModelLifecycleActionRecord";
CREATE POLICY "ModelLifecycleActionRecord_admin_write" ON public."ModelLifecycleActionRecord"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
