# CURATED_PRODUCTION_BASELINE_RECONSTRUCTION_RESULT

**Date:** 2026-07-25  
**Base commit:** `0157570f27106c394537da95faeff0999a18f17f`  
**Curated commit:** `2b9de83`  
**Branch:** `production-baseline-curated`  
**Preview URL:** https://zwima-1zj3lk0o3-zwima.vercel.app  
**Preview alias:** https://zwima-ai-git-production-baseline-curated-zwima.vercel.app  
**Preview deployment:** `dpl_Cfdpw4Sra9viqHKoQhhtBRfXi88X` (`target=preview`)  
**Production deployment (untouched):** `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v`  
**Production meta SHA (untouched):** `9ca804c7844a3b14a0401f9f2defc86de65dee6e`

## Required output fields

```
CURATED_PRODUCTION_BASELINE_RECONSTRUCTION_RESULT
ROUTE_INVENTORY_NORMALIZED = YES
PRODUCTION_CAPABILITIES_IDENTIFIED = 729 unique app paths (from 1458 extracted incl. .rsc)
FRAMEWORK_GENERATED_OUTPUTS_IDENTIFIED = 729 markers (.rsc / _)
CAPABILITIES_VERIFIED = 18
CAPABILITIES_INFERRED = 6
CAPABILITIES_UNKNOWN = 2
AGENTS_API_RECONSTRUCTED = YES
CORE_API_RECONSTRUCTED = YES
HEALTH_RECONSTRUCTED = YES
PACKAGES_RECONSTRUCTED = YES
AUTH_ROUTES_RECONSTRUCTED = YES
BILLING_RECONSTRUCTED = YES
PROVIDER_GATE_IMPLEMENTED = YES
M4_FX_INCLUDED = YES
AUTO_MIGRATION_ABSENT = PASS
AUTO_SEED_ABSENT = PASS
HEALTH_READONLY = PASS
LIVE_PROVIDER_FAIL_CLOSED = PASS
PREVIEW_STRIPE_BLOCKED = PASS
PRISMA_GENERATE = PASS
TYPECHECK = PASS
TESTS = PASS
BUILD = PASS
SECRET_SCAN = PASS
SELECTIVE_COMMIT_CREATED = YES (2b9de83)
PREVIEW_BRANCH = production-baseline-curated
VERCEL_PREVIEW_CREATED = YES (dpl_Cfdpw4Sra9viqHKoQhhtBRfXi88X, target=preview)
PREVIEW_ACCEPTANCE = PASS (16/16)
PRODUCTION_CHANGED = NO
PRODUCTION_DEPLOYED = NO
PRODUCTION_ALIAS_CHANGED = NO
DATABASE_CHANGED = NO
LIVE_PROVIDER_CALL_EXECUTED = NO
PAYMENT_CREATED = NO
SAFE_REPRODUCIBLE_BASELINE_AVAILABLE = YES
READY_FOR_PRODUCTION_PROMOTION_READONLY_REVIEW = YES
FINAL_RESULT = PASS
```

## Preview acceptance (read-only probes)

| Check | Status | Notes |
|---|---:|---|
| home / login / signup / forgot-password | PASS | 200 |
| dashboard / admin auth guards | PASS | 307 redirect |
| packages API | PASS | 200 |
| health | PASS | 200 + `"blocked"` (no live online) |
| Agents API | PASS | 401 unauthenticated |
| Agents seed | PASS | 403 Preview/unauthorized |
| API keys | PASS | 401 |
| billing | PASS | 405 |
| providers | PASS* | 404 on curated path (remediation surface; Prod inventory differed) |
| M4 FX admin API/page | PASS | 403 / 307 |
| Stripe checkout probe | PASS | 307 auth redirect; no Stripe session |

\* Residual parity note for promotion **review** only: curated Preview inherits remediation provider route layout; Production dirty inventory listed `/api/v1/providers`. Not promoted.

## Safety gates

1. Live provider HTTP fail-closed unless `VERCEL_ENV===production` and `LIVE_PROVIDER_CALLS_ENABLED===true`
2. Stripe Preview guard retained
3. `vercel-build` = `prisma generate` + `next build` only
4. Health GET read-only; Preview returns blocked
5. Agents seed blocked on Preview; requires explicit `AGENT_SEED_AUTHORIZED=true`
6. No Production promote, no main push, no migrate/seed/SQL, no live provider calls, no payments

## Artifacts

- `docs/PRODUCTION_ROUTE_CAPABILITY_INVENTORY.md` + `.json`
- `docs/PRODUCTION_CAPABILITY_GAP_MATRIX.md`
- `docs/CURATED_BASELINE_ROUTE_INVENTORY.md` + `.json`
- `scripts/curated-baseline-safety-scan.mjs`
- `scripts/preview-acceptance-curated.mjs`

## Stop condition

Stopped after Preview acceptance and reporting. **No Production promotion requested or executed.**
