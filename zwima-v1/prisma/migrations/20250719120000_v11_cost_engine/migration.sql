-- V1.1 Unified Cost Engine (additive)
-- CostProfile / PriceHistory / PriceVersion + UsageLog cost fields

CREATE TYPE "PriceVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "PriceVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "label" TEXT,
    "status" "PriceVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceVersion_version_key" ON "PriceVersion"("version");
CREATE INDEX "PriceVersion_status_effectiveFrom_idx" ON "PriceVersion"("status", "effectiveFrom");

CREATE TABLE "CostProfile" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "inputPricePer1M" DECIMAL(14,6) NOT NULL,
    "outputPricePer1M" DECIMAL(14,6) NOT NULL,
    "cacheReadPrice" DECIMAL(14,6),
    "cacheWritePrice" DECIMAL(14,6),
    "toolCallPrice" DECIMAL(14,6),
    "retryPrice" DECIMAL(14,6),
    "regionSurcharge" DECIMAL(8,4),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CostProfile_provider_model_modelVersion_priceVersionId_key"
  ON "CostProfile"("provider", "model", "modelVersion", "priceVersionId");
CREATE INDEX "CostProfile_provider_model_active_effectiveFrom_idx"
  ON "CostProfile"("provider", "model", "active", "effectiveFrom");
CREATE INDEX "CostProfile_priceVersionId_idx" ON "CostProfile"("priceVersionId");

CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "costProfileId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" DECIMAL(14,6),
    "newValue" DECIMAL(14,6),
    "priceVersionId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "reason" TEXT,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceHistory_provider_model_changedAt_idx" ON "PriceHistory"("provider", "model", "changedAt");
CREATE INDEX "PriceHistory_priceVersionId_changedAt_idx" ON "PriceHistory"("priceVersionId", "changedAt");
CREATE INDEX "PriceHistory_costProfileId_idx" ON "PriceHistory"("costProfileId");

CREATE TABLE "CostCalculation" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "region" TEXT,
    "estimatedCost" DECIMAL(14,6) NOT NULL,
    "actualCost" DECIMAL(14,6) NOT NULL,
    "grossMargin" DECIMAL(14,6) NOT NULL,
    "netMargin" DECIMAL(14,6) NOT NULL,
    "marginPercent" DECIMAL(8,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceVersionId" TEXT,
    "costProfileId" TEXT,
    "usageLogId" TEXT,
    "customerCredits" INTEGER,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCalculation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostCalculation_provider_model_createdAt_idx" ON "CostCalculation"("provider", "model", "createdAt");
CREATE INDEX "CostCalculation_usageLogId_idx" ON "CostCalculation"("usageLogId");
CREATE INDEX "CostCalculation_costProfileId_idx" ON "CostCalculation"("costProfileId");

ALTER TABLE "CostProfile"
  ADD CONSTRAINT "CostProfile_priceVersionId_fkey"
  FOREIGN KEY ("priceVersionId") REFERENCES "PriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PriceHistory"
  ADD CONSTRAINT "PriceHistory_costProfileId_fkey"
  FOREIGN KEY ("costProfileId") REFERENCES "CostProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceHistory"
  ADD CONSTRAINT "PriceHistory_priceVersionId_fkey"
  FOREIGN KEY ("priceVersionId") REFERENCES "PriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CostCalculation"
  ADD CONSTRAINT "CostCalculation_costProfileId_fkey"
  FOREIGN KEY ("costProfileId") REFERENCES "CostProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UsageLog additive cost fields (billing reads ActualCost / GrossMargin)
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "estimatedCost" DECIMAL(14,6);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "actualCost" DECIMAL(14,6);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "grossMargin" DECIMAL(14,6);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "netMargin" DECIMAL(14,6);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "marginPercent" DECIMAL(8,4);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "costProfileId" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "priceVersionId" TEXT;

CREATE INDEX IF NOT EXISTS "UsageLog_costProfileId_idx" ON "UsageLog"("costProfileId");
