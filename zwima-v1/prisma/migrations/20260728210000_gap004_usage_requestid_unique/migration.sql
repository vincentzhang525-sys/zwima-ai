-- GAP-004: idempotent UsageLog.requestId + fail-closed concurrent charges
-- PostgreSQL UNIQUE allows multiple NULLs, so optional requestId stays nullable.

-- Collapse duplicate non-null requestIds (keep oldest row) before unique index.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "requestId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "UsageLog"
  WHERE "requestId" IS NOT NULL
)
DELETE FROM "UsageLog" u
USING ranked r
WHERE u.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS "UsageLog_requestId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "UsageLog_requestId_key" ON "UsageLog"("requestId");
