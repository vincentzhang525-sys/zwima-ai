-- M5.3 Model Capability Management (additive)

CREATE TYPE "CapabilityDataType" AS ENUM ('BOOLEAN', 'NUMBER', 'STRING', 'ENUM', 'JSON');

CREATE TABLE "ModelCapabilityDefinition" (
    "id" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "dataType" "CapabilityDataType" NOT NULL DEFAULT 'BOOLEAN',
    "unit" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelCapabilityDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelCapabilityAssignment" (
    "id" TEXT NOT NULL,
    "modelRegistryId" TEXT NOT NULL,
    "capabilityDefinitionId" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "value" JSONB,
    "source" TEXT,
    "confidence" DECIMAL(5,4),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelCapabilityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelVersionCapabilityAssignment" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "capabilityDefinitionId" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "value" JSONB,
    "source" TEXT,
    "confidence" DECIMAL(5,4),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersionCapabilityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelCapabilityChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelCapabilityChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelCapabilityDefinition_capabilityKey_key" ON "ModelCapabilityDefinition"("capabilityKey");
CREATE INDEX "ModelCapabilityDefinition_category_isActive_idx" ON "ModelCapabilityDefinition"("category", "isActive");
CREATE INDEX "ModelCapabilityDefinition_isActive_idx" ON "ModelCapabilityDefinition"("isActive");

CREATE UNIQUE INDEX "ModelCapabilityAssignment_modelRegistryId_capabilityDefinitionId_key"
  ON "ModelCapabilityAssignment"("modelRegistryId", "capabilityDefinitionId");
CREATE INDEX "ModelCapabilityAssignment_modelRegistryId_idx" ON "ModelCapabilityAssignment"("modelRegistryId");

CREATE UNIQUE INDEX "ModelVersionCapabilityAssignment_modelVersionId_capabilityDefinitionId_key"
  ON "ModelVersionCapabilityAssignment"("modelVersionId", "capabilityDefinitionId");
CREATE INDEX "ModelVersionCapabilityAssignment_modelVersionId_idx" ON "ModelVersionCapabilityAssignment"("modelVersionId");

CREATE INDEX "ModelCapabilityChangeLog_entityType_entityId_createdAt_idx"
  ON "ModelCapabilityChangeLog"("entityType", "entityId", "createdAt");

ALTER TABLE "ModelCapabilityAssignment" ADD CONSTRAINT "ModelCapabilityAssignment_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelCapabilityAssignment" ADD CONSTRAINT "ModelCapabilityAssignment_capabilityDefinitionId_fkey"
  FOREIGN KEY ("capabilityDefinitionId") REFERENCES "ModelCapabilityDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModelVersionCapabilityAssignment" ADD CONSTRAINT "ModelVersionCapabilityAssignment_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelVersionCapabilityAssignment" ADD CONSTRAINT "ModelVersionCapabilityAssignment_capabilityDefinitionId_fkey"
  FOREIGN KEY ("capabilityDefinitionId") REFERENCES "ModelCapabilityDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed 25 system capability definitions (idempotent — does not overwrite admin edits)
INSERT INTO "ModelCapabilityDefinition" (
  "id", "capabilityKey", "displayName", "description", "category", "dataType", "unit",
  "isSystem", "isActive", "updatedAt"
)
SELECT
  'mcdcap_' || v.key,
  v.key,
  v.display_name,
  v.description,
  v.category,
  v.data_type::"CapabilityDataType",
  v.unit,
  true,
  true,
  CURRENT_TIMESTAMP
FROM (VALUES
  ('TEXT_INPUT', 'Text Input', 'Accepts text prompts', 'INPUT', 'BOOLEAN', NULL),
  ('TEXT_OUTPUT', 'Text Output', 'Produces text completions', 'OUTPUT', 'BOOLEAN', NULL),
  ('IMAGE_INPUT', 'Image Input', 'Accepts image inputs', 'INPUT', 'BOOLEAN', NULL),
  ('IMAGE_OUTPUT', 'Image Output', 'Generates images', 'OUTPUT', 'BOOLEAN', NULL),
  ('AUDIO_INPUT', 'Audio Input', 'Accepts audio inputs', 'INPUT', 'BOOLEAN', NULL),
  ('AUDIO_OUTPUT', 'Audio Output', 'Produces audio output', 'OUTPUT', 'BOOLEAN', NULL),
  ('VIDEO_INPUT', 'Video Input', 'Accepts video inputs', 'INPUT', 'BOOLEAN', NULL),
  ('VIDEO_OUTPUT', 'Video Output', 'Generates video output', 'OUTPUT', 'BOOLEAN', NULL),
  ('EMBEDDINGS', 'Embeddings', 'Produces vector embeddings', 'FEATURE', 'BOOLEAN', NULL),
  ('TOOL_CALLING', 'Tool Calling', 'Invokes external tools', 'TOOLS', 'BOOLEAN', NULL),
  ('FUNCTION_CALLING', 'Function Calling', 'Calls registered functions', 'TOOLS', 'BOOLEAN', NULL),
  ('JSON_MODE', 'JSON Mode', 'Constrained JSON output', 'OUTPUT_FORMAT', 'BOOLEAN', NULL),
  ('STRUCTURED_OUTPUT', 'Structured Output', 'Schema-constrained output', 'OUTPUT_FORMAT', 'JSON', NULL),
  ('REASONING', 'Reasoning', 'Extended reasoning mode', 'FEATURE', 'BOOLEAN', NULL),
  ('VISION', 'Vision', 'Multimodal vision understanding', 'FEATURE', 'BOOLEAN', NULL),
  ('WEB_SEARCH', 'Web Search', 'Built-in web search', 'TOOLS', 'BOOLEAN', NULL),
  ('FILE_INPUT', 'File Input', 'Accepts file uploads', 'INPUT', 'BOOLEAN', NULL),
  ('PDF_INPUT', 'PDF Input', 'Accepts PDF documents', 'INPUT', 'BOOLEAN', NULL),
  ('CODE_EXECUTION', 'Code Execution', 'Executes code in sandbox', 'TOOLS', 'BOOLEAN', NULL),
  ('STREAMING', 'Streaming', 'Supports streaming responses', 'FEATURE', 'BOOLEAN', NULL),
  ('BATCH', 'Batch', 'Supports batch API', 'FEATURE', 'BOOLEAN', NULL),
  ('FINE_TUNING', 'Fine Tuning', 'Supports model fine-tuning', 'FEATURE', 'BOOLEAN', NULL),
  ('CACHING', 'Caching', 'Supports prompt caching', 'FEATURE', 'BOOLEAN', NULL),
  ('MULTILINGUAL', 'Multilingual', 'Multi-language support', 'FEATURE', 'BOOLEAN', NULL),
  ('LONG_CONTEXT', 'Long Context', 'Extended context window', 'CONTEXT', 'NUMBER', 'tokens')
) AS v(key, display_name, description, category, data_type, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM "ModelCapabilityDefinition" d WHERE d."capabilityKey" = v.key
);

-- RLS (platform catalog pattern)
ALTER TABLE public."ModelCapabilityDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelCapabilityAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelVersionCapabilityAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelCapabilityChangeLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelCapabilityDefinition_select" ON public."ModelCapabilityDefinition";
CREATE POLICY "ModelCapabilityDefinition_select" ON public."ModelCapabilityDefinition"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelCapabilityDefinition_service_write" ON public."ModelCapabilityDefinition";
CREATE POLICY "ModelCapabilityDefinition_service_write" ON public."ModelCapabilityDefinition"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelCapabilityAssignment_select" ON public."ModelCapabilityAssignment";
CREATE POLICY "ModelCapabilityAssignment_select" ON public."ModelCapabilityAssignment"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelCapabilityAssignment_service_write" ON public."ModelCapabilityAssignment";
CREATE POLICY "ModelCapabilityAssignment_service_write" ON public."ModelCapabilityAssignment"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelVersionCapabilityAssignment_select" ON public."ModelVersionCapabilityAssignment";
CREATE POLICY "ModelVersionCapabilityAssignment_select" ON public."ModelVersionCapabilityAssignment"
  FOR SELECT USING (
    public.is_service_role()
    OR public.is_platform_admin()
    OR public.requesting_clerk_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "ModelVersionCapabilityAssignment_service_write" ON public."ModelVersionCapabilityAssignment";
CREATE POLICY "ModelVersionCapabilityAssignment_service_write" ON public."ModelVersionCapabilityAssignment"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelCapabilityChangeLog_select" ON public."ModelCapabilityChangeLog";
CREATE POLICY "ModelCapabilityChangeLog_select" ON public."ModelCapabilityChangeLog"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelCapabilityChangeLog_service_write" ON public."ModelCapabilityChangeLog";
CREATE POLICY "ModelCapabilityChangeLog_service_write" ON public."ModelCapabilityChangeLog"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
