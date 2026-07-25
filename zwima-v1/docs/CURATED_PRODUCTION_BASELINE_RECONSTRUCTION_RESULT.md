# CURATED_PRODUCTION_BASELINE_RECONSTRUCTION_RESULT

**Date:** 2026-07-25  
**Base commit:** `0157570f27106c394537da95faeff0999a18f17f`  
**Branch:** `production-baseline-curated`  
**Production deployment (untouched):** `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v`  
**Production meta SHA (untouched):** `9ca804c7844a3b14a0401f9f2defc86de65dee6e`

## Executive status

Isolated curated candidate reconstructed from remediation Preview tip + traced Agents/M4 FX sources. Local verification passed. Preview deployment and acceptance follow in Phase 5 (this document updated after Preview).

## Required output fields

```
CURATED_PRODUCTION_BASELINE_RECONSTRUCTION_RESULT
ROUTE_INVENTORY_NORMALIZED = YES
PRODUCTION_CAPABILITIES_IDENTIFIED = 729 unique app paths (from 1458 extracted incl. .rsc)
FRAMEWORK_GENERATED_OUTPUTS_IDENTIFIED = 729 markers (.rsc / _)
CAPABILITIES_VERIFIED = 18 (see gap matrix)
CAPABILITIES_INFERRED = 6
CAPABILITIES_UNKNOWN = 2
AGENTS_API_RECONSTRUCTED = YES
CORE_API_RECONSTRUCTED = YES (kept from remediation)
HEALTH_RECONSTRUCTED = YES (kept read-only fail-closed)
PACKAGES_RECONSTRUCTED = YES (kept Preview-safe)
AUTH_ROUTES_RECONSTRUCTED = YES (kept incl. forgot-password)
BILLING_RECONSTRUCTED = YES (kept + Stripe Preview guard)
PROVIDER_GATE_IMPLEMENTED = YES
M4_FX_INCLUDED = YES (admin read APIs + UI; no FX migration)
AUTO_MIGRATION_ABSENT = PASS
AUTO_SEED_ABSENT = PASS
HEALTH_READONLY = PASS
LIVE_PROVIDER_FAIL_CLOSED = PASS
PREVIEW_STRIPE_BLOCKED = PASS
PRISMA_GENERATE = PASS
TYPECHECK = PASS
TESTS = PASS (164)
BUILD = PASS
SECRET_SCAN = PASS
SELECTIVE_COMMIT_CREATED = PENDING
PREVIEW_BRANCH = production-baseline-curated
VERCEL_PREVIEW_CREATED = PENDING
PREVIEW_ACCEPTANCE = PENDING
PRODUCTION_CHANGED = NO
PRODUCTION_DEPLOYED = NO
PRODUCTION_ALIAS_CHANGED = NO
DATABASE_CHANGED = NO
LIVE_PROVIDER_CALL_EXECUTED = NO
PAYMENT_CREATED = NO
SAFE_REPRODUCIBLE_BASELINE_AVAILABLE = PENDING_PREVIEW
READY_FOR_PRODUCTION_PROMOTION_READONLY_REVIEW = NO
FINAL_RESULT = PARTIAL
```

## What was included

- Agents platform (M8 mock-provider): `src/lib/agents`, `src/app/api/v1/agents/**`, admin agent APIs, dashboard agents UI, minimal overview stub
- Compliance libs required by agents
- M4 FX: `src/lib/fx`, FX admin cost-optimization GET APIs, `dashboard/admin/fx-cost-control`
- Agents seed POST: blocked on Preview/Development; requires `AGENT_SEED_AUTHORIZED=true`
- Inventory + gap matrix docs + safety scan scripts

## What was excluded

- Full dirty workspace
- M9 workflows, M10 enterprise dashboard, M11 infrastructure consoles
- Secrets, env files, caches, build artifacts, backups
- Auto migrate / auto seed / live provider default-open behavior

## Safety gates verified locally

1. Live provider HTTP only when `VERCEL_ENV === "production"` **and** `LIVE_PROVIDER_CALLS_ENABLED === "true"`
2. Stripe Preview guard present on checkout paths
3. `vercel-build` executes only `prisma generate` (+ optional typecheck) + `next build`
4. `/api/v1/health` GET has no Prisma write calls; Preview returns `"blocked"`
5. No Production promote / alias / DB mutation performed by this task

## References

- `docs/PRODUCTION_ROUTE_CAPABILITY_INVENTORY.md`
- `docs/PRODUCTION_CAPABILITY_GAP_MATRIX.md`
- `docs/CURATED_BASELINE_ROUTE_INVENTORY.md`
- Prior: `docs/VERCEL_PRODUCTION_ARTIFACT_RECOVERY_RESULT.md` (parent workspace)
