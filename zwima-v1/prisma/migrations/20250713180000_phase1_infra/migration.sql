-- Phase 1 incremental migration (Production baseline -> Phase 1 schema)
-- Safe: additive ALTER + new tables only. No DROP of existing billing tables.

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED', 'REVOKED', 'COMPROMISED');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ProviderModelStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "PricingStatus" AS ENUM ('DRAFT', 'VERIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('CHAT', 'EMBEDDING', 'IMAGE', 'AUDIO', 'REASONING');

-- CreateEnum
CREATE TYPE "QualityTier" AS ENUM ('ECONOMY', 'STANDARD', 'PREMIUM', 'FLAGSHIP');

-- CreateEnum
CREATE TYPE "SpeedTier" AS ENUM ('FAST', 'BALANCED', 'QUALITY');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RoutingStrategy" AS ENUM ('LOWEST_COST', 'LOWEST_LATENCY', 'HIGHEST_QUALITY', 'BALANCED', 'EU_PREFERRED', 'PROVIDER_PRIORITY', 'MODEL_PINNED', 'BUDGET_MODE', 'PREMIUM_MODE');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

-- CreateEnum
CREATE TYPE "AuditRequestStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'FALLBACK');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('API_KEY_ABUSE', 'RATE_LIMIT_SPIKE', 'BUDGET_SPIKE', 'AUTH_FAILURE_SPIKE', 'CROSS_TENANT_ATTEMPT', 'PROVIDER_FAILURE', 'LOW_MARGIN_ALERT', 'PRICING_EXPIRED', 'UNUSUAL_REGION', 'WEBHOOK_REPLAY');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KeyPermission" ADD VALUE 'MODELS_READ';
ALTER TYPE "KeyPermission" ADD VALUE 'USAGE_READ';
ALTER TYPE "KeyPermission" ADD VALUE 'BILLING_READ';
ALTER TYPE "KeyPermission" ADD VALUE 'ADMIN';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SECURITY_ALERT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditCategory" ADD VALUE 'AI_REQUEST';
ALTER TYPE "AuditCategory" ADD VALUE 'SECURITY';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultRoutingPolicyId" TEXT;

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "allowedModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowedProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currentMonthStart" TIMESTAMP(3),
ADD COLUMN     "currentMonthUsage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyBudget" INTEGER,
ADD COLUMN     "environment" TEXT NOT NULL DEFAULT 'production',
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "monthlyBudget" INTEGER,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedById" TEXT,
ADD COLUMN     "rpmLimit" INTEGER,
ADD COLUMN     "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tpmLimit" INTEGER;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "baseUrl" TEXT,
ADD COLUMN     "dataResidency" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsTools" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsVision" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "Provider" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Provider" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Provider" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill ApiKey status from enabled flag
UPDATE "ApiKey" SET "status" = 'DISABLED' WHERE "enabled" = false;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "stripeEventId" TEXT;

-- AlterTable
ALTER TABLE "UsageLog" ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "ProviderModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelFamily" TEXT,
    "modelType" "ModelType" NOT NULL DEFAULT 'CHAT',
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "qualityTier" "QualityTier" NOT NULL DEFAULT 'STANDARD',
    "speedTier" "SpeedTier" NOT NULL DEFAULT 'BALANCED',
    "status" "ProviderModelStatus" NOT NULL DEFAULT 'DRAFT',
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "supportsTools" BOOLEAN NOT NULL DEFAULT false,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "supportsJson" BOOLEAN NOT NULL DEFAULT false,
    "supportsReasoning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPricingRecord" (
    "id" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "inputPricePerMillionTokens" DECIMAL(14,6) NOT NULL,
    "cachedInputPricePerMillionTokens" DECIMAL(14,6),
    "outputPricePerMillionTokens" DECIMAL(14,6) NOT NULL,
    "requestPrice" DECIMAL(14,6),
    "imagePrice" DECIMAL(14,6),
    "audioPrice" DECIMAL(14,6),
    "batchDiscount" DECIMAL(6,4),
    "providerDiscount" DECIMAL(6,4),
    "internalCostMultiplier" DECIMAL(6,4) NOT NULL DEFAULT 1,
    "platformMarkupPercent" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "minimumCharge" DECIMAL(10,4),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "promotionName" TEXT,
    "promotionActive" BOOLEAN NOT NULL DEFAULT false,
    "pricingStatus" "PricingStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelPricingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderHealth" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latencyP50" INTEGER,
    "latencyP95" INTEGER,
    "successRate" DECIMAL(5,4),
    "errorRate" DECIMAL(5,4),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "strategy" "RoutingStrategy" NOT NULL DEFAULT 'BALANCED',
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "allowedProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredRegion" TEXT,
    "minimumQualityTier" "QualityTier",
    "maximumLatencyMs" INTEGER,
    "maximumCostPerRequest" DECIMAL(12,6),
    "monthlyBudgetLimit" INTEGER,
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingWeightConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "costWeight" DECIMAL(4,3) NOT NULL DEFAULT 0.3,
    "latencyWeight" DECIMAL(4,3) NOT NULL DEFAULT 0.25,
    "qualityWeight" DECIMAL(4,3) NOT NULL DEFAULT 0.2,
    "reliabilityWeight" DECIMAL(4,3) NOT NULL DEFAULT 0.15,
    "regionWeight" DECIMAL(4,3) NOT NULL DEFAULT 0.1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingWeightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "requestId" TEXT NOT NULL,
    "correlationId" TEXT,
    "providerId" TEXT,
    "providerModelId" TEXT,
    "routingPolicyId" TEXT,
    "requestType" TEXT NOT NULL DEFAULT 'chat',
    "capability" TEXT NOT NULL DEFAULT 'chat',
    "promptHash" TEXT,
    "completionHash" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedProviderCost" DECIMAL(14,6),
    "actualProviderCost" DECIMAL(14,6),
    "customerCharge" INTEGER,
    "margin" DECIMAL(14,6),
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "latencyMs" INTEGER,
    "status" "AuditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "fallbackCount" INTEGER NOT NULL DEFAULT 0,
    "attemptedProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "routingReason" TEXT,
    "selectedProvider" TEXT,
    "selectedModel" TEXT,
    "strategy" TEXT,
    "region" TEXT,
    "dataResidency" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'MEDIUM',
    "organizationId" TEXT,
    "apiKeyId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "responseHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderModel_modelCode_idx" ON "ProviderModel"("modelCode");

-- CreateIndex
CREATE INDEX "ProviderModel_status_idx" ON "ProviderModel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderModel_providerId_modelCode_key" ON "ProviderModel"("providerId", "modelCode");

-- CreateIndex
CREATE INDEX "ModelPricingRecord_providerModelId_effectiveFrom_idx" ON "ModelPricingRecord"("providerModelId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ModelPricingRecord_pricingStatus_effectiveFrom_effectiveUnt_idx" ON "ModelPricingRecord"("pricingStatus", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderHealth_providerId_key" ON "ProviderHealth"("providerId");

-- CreateIndex
CREATE INDEX "RoutingPolicy_organizationId_status_idx" ON "RoutingPolicy"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingWeightConfig_name_key" ON "RoutingWeightConfig"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConfig_key_key" ON "PlatformConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AiAuditLog_requestId_key" ON "AiAuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AiAuditLog_organizationId_createdAt_idx" ON "AiAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAuditLog_apiKeyId_createdAt_idx" ON "AiAuditLog"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAuditLog_requestId_idx" ON "AiAuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AiAuditLog_status_createdAt_idx" ON "AiAuditLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiAuditLog_providerId_createdAt_idx" ON "AiAuditLog"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_organizationId_createdAt_idx" ON "SecurityEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_apiKeyId_createdAt_idx" ON "SecurityEvent"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_clientRequestId_apiKeyId_key" ON "IdempotencyRecord"("clientRequestId", "apiKeyId");

-- CreateIndex
CREATE INDEX "ApiKey_status_idx" ON "ApiKey"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeEventId_key" ON "Payment"("stripeEventId");

-- CreateIndex
CREATE INDEX "UsageLog_requestId_idx" ON "UsageLog"("requestId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderModel" ADD CONSTRAINT "ProviderModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPricingRecord" ADD CONSTRAINT "ModelPricingRecord_providerModelId_fkey" FOREIGN KEY ("providerModelId") REFERENCES "ProviderModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderHealth" ADD CONSTRAINT "ProviderHealth_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingPolicy" ADD CONSTRAINT "RoutingPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuditLog" ADD CONSTRAINT "AiAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuditLog" ADD CONSTRAINT "AiAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuditLog" ADD CONSTRAINT "AiAuditLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuditLog" ADD CONSTRAINT "AiAuditLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuditLog" ADD CONSTRAINT "AiAuditLog_providerModelId_fkey" FOREIGN KEY ("providerModelId") REFERENCES "ProviderModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

