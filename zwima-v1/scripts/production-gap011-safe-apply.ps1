# ZWIMA AI — Production GAP-011 single migration safe apply
# Requires DIRECT_URL or DATABASE_URL already set in THIS session (no secrets written to disk).
$ErrorActionPreference = "Stop"

function Require-DbEnv {
  if (-not $env:DIRECT_URL -and -not $env:DATABASE_URL) {
    Write-Output "BLOCKER=NO_DB_ENV_IN_SESSION"
    exit 1
  }
  if ($env:DIRECT_URL) { $env:DATABASE_URL = $env:DIRECT_URL }
  Write-Output "PRODUCTION_CONNECTION_STATUS=OK"
}

function Invoke-PrismaSql {
  param([string]$Sql)
  $Sql | npx prisma db execute --schema prisma/schema.prisma --stdin 2>&1
  if ($LASTEXITCODE -ne 0) { throw "SQL execution failed (exit $LASTEXITCODE)" }
}

Set-Location (Split-Path $PSScriptRoot -Parent)
Require-DbEnv

Write-Output "=== GAP011_PRECHECK ==="

$precheck = @'
SELECT 'TABLE|' || table_name AS row
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('LegalConsentAcceptance', 'AccountDeletionRequest')
UNION ALL
SELECT 'MIGRATION|' || migration_name || '|finished=' || COALESCE(finished_at::text, 'NULL')
FROM "_prisma_migrations"
WHERE migration_name = '20260728220000_gap011_legal_consent';
'@

Invoke-PrismaSql -Sql $precheck

$needsApply = $true
$tableCheck = @'
SELECT COUNT(*) AS cnt FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('LegalConsentAcceptance','AccountDeletionRequest');
'@

# gap011 is additive-only; apply only if either table missing
$gap011Path = "prisma/migrations/20260728220000_gap011_legal_consent/migration.sql"
if (-not (Test-Path $gap011Path)) { throw "Missing migration file: $gap011Path" }

$content = Get-Content $gap011Path -Raw
if ($content -match '(?i)\b(DROP|TRUNCATE|DELETE FROM)\b') {
  throw "GAP011 migration contains destructive statements — aborted"
}
Write-Output "GAP011_ADDITIVE_ONLY=YES"

# Re-check table count via prisma (stdout only)
$before = Invoke-PrismaSql -Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('LegalConsentAcceptance','AccountDeletionRequest') ORDER BY 1;"

if ($before -match 'LegalConsentAcceptance' -and $before -match 'AccountDeletionRequest') {
  Write-Output "GAP011_APPLY_STATUS=SKIPPED_TABLES_ALREADY_EXIST"
} else {
  Write-Output "GAP011_APPLY_STATUS=APPLYING"
  npx prisma db execute --schema prisma/schema.prisma --file $gap011Path 2>&1
  if ($LASTEXITCODE -ne 0) { throw "gap011 migration.sql apply failed" }
  Write-Output "GAP011_APPLY_STATUS=SUCCESS"

  # Single migration resolve only (not batch)
  npx prisma migrate resolve --applied 20260728220000_gap011_legal_consent 2>&1
  if ($LASTEXITCODE -ne 0) { throw "migrate resolve gap011 failed" }
}

Write-Output "=== POST_APPLY_VERIFY ==="
# Use pg_class relname (preserves quoted PascalCase) — unquoted regclass folds to lowercase and triggers P1014.
Invoke-PrismaSql -Sql @'
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('LegalConsentAcceptance', 'AccountDeletionRequest')
ORDER BY 1;
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('LegalConsentAcceptance', 'AccountDeletionRequest')
ORDER BY tablename, indexname;
SELECT c.conname, t.relname AS tablename
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname IN ('LegalConsentAcceptance', 'AccountDeletionRequest')
ORDER BY t.relname, c.conname;
'@

Write-Output "=== PRISMA_MIGRATE_STATUS ==="
npx prisma migrate status 2>&1

Write-Output "=== HTTP_CHECKS ==="
curl.exe -s -o NUL -w "LOGIN_HTTP=%{http_code}`n" https://zwima-group.info/login
curl.exe -s -o NUL -w "DASHBOARD_HTTP=%{http_code}`n" https://zwima-group.info/dashboard
curl.exe -s -o NUL -w "HEALTH_HTTP=%{http_code}`n" https://zwima-group.info/api/health

Write-Output "FINAL_RESULT=COMPLETE"
