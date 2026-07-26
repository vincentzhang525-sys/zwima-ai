# CURATED_BASELINE_PARITY_REMEDIATION_RESULT

**Date:** 2026-07-25  
**Base:** `production-baseline-curated` @ `27f115f`  
**Branch:** `production-baseline-curated-parity`  
**Commit:** `2df297493ff818e0cf9b5c55df074762bb5a87a2`  
**Preview:** https://zwima-9voh59joa-zwima.vercel.app  
**Alias:** https://zwima-ai-git-production-baseline-curated-parity-zwima.vercel.app  
**Deployment:** `dpl_8KpcUr8fXXeFGsJB7HWSrQXMiG16` (`target=preview`)

```
CURATED_BASELINE_PARITY_REMEDIATION_RESULT
PREVIEW_BRANCH = production-baseline-curated-parity
PREVIEW_COMMIT_SHA = 2df297493ff818e0cf9b5c55df074762bb5a87a2
PREVIEW_DEPLOYMENT_ID = dpl_8KpcUr8fXXeFGsJB7HWSrQXMiG16
PROVIDERS_ROUTE_PRESENT = YES
PROVIDERS_ROUTE_STATUS = 200
PROVIDERS_CONTRACT_COMPATIBLE = YES
HEALTH_READONLY = PASS
LIVE_PROVIDER_FAIL_CLOSED = PASS
PROVIDER_HTTP_CALL_EXECUTED = NO
AGENTS_ROUTES_PRESERVED = YES
ADMIN_PROVIDER_ROUTES_PRESERVED = YES
MODELS_ROUTES_PRESERVED = YES
AUTO_MIGRATION_PRESENT = NO
AUTO_SEED_PRESENT = NO
DATABASE_CHANGED = NO
PRODUCTION_CHANGED = NO
UNRELATED_FILES_INCLUDED = NO
PRISMA_GENERATE = PASS
TYPECHECK = PASS
TESTS = PASS (166)
BUILD = PASS
SECRET_SCAN = PASS
PREVIEW_ACCEPTANCE = PASS (16/16)
READY_FOR_PROMOTION_READONLY_REVIEW = YES
FINAL_RESULT = PASS
```

## Audit — provider-related routes

| Route / area | Production | Curated before | After remediation |
|---|---|---|---|
| `/api/v1/providers` | 200 contract list | **404** | **200** fail-closed blocked |
| `/api/v1/health` | live online markers | blocked map | unchanged blocked |
| `/api/admin/providers` | present | present | preserved |
| `/api/v1/models` | 200 | 200 | preserved |
| `/api/v1/agents/**` | 401 | 401 | preserved |
| `/api/v1/chat` | present | present + gate | preserved |

## Changes

1. `src/app/api/v1/providers/route.ts` — Production-shaped `{ providers: [...] }`; Preview returns `OFFLINE` / `online:false` / `PROVIDER_LIVE_CALLS_DISABLED` (no fake online, no outbound HTTP).
2. `ensureCoreGateway` — health auto-refresh only when Live Provider allowed.
3. Bridge `health()` — fail-closed offline without legacy HTTP.
4. Contract tests + acceptance update for providers `200`.

## Safety

No migrate/db push/seed; no env changes; no Production promote; no payments; no Live Provider HTTP executed in Preview acceptance.
