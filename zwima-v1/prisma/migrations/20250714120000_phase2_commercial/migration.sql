-- Phase 2: Model lifecycle, Cost Calculator V2, AI Compliance (additive only)

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING_REVIEW', 'COMPLIANT', 'NON_COMPLIANT', 'EXEMPT');

-- AlterEnum ProviderModelStatus
ALTER TYPE "ProviderModelStatus" ADD VALUE IF NOT EXISTS 'PREVIEW';
ALTER TYPE "ProviderModelStatus" ADD VALUE IF NOT EXISTS 'SUNSET';

-- AlterTable ProviderModel
ALTER TABLE "ProviderModel" ADD COLUMN IF NOT EXISTS "replacementModelId" TEXT;
ALTER TABLE "ProviderModel" ADD COLUMN IF NOT EXISTS "deprecationDate" TIMESTAMP(3);
ALTER TABLE "ProviderModel" ADD COLUMN IF NOT EXISTS "releaseDate" TIMESTAMP(3);
ALTER TABLE "ProviderModel" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "ProviderModel" ADD COLUMN IF NOT EXISTS "euAvailable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "ProviderModel_replacementModelId_idx" ON "ProviderModel"("replacementModelId");

DO $$ BEGIN
  ALTER TABLE "ProviderModel" ADD CONSTRAINT "ProviderModel_replacementModelId_fkey"
    FOREIGN KEY ("replacementModelId") REFERENCES "ProviderModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable ModelPricingRecord (Cost Calculator V2)
ALTER TABLE "ModelPricingRecord" ADD COLUMN IF NOT EXISTS "cacheWritePricePerMillionTokens" DECIMAL(14,6);
ALTER TABLE "ModelPricingRecord" ADD COLUMN IF NOT EXISTS "longContextPricePerMillionTokens" DECIMAL(14,6);
ALTER TABLE "ModelPricingRecord" ADD COLUMN IF NOT EXISTS "searchToolPricePerRequest" DECIMAL(14,6);
ALTER TABLE "ModelPricingRecord" ADD COLUMN IF NOT EXISTS "retryCostMultiplier" DECIMAL(6,4) DEFAULT 1;
ALTER TABLE "ModelPricingRecord" ADD COLUMN IF NOT EXISTS "promotionEndDate" TIMESTAMP(3);

-- AlterEnum AuditCategory
ALTER TYPE "AuditCategory" ADD VALUE IF NOT EXISTS 'COMPLIANCE';

CREATE TABLE IF NOT EXISTS "ModelComplianceProfile" (
    "id" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "transparencyRequired" BOOLEAN NOT NULL DEFAULT false,
    "aiGeneratedLabelRequired" BOOLEAN NOT NULL DEFAULT true,
    "deepfakeDisclosureRequired" BOOLEAN NOT NULL DEFAULT false,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelComplianceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ModelComplianceProfile_providerModelId_key" ON "ModelComplianceProfile"("providerModelId");
CREATE INDEX IF NOT EXISTS "ModelComplianceProfile_complianceStatus_idx" ON "ModelComplianceProfile"("complianceStatus");

DO $$ BEGIN
  ALTER TABLE "ModelComplianceProfile" ADD CONSTRAINT "ModelComplianceProfile_providerModelId_fkey"
    FOREIGN KEY ("providerModelId") REFERENCES "ProviderModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
