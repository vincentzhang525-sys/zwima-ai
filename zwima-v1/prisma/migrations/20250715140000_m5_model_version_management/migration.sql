-- M5.2 Model Version Management (additive)

CREATE TYPE "ReleaseChannel" AS ENUM ('STABLE', 'BETA', 'PREVIEW');
CREATE TYPE "VersionLifecycleStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'RETIRED');

CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "modelRegistryId" TEXT NOT NULL,
    "providerVersionId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "releaseChannel" "ReleaseChannel" NOT NULL DEFAULT 'STABLE',
    "lifecycleStatus" "VersionLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "inputPrice" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "outputPrice" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "capabilitySnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelVersionHistory" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "changedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelVersionHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelVersion_modelRegistryId_providerVersionId_key"
  ON "ModelVersion"("modelRegistryId", "providerVersionId");

CREATE UNIQUE INDEX "ModelVersion_one_default_per_model"
  ON "ModelVersion"("modelRegistryId") WHERE "isDefault" = true;

CREATE INDEX "ModelVersion_modelRegistryId_isDefault_idx" ON "ModelVersion"("modelRegistryId", "isDefault");
CREATE INDEX "ModelVersion_modelRegistryId_lifecycleStatus_idx" ON "ModelVersion"("modelRegistryId", "lifecycleStatus");
CREATE INDEX "ModelVersion_releaseChannel_idx" ON "ModelVersion"("releaseChannel");
CREATE INDEX "ModelVersionHistory_versionId_createdAt_idx" ON "ModelVersionHistory"("versionId", "createdAt");

ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelVersionHistory" ADD CONSTRAINT "ModelVersionHistory_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bootstrap one STABLE default version per registry entry (idempotent)
INSERT INTO "ModelVersion" (
  "id", "modelRegistryId", "providerVersionId", "versionLabel", "displayName",
  "releaseDate", "releaseChannel", "lifecycleStatus", "isDefault",
  "contextWindow", "maxOutputTokens", "inputPrice", "outputPrice", "updatedAt"
)
SELECT
  'mver_' || e."id",
  e."id",
  e."modelCode",
  'initial',
  e."displayName",
  e."publishedAt",
  CASE e."status"
    WHEN 'PREVIEW' THEN 'PREVIEW'::"ReleaseChannel"
    ELSE 'STABLE'::"ReleaseChannel"
  END,
  CASE e."status"
    WHEN 'DEPRECATED' THEN 'DEPRECATED'::"VersionLifecycleStatus"
    WHEN 'RETIRED' THEN 'RETIRED'::"VersionLifecycleStatus"
    ELSE 'ACTIVE'::"VersionLifecycleStatus"
  END,
  true,
  e."contextWindow",
  e."maxOutputTokens",
  0,
  0,
  CURRENT_TIMESTAMP
FROM "ModelRegistryEntry" e
WHERE NOT EXISTS (
  SELECT 1 FROM "ModelVersion" v WHERE v."modelRegistryId" = e."id"
);

INSERT INTO "ModelVersionHistory" ("id", "versionId", "action", "previousState", "newState", "reason", "createdAt")
SELECT
  'mvh_boot_' || v."id",
  v."id",
  'CREATE',
  NULL,
  jsonb_build_object(
    'providerVersionId', v."providerVersionId",
    'versionLabel', v."versionLabel",
    'lifecycleStatus', v."lifecycleStatus",
    'isDefault', v."isDefault"
  ),
  'Bootstrap from Model Registry entry',
  CURRENT_TIMESTAMP
FROM "ModelVersion" v
WHERE NOT EXISTS (
  SELECT 1 FROM "ModelVersionHistory" h WHERE h."versionId" = v."id" AND h."action" = 'CREATE'
);

-- RLS (platform catalog pattern — does not alter existing policies)
ALTER TABLE public."ModelVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelVersionHistory" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelVersion_select" ON public."ModelVersion";
CREATE POLICY "ModelVersion_select" ON public."ModelVersion"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelVersion_service_write" ON public."ModelVersion";
CREATE POLICY "ModelVersion_service_write" ON public."ModelVersion"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelVersionHistory_select" ON public."ModelVersionHistory";
CREATE POLICY "ModelVersionHistory_select" ON public."ModelVersionHistory"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelVersionHistory_service_write" ON public."ModelVersionHistory";
CREATE POLICY "ModelVersionHistory_service_write" ON public."ModelVersionHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
