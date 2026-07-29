-- M5.1 Model Registry (additive)

CREATE TYPE "ModelRegistryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PREVIEW', 'DEPRECATED', 'RETIRED');
CREATE TYPE "ModelRegistryVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

CREATE TABLE "ModelRegistryEntry" (
    "id" TEXT NOT NULL,
    "registryKey" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "modelType" "ModelType" NOT NULL DEFAULT 'CHAT',
    "status" "ModelRegistryStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ModelRegistryVisibility" NOT NULL DEFAULT 'PUBLIC',
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "qualityTier" "QualityTier" NOT NULL DEFAULT 'STANDARD',
    "speedTier" "SpeedTier" NOT NULL DEFAULT 'BALANCED',
    "region" TEXT,
    "euAvailable" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "supportsTools" BOOLEAN NOT NULL DEFAULT false,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "supportsJson" BOOLEAN NOT NULL DEFAULT false,
    "supportsReasoning" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),
    "replacementEntryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelRegistryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelRegistryChangeLog" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRegistryChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelRegistryEntry_registryKey_key" ON "ModelRegistryEntry"("registryKey");
CREATE UNIQUE INDEX "ModelRegistryEntry_providerSlug_modelCode_key" ON "ModelRegistryEntry"("providerSlug", "modelCode");
CREATE INDEX "ModelRegistryEntry_status_visibility_idx" ON "ModelRegistryEntry"("status", "visibility");
CREATE INDEX "ModelRegistryEntry_providerSlug_idx" ON "ModelRegistryEntry"("providerSlug");
CREATE INDEX "ModelRegistryEntry_replacementEntryId_idx" ON "ModelRegistryEntry"("replacementEntryId");
CREATE INDEX "ModelRegistryChangeLog_entryId_createdAt_idx" ON "ModelRegistryChangeLog"("entryId", "createdAt");

ALTER TABLE "ModelRegistryEntry" ADD CONSTRAINT "ModelRegistryEntry_replacementEntryId_fkey"
  FOREIGN KEY ("replacementEntryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelRegistryChangeLog" ADD CONSTRAINT "ModelRegistryChangeLog_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bootstrap from existing provider catalog (idempotent)
INSERT INTO "ModelRegistryEntry" (
  "id", "registryKey", "providerSlug", "modelCode", "displayName", "modelType", "status", "visibility",
  "contextWindow", "maxOutputTokens", "qualityTier", "speedTier", "region", "euAvailable",
  "supportsStreaming", "supportsTools", "supportsVision", "supportsJson", "supportsReasoning",
  "publishedAt", "deprecatedAt", "sortOrder", "updatedAt"
)
SELECT
  'mre_' || pm."id",
  p."slug" || ':' || pm."modelCode",
  p."slug",
  pm."modelCode",
  pm."displayName",
  pm."modelType",
  CASE pm."status"
    WHEN 'ACTIVE' THEN 'ACTIVE'::"ModelRegistryStatus"
    WHEN 'PREVIEW' THEN 'PREVIEW'::"ModelRegistryStatus"
    WHEN 'DEPRECATED' THEN 'DEPRECATED'::"ModelRegistryStatus"
    WHEN 'SUNSET' THEN 'RETIRED'::"ModelRegistryStatus"
    WHEN 'INACTIVE' THEN 'RETIRED'::"ModelRegistryStatus"
    ELSE 'DRAFT'::"ModelRegistryStatus"
  END,
  'PUBLIC'::"ModelRegistryVisibility",
  pm."contextWindow",
  pm."maxOutputTokens",
  pm."qualityTier",
  pm."speedTier",
  pm."region",
  pm."euAvailable",
  pm."supportsStreaming",
  pm."supportsTools",
  pm."supportsVision",
  pm."supportsJson",
  pm."supportsReasoning",
  pm."releaseDate",
  pm."deprecationDate",
  0,
  CURRENT_TIMESTAMP
FROM "ProviderModel" pm
JOIN "Provider" p ON p."id" = pm."providerId"
ON CONFLICT ("registryKey") DO NOTHING;

-- RLS (platform catalog pattern — does not alter existing policies)
ALTER TABLE public."ModelRegistryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelRegistryChangeLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelRegistryEntry_select" ON public."ModelRegistryEntry";
CREATE POLICY "ModelRegistryEntry_select" ON public."ModelRegistryEntry"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelRegistryEntry_service_write" ON public."ModelRegistryEntry";
CREATE POLICY "ModelRegistryEntry_service_write" ON public."ModelRegistryEntry"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelRegistryChangeLog_select" ON public."ModelRegistryChangeLog";
CREATE POLICY "ModelRegistryChangeLog_select" ON public."ModelRegistryChangeLog"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelRegistryChangeLog_service_write" ON public."ModelRegistryChangeLog";
CREATE POLICY "ModelRegistryChangeLog_service_write" ON public."ModelRegistryChangeLog"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
