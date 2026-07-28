-- GAP-011: Closed Beta legal consent ledger + account deletion request (additive)
-- Preview DB only via PREVIEW_DB_MIGRATE_AUTHORIZED. Does not touch Production.

CREATE TABLE IF NOT EXISTS "LegalConsentAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bundleVersion" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "dpaVersion" TEXT NOT NULL,
  "providerDisclosureVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "source" TEXT NOT NULL DEFAULT 'dashboard',
  CONSTRAINT "LegalConsentAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalConsentAcceptance_userId_bundleVersion_key"
  ON "LegalConsentAcceptance"("userId", "bundleVersion");

CREATE INDEX IF NOT EXISTS "LegalConsentAcceptance_userId_acceptedAt_idx"
  ON "LegalConsentAcceptance"("userId", "acceptedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LegalConsentAcceptance_userId_fkey'
  ) THEN
    ALTER TABLE "LegalConsentAcceptance"
      ADD CONSTRAINT "LegalConsentAcceptance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_MANUAL_REVIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_userId_createdAt_idx"
  ON "AccountDeletionRequest"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_status_createdAt_idx"
  ON "AccountDeletionRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountDeletionRequest_userId_fkey'
  ) THEN
    ALTER TABLE "AccountDeletionRequest"
      ADD CONSTRAINT "AccountDeletionRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
