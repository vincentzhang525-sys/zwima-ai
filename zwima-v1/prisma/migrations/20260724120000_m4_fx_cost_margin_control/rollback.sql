-- M4 FX Cost & Margin Control — ROLLBACK (authorized window only)
-- Reverses 20260724120000_m4_fx_cost_margin_control additive objects.
-- Does NOT restore Currency enum values GBP/CNY (PostgreSQL cannot easily remove enum labels).
-- Does NOT DROP / TRUNCATE business tables Provider, UsageLog, CostCalculation, CreditPackage.

BEGIN;

-- Drop FKs / columns from existing tables (FX-only columns)
ALTER TABLE IF EXISTS "UsageLog" DROP CONSTRAINT IF EXISTS "UsageLog_fxRateSnapshotId_fkey";
ALTER TABLE IF EXISTS "CostCalculation" DROP CONSTRAINT IF EXISTS "CostCalculation_fxRateSnapshotId_fkey";

DROP INDEX IF EXISTS "UsageLog_fxRateSnapshotId_idx";
DROP INDEX IF EXISTS "UsageLog_fxRateStatus_createdAt_idx";
DROP INDEX IF EXISTS "UsageLog_organizationId_createdAt_idx";
DROP INDEX IF EXISTS "CostCalculation_fxRateSnapshotId_idx";
DROP INDEX IF EXISTS "CostCalculation_fxRateStatus_idx";

ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "providerCurrency";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRateAtUsage";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "costInProviderCurrency";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "costInEur";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxBufferRate";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxBuffer";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "bufferedCostEur";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "revenueEur";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "grossMarginEur";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "grossMarginRate";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRateSource";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRateTimestamp";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRateDate";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRatePair";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRateStatus";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "fxRateSnapshotId";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "revaluedCostInEur";
ALTER TABLE "UsageLog" DROP COLUMN IF EXISTS "revaluedAt";

ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "providerCurrency";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRateAtUsage";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "costInProviderCurrency";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "costInEur";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxBufferRate";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxBuffer";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "bufferedCostEur";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "revenueEur";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "grossMarginEur";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "grossMarginRate";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRateSource";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRateTimestamp";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRateDate";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRatePair";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRateStatus";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "fxRateSnapshotId";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "revaluedCostInEur";
ALTER TABLE "CostCalculation" DROP COLUMN IF EXISTS "revaluedAt";

ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "pricingCurrency";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "pricingFxRate";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "pricingFxUpdatedAt";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "expectedProviderMix";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "expectedCostEur";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "expectedBufferedCostEur";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "expectedGrossMarginEur";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "expectedGrossMarginRate";
ALTER TABLE "CreditPackage" DROP COLUMN IF EXISTS "marginStatus";

ALTER TABLE "Provider" DROP COLUMN IF EXISTS "providerCurrency";

-- Drop new FX tables (policies cascade with table)
DROP TABLE IF EXISTS "FxRepricingAlert" CASCADE;
DROP TABLE IF EXISTS "PackageMarginSnapshot" CASCADE;
DROP TABLE IF EXISTS "FxBufferPolicy" CASCADE;
DROP TABLE IF EXISTS "FxRateSnapshot" CASCADE;

-- Enums FxRateStatus / FxMarginStatus may remain if still referenced; drop if unused:
DROP TYPE IF EXISTS "FxRateStatus";
DROP TYPE IF EXISTS "FxMarginStatus";

COMMIT;
