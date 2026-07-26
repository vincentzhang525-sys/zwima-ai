-- M8 Agent Platform Phase 2A — additive migration only.
-- Safe: new enum, new tables, additive nullable ALTER COLUMNs on AgentMemory.
-- NO DROP / NO TRUNCATE / NO destructive ALTER anywhere in this file.
-- This file is created for review only and MUST NOT be executed as part of
-- this task (no `prisma migrate deploy`, no `db push`, no direct psql run).

-- CreateEnum
CREATE TYPE "AgentMemoryType" AS ENUM ('USER', 'WORKSPACE', 'EXECUTION_SUMMARY');

-- CreateTable
CREATE TABLE "AgentTemplate" (
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

-- CreateTable
CREATE TABLE "AgentMemoryPolicy" (
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

-- CreateIndex
CREATE UNIQUE INDEX "AgentTemplate_templateId_key" ON "AgentTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTemplate_organizationId_slug_key" ON "AgentTemplate"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "AgentTemplate_organizationId_category_idx" ON "AgentTemplate"("organizationId", "category");

-- CreateIndex
CREATE INDEX "AgentTemplate_isSystemTemplate_isActive_idx" ON "AgentTemplate"("isSystemTemplate", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemoryPolicy_policyId_key" ON "AgentMemoryPolicy"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemoryPolicy_agentId_key" ON "AgentMemoryPolicy"("agentId");

-- CreateIndex
CREATE INDEX "AgentMemoryPolicy_organizationId_idx" ON "AgentMemoryPolicy"("organizationId");

-- AddForeignKey
ALTER TABLE "AgentTemplate" ADD CONSTRAINT "AgentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemoryPolicy" ADD CONSTRAINT "AgentMemoryPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: AgentMemory (Phase 2A additive columns — all nullable/defaulted, no data loss)
ALTER TABLE "AgentMemory" ADD COLUMN "userId" TEXT;
ALTER TABLE "AgentMemory" ADD COLUMN "memoryType" "AgentMemoryType";
ALTER TABLE "AgentMemory" ADD COLUMN "value" TEXT;
ALTER TABLE "AgentMemory" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing Phase 1 rows get updatedAt = createdAt so the new NOT NULL
-- column has a meaningful value instead of the migration-time default.
UPDATE "AgentMemory" SET "updatedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "AgentMemory_organizationId_agentId_memoryType_idx" ON "AgentMemory"("organizationId", "agentId", "memoryType");
