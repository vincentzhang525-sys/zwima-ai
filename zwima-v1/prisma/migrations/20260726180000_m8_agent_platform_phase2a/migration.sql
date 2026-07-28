-- M8 Agent Platform Phase 2A — additive migration only (Preview-safe guards).

DO $$ BEGIN
  CREATE TYPE "AgentMemoryType" AS ENUM ('USER', 'WORKSPACE', 'EXECUTION_SUMMARY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AgentTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "defaultTemperature" DOUBLE PRECISION NOT NULL,
    "defaultMaxSteps" INTEGER NOT NULL,
    "defaultTimeoutMs" INTEGER NOT NULL,
    "defaultCostCeiling" DOUBLE PRECISION NOT NULL,
    "allowedToolKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentMemoryPolicy" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "agentId" TEXT NOT NULL,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowUserMemory" BOOLEAN NOT NULL DEFAULT false,
    "allowWorkspaceMemory" BOOLEAN NOT NULL DEFAULT false,
    "maxEntries" INTEGER NOT NULL DEFAULT 50,
    "maxEntryCharacters" INTEGER NOT NULL DEFAULT 2000,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentMemoryPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentTemplate_templateId_key" ON "AgentTemplate"("templateId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentTemplate_organizationId_slug_key" ON "AgentTemplate"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "AgentTemplate_organizationId_category_idx" ON "AgentTemplate"("organizationId", "category");
CREATE INDEX IF NOT EXISTS "AgentTemplate_isSystemTemplate_isActive_idx" ON "AgentTemplate"("isSystemTemplate", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentMemoryPolicy_policyId_key" ON "AgentMemoryPolicy"("policyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentMemoryPolicy_agentId_key" ON "AgentMemoryPolicy"("agentId");
CREATE INDEX IF NOT EXISTS "AgentMemoryPolicy_organizationId_idx" ON "AgentMemoryPolicy"("organizationId");

DO $$ BEGIN
  ALTER TABLE "AgentTemplate" ADD CONSTRAINT "AgentTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentMemoryPolicy" ADD CONSTRAINT "AgentMemoryPolicy_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "memoryType" "AgentMemoryType";
ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "value" TEXT;
ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AgentMemory" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "AgentMemory_organizationId_agentId_memoryType_idx"
  ON "AgentMemory"("organizationId", "agentId", "memoryType");
