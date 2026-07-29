-- V1.1 M5 Model Lifecycle completion (additive)
-- Extends ModelRegistryEntry + ModelMigrationPolicy for DB-driven auto migration

ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "supportedRegions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "supportsImage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "supportsAudio" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "supportsFunctionCalling" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "supportsStructuredOutput" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "documentationUrl" TEXT;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "pricingVersion" TEXT;
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "releaseDate" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "deprecationDate" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "shutdownDate" TIMESTAMP(3);
ALTER TABLE "ModelRegistryEntry" ADD COLUMN IF NOT EXISTS "autoMigration" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ModelRegistryEntry_autoMigration_idx" ON "ModelRegistryEntry"("autoMigration");

CREATE TABLE IF NOT EXISTS "ModelMigrationPolicy" (
    "id" TEXT NOT NULL,
    "fromRegistryId" TEXT NOT NULL,
    "toRegistryId" TEXT NOT NULL,
    "fromVersionId" TEXT,
    "toVersionId" TEXT,
    "autoMigrate" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelMigrationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModelMigrationPolicy_fromRegistryId_enabled_autoMigrate_idx"
  ON "ModelMigrationPolicy"("fromRegistryId", "enabled", "autoMigrate");
CREATE INDEX IF NOT EXISTS "ModelMigrationPolicy_toRegistryId_idx"
  ON "ModelMigrationPolicy"("toRegistryId");
CREATE INDEX IF NOT EXISTS "ModelMigrationPolicy_effectiveFrom_effectiveTo_idx"
  ON "ModelMigrationPolicy"("effectiveFrom", "effectiveTo");

DO $$ BEGIN
  ALTER TABLE "ModelMigrationPolicy"
    ADD CONSTRAINT "ModelMigrationPolicy_fromRegistryId_fkey"
    FOREIGN KEY ("fromRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ModelMigrationPolicy"
    ADD CONSTRAINT "ModelMigrationPolicy_toRegistryId_fkey"
    FOREIGN KEY ("toRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
