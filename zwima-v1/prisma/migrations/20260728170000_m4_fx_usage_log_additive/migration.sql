-- M4 FX additive migration — safe for Preview DB (IF NOT EXISTS / duplicate_object guards).
-- Adds UsageLog FX snapshot columns, Provider.providerCurrency, FxRateStatus enum.

DO $$ BEGIN
  CREATE TYPE "FxRateStatus" AS ENUM ('LIVE', 'CACHED', 'FALLBACK', 'STALE', 'MISSING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateAtUsage" DECIMAL(18, 10);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "costInProviderCurrency" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "costInEur" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxBufferRate" DECIMAL(8, 6);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxBuffer" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "bufferedCostEur" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "revenueEur" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "grossMarginEur" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "grossMarginRate" DECIMAL(12, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateSource" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateTimestamp" TIMESTAMP(3);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateDate" TIMESTAMP(3);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRatePair" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateStatus" "FxRateStatus";
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateSnapshotId" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "revaluedCostInEur" DECIMAL(18, 8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "revaluedAt" TIMESTAMP(3);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- CostCalculation FX columns (nullable additive)
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateAtUsage" DECIMAL(18, 10);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "costInProviderCurrency" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "costInEur" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxBufferRate" DECIMAL(8, 6);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxBuffer" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "bufferedCostEur" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "revenueEur" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "grossMarginEur" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "grossMarginRate" DECIMAL(12, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateSource" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateTimestamp" TIMESTAMP(3);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateDate" TIMESTAMP(3);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRatePair" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateStatus" "FxRateStatus";
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateSnapshotId" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "revaluedCostInEur" DECIMAL(18, 8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "revaluedAt" TIMESTAMP(3);

-- FxRateSnapshot table (if missing from earlier migrations)
CREATE TABLE IF NOT EXISTS "FxRateSnapshot" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "rate" DECIMAL(18, 10) NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FxRateStatus" NOT NULL DEFAULT 'LIVE',
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FxRateSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FxRateSnapshot_baseCurrency_quoteCurrency_effectiveAt_source_key"
  ON "FxRateSnapshot"("baseCurrency", "quoteCurrency", "effectiveAt", "source");
CREATE INDEX IF NOT EXISTS "FxRateSnapshot_baseCurrency_quoteCurrency_rateDate_idx"
  ON "FxRateSnapshot"("baseCurrency", "quoteCurrency", "rateDate");
CREATE INDEX IF NOT EXISTS "FxRateSnapshot_status_fetchedAt_idx"
  ON "FxRateSnapshot"("status", "fetchedAt");

DO $$ BEGIN
  ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_fxRateSnapshotId_fkey"
    FOREIGN KEY ("fxRateSnapshotId") REFERENCES "FxRateSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CostCalculation" ADD CONSTRAINT "CostCalculation_fxRateSnapshotId_fkey"
    FOREIGN KEY ("fxRateSnapshotId") REFERENCES "FxRateSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
