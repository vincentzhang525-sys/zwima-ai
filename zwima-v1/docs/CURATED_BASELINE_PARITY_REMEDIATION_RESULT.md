# CURATED_BASELINE_PARITY_REMEDIATION_RESULT

**Date:** 2026-07-25  
**Base:** `production-baseline-curated` @ `27f115f`  
**Branch:** `production-baseline-curated-parity`

## Required result block (pending Preview deploy fill-in)

See final section after Preview acceptance.

## Audit — provider-related routes

| Route / area | Production | Curated before | After remediation |
|---|---|---|---|
| `/api/v1/providers` | 200 contract list | **404** | **200** fail-closed blocked |
| `/api/v1/health` | live online markers | blocked map | unchanged blocked |
| `/api/admin/providers` | present | present | preserved |
| `/api/v1/models` | 200 | 200 | preserved |
| `/api/v1/agents/**` | 401 | 401 | preserved |
| `/api/v1/chat` | present | present + gate | preserved |

## Changes (selective)

1. Added `src/app/api/v1/providers/route.ts` — Production-shaped `{ providers: [...] }` contract; Preview/fail-closed returns `status: OFFLINE`, `health.online: false`, message `PROVIDER_LIVE_CALLS_DISABLED` (no fake `online:true`, no outbound HTTP).
2. `ensureCoreGateway` — starts health auto-refresh **only** when Live Provider HTTP allowed.
3. Bridge adapter `health()` — fail-closed returns offline without calling legacy HTTP.
4. Contract tests: `src/lib/__tests__/v1-providers-route.test.ts`
5. Router unit test env gate for health scoring when live allowed.
6. Preview acceptance expects providers `200` + blocked markers.

## Safety

- No migrate / db push / seed
- No env var changes
- No Production deploy/promote
- No secrets printed
- Live Provider still requires `VERCEL_ENV===production` and `LIVE_PROVIDER_CALLS_ENABLED==="true"`
