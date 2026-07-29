-- M4 FX Cost & Margin Control (additive)
-- DO NOT apply on Production without separate migration authorization.
-- No DROP / TRUNCATE / RESET.

-- Currency enum extensions (PostgreSQL)
DO $$ BEGIN
  ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'GBP';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'CNY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FxRateStatus
DO $$ BEGIN
  CREATE TYPE "FxRateStatus" AS ENUM ('LIVE', 'CACHED', 'FALLBACK', 'STALE', 'MISSING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FxMarginStatus
DO $$ BEGIN
  CREATE TYPE "FxMarginStatus" AS ENUM ('HEALTHY', 'WARNING', 'REPRICE_REVIEW_REQUIRED', 'CRITICAL', 'FX_RATE_MISSING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "pricingCurrency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "pricingFxRate" DECIMAL(18,10);
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "pricingFxUpdatedAt" TIMESTAMP(3);
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "expectedProviderMix" JSONB;
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "expectedCostEur" DECIMAL(18,8);
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "expectedBufferedCostEur" DECIMAL(18,8);
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "expectedGrossMarginEur" DECIMAL(18,8);
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "expectedGrossMarginRate" DECIMAL(12,8);
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "marginStatus" "FxMarginStatus" NOT NULL DEFAULT 'HEALTHY';

CREATE TABLE IF NOT EXISTS "FxRateSnapshot" (
  "id" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  "quoteCurrency" TEXT NOT NULL DEFAULT 'EUR',
  "rate" DECIMAL(18,10) NOT NULL,
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

CREATE TABLE IF NOT EXISTS "FxBufferPolicy" (
  "id" TEXT NOT NULL,
  "providerId" TEXT,
  "currency" TEXT,
  "bufferRate" DECIMAL(8,6) NOT NULL,
  "minimumBufferRate" DECIMAL(8,6),
  "maximumBufferRate" DECIMAL(8,6),
  "lookbackDays" INTEGER,
  "volatilityBased" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FxBufferPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FxBufferPolicy_providerId_enabled_idx" ON "FxBufferPolicy"("providerId", "enabled");
CREATE INDEX IF NOT EXISTS "FxBufferPolicy_currency_enabled_idx" ON "FxBufferPolicy"("currency", "enabled");

DO $$ BEGIN
  ALTER TABLE "FxBufferPolicy" ADD CONSTRAINT "FxBufferPolicy_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PackageMarginSnapshot" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "pricingCurrency" TEXT NOT NULL DEFAULT 'EUR',
  "pricingFxRate" DECIMAL(18,10),
  "pricingFxUpdatedAt" TIMESTAMP(3),
  "expectedProviderMix" JSONB,
  "expectedCostEur" DECIMAL(18,8) NOT NULL,
  "expectedBufferedCostEur" DECIMAL(18,8) NOT NULL,
  "expectedGrossMarginEur" DECIMAL(18,8) NOT NULL,
  "expectedGrossMarginRate" DECIMAL(12,8),
  "marginStatus" "FxMarginStatus" NOT NULL DEFAULT 'HEALTHY',
  "revenueEur" DECIMAL(18,8) NOT NULL,
  "triggerReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageMarginSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PackageMarginSnapshot_packageId_createdAt_idx" ON "PackageMarginSnapshot"("packageId", "createdAt");
CREATE INDEX IF NOT EXISTS "PackageMarginSnapshot_marginStatus_createdAt_idx" ON "PackageMarginSnapshot"("marginStatus", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PackageMarginSnapshot" ADD CONSTRAINT "PackageMarginSnapshot_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FxRepricingAlert" (
  "id" TEXT NOT NULL,
  "packageId" TEXT,
  "providerId" TEXT,
  "organizationId" TEXT,
  "status" "FxMarginStatus" NOT NULL,
  "alertCode" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "fxChangePct" DECIMAL(12,8),
  "currentMarginRate" DECIMAL(12,8),
  "pricingFxRate" DECIMAL(18,10),
  "currentFxRate" DECIMAL(18,10),
  "suggestedAction" TEXT,
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxRepricingAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FxRepricingAlert_status_acknowledged_createdAt_idx"
  ON "FxRepricingAlert"("status", "acknowledged", "createdAt");
CREATE INDEX IF NOT EXISTS "FxRepricingAlert_packageId_createdAt_idx" ON "FxRepricingAlert"("packageId", "createdAt");
CREATE INDEX IF NOT EXISTS "FxRepricingAlert_providerId_createdAt_idx" ON "FxRepricingAlert"("providerId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "FxRepricingAlert" ADD CONSTRAINT "FxRepricingAlert_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UsageLog FX columns
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateAtUsage" DECIMAL(18,10);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "costInProviderCurrency" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "costInEur" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxBufferRate" DECIMAL(8,6);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxBuffer" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "bufferedCostEur" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "revenueEur" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "grossMarginEur" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "grossMarginRate" DECIMAL(12,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateSource" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateTimestamp" TIMESTAMP(3);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateDate" TIMESTAMP(3);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRatePair" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateStatus" "FxRateStatus";
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "fxRateSnapshotId" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "revaluedCostInEur" DECIMAL(18,8);
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "revaluedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "UsageLog_fxRateSnapshotId_idx" ON "UsageLog"("fxRateSnapshotId");
CREATE INDEX IF NOT EXISTS "UsageLog_fxRateStatus_createdAt_idx" ON "UsageLog"("fxRateStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageLog_organizationId_createdAt_idx" ON "UsageLog"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_fxRateSnapshotId_fkey"
    FOREIGN KEY ("fxRateSnapshotId") REFERENCES "FxRateSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CostCalculation FX columns
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateAtUsage" DECIMAL(18,10);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "costInProviderCurrency" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "costInEur" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxBufferRate" DECIMAL(8,6);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxBuffer" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "bufferedCostEur" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "revenueEur" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "grossMarginEur" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "grossMarginRate" DECIMAL(12,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateSource" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateTimestamp" TIMESTAMP(3);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateDate" TIMESTAMP(3);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRatePair" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateStatus" "FxRateStatus";
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "fxRateSnapshotId" TEXT;
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "revaluedCostInEur" DECIMAL(18,8);
ALTER TABLE "CostCalculation" ADD COLUMN IF NOT EXISTS "revaluedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CostCalculation_fxRateSnapshotId_idx" ON "CostCalculation"("fxRateSnapshotId");
CREATE INDEX IF NOT EXISTS "CostCalculation_fxRateStatus_idx" ON "CostCalculation"("fxRateStatus");

DO $$ BEGIN
  ALTER TABLE "CostCalculation" ADD CONSTRAINT "CostCalculation_fxRateSnapshotId_fkey"
    FOREIGN KEY ("fxRateSnapshotId") REFERENCES "FxRateSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS (admin / service role only)
REVOKE ALL ON TABLE public."FxRateSnapshot" FROM anon, authenticated;
ALTER TABLE public."FxRateSnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FxRateSnapshot_select" ON public."FxRateSnapshot";
CREATE POLICY "FxRateSnapshot_select" ON public."FxRateSnapshot" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "FxRateSnapshot_write" ON public."FxRateSnapshot";
CREATE POLICY "FxRateSnapshot_write" ON public."FxRateSnapshot" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

REVOKE ALL ON TABLE public."FxBufferPolicy" FROM anon, authenticated;
ALTER TABLE public."FxBufferPolicy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FxBufferPolicy_select" ON public."FxBufferPolicy";
CREATE POLICY "FxBufferPolicy_select" ON public."FxBufferPolicy" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "FxBufferPolicy_write" ON public."FxBufferPolicy";
CREATE POLICY "FxBufferPolicy_write" ON public."FxBufferPolicy" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

REVOKE ALL ON TABLE public."PackageMarginSnapshot" FROM anon, authenticated;
ALTER TABLE public."PackageMarginSnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PackageMarginSnapshot_select" ON public."PackageMarginSnapshot";
CREATE POLICY "PackageMarginSnapshot_select" ON public."PackageMarginSnapshot" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "PackageMarginSnapshot_write" ON public."PackageMarginSnapshot";
CREATE POLICY "PackageMarginSnapshot_write" ON public."PackageMarginSnapshot" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

REVOKE ALL ON TABLE public."FxRepricingAlert" FROM anon, authenticated;
ALTER TABLE public."FxRepricingAlert" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FxRepricingAlert_select" ON public."FxRepricingAlert";
CREATE POLICY "FxRepricingAlert_select" ON public."FxRepricingAlert" FOR SELECT USING (public.is_service_role() OR public.is_platform_admin());
DROP POLICY IF EXISTS "FxRepricingAlert_write" ON public."FxRepricingAlert";
CREATE POLICY "FxRepricingAlert_write" ON public."FxRepricingAlert" FOR ALL USING (public.is_service_role() OR public.is_platform_admin()) WITH CHECK (public.is_service_role() OR public.is_platform_admin());

-- Seed default currency buffer policies (idempotent via label)
INSERT INTO "FxBufferPolicy" ("id", "currency", "bufferRate", "enabled", "label", "updatedAt")
SELECT 'fxbuf_eur_default', 'EUR', 0, true, 'system_default_eur', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "FxBufferPolicy" WHERE "label" = 'system_default_eur');
INSERT INTO "FxBufferPolicy" ("id", "currency", "bufferRate", "enabled", "label", "updatedAt")
SELECT 'fxbuf_usd_default', 'USD', 0.03, true, 'system_default_usd', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "FxBufferPolicy" WHERE "label" = 'system_default_usd');
INSERT INTO "FxBufferPolicy" ("id", "currency", "bufferRate", "enabled", "label", "updatedAt")
SELECT 'fxbuf_gbp_default', 'GBP', 0.03, true, 'system_default_gbp', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "FxBufferPolicy" WHERE "label" = 'system_default_gbp');
INSERT INTO "FxBufferPolicy" ("id", "currency", "bufferRate", "enabled", "label", "updatedAt")
SELECT 'fxbuf_cny_default', 'CNY', 0.04, true, 'system_default_cny', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "FxBufferPolicy" WHERE "label" = 'system_default_cny');
