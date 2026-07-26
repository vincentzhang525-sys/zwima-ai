# CURATED_PARITY_PRODUCTION_PROMOTION_READONLY_REVIEW_RESULT

**Authorization:** AUTHORIZE CURATED BASELINE PARITY PRODUCTION PROMOTION READONLY REVIEW  
**Date:** 2026-07-25  
**Mode:** read-only (no push main, merge, promote, deploy Production, DB mutation, env mutation, Live Provider call, payment, or secret printing)

---

## Required result block

```
CURATED_PARITY_PRODUCTION_PROMOTION_READONLY_REVIEW_RESULT
PREVIEW_BRANCH = production-baseline-curated-parity
PREVIEW_COMMIT_SHA = 2df297493ff818e0cf9b5c55df074762bb5a87a2
PREVIEW_DEPLOYMENT_ID = dpl_8KpcUr8fXXeFGsJB7HWSrQXMiG16
PREVIEW_ACCEPTANCE = PASS (16/16)
PRODUCTION_DEPLOYMENT_ID = dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v
PRODUCTION_META_SHA = 9ca804c7844a3b14a0401f9f2defc86de65dee6e
ROLLBACK_TARGET = dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v (zwima-group.info)
ORIGIN_MAIN = 6f4eb66409d3331121b3d7ed874eb1ae23ca6c94
PROMOTION_METHOD_RECOMMENDED = VERCEL_PROMOTE_PREVIEW_DEPLOYMENT_NOT_MAIN
AUTO_MIGRATION_PRESENT = NO
AUTO_SEED_PRESENT = NO
HEALTH_READONLY = PASS
LIVE_PROVIDER_FAIL_CLOSED = PASS (code)
PROVIDERS_ROUTE_PARITY_STATUS = PASS (200/200)
PROVIDERS_BEHAVIORAL_DELTA = FAIL_CLOSED_VS_LIVE_OPEN
STRIPE_PRODUCTION_UNCHANGED = YES
CLERK_PRODUCTION_UNCHANGED = YES
RESEND_PRODUCTION_UNCHANGED = YES
PRODUCTION_DB_COMPATIBLE = YES
SECRET_SCAN = PASS
SAFE_TO_PROMOTE = NO
PROMOTION_RISK_LEVEL = MEDIUM
PRODUCTION_CHANGED = NO
DATABASE_CHANGED = NO
DEPLOYMENT_EXECUTED = NO
LIVE_PROVIDER_CALL_EXECUTED = NO
READY_FOR_EXPLICIT_PRODUCTION_PROMOTION_AUTHORIZATION = YES
FINAL_RESULT = BLOCKED
```

---

## 1. Preview vs Production identity

| Field | Preview (candidate) | Production (current) |
|---|---|---|
| Branch | `production-baseline-curated-parity` | CLI dirty overlay (not a clean git branch) |
| Commit / meta | `2df297493ff818e0cf9b5c55df074762bb5a87a2` | meta `9ca804c…` + `gitDirty=1` |
| Deployment | `dpl_8KpcUr8fXXeFGsJB7HWSrQXMiG16` | `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v` |
| URL | https://zwima-9voh59joa-zwima.vercel.app | https://zwima-qkqrq94mi-zwima.vercel.app |
| Alias | git-production-baseline-curated-parity | `zwima-group.info` |
| Target | `preview` | `production` |
| Lambda scale | ~252 outputs shown | ~1457 outputs |
| `origin/main` | N/A (do **not** use) | still `6f4eb66…` — **lacks** current `zwima-v1` app tree |

`9ca804c` is an ancestor of Preview tip `2df2974` (secure baseline lineage: `530be5c` → remediation → curated → parity).

---

## 2. Route / behavior comparison (read-only probes)

| Path | Preview | Production | Verdict |
|---|---:|---:|---|
| `/` `/login` `/signup` `/forgot-password` | 200 | 200 | OK |
| `/dashboard` `/dashboard/admin` `/dashboard/admin/fx-cost-control` | 307 | 307 | OK auth guards |
| `/api/v1/packages` | 200 | 200 | OK |
| `/api/v1/health` | 200 + blocked | 200 + `online:true` | **Intentional gate delta** |
| `/api/v1/providers` | 200 + blocked / no `online:true` | 200 + `online:true` | **Status parity fixed**; health semantics gated |
| `/api/v1/models` | 200 | 200 | OK |
| `/api/v1/agents` | 401 | 401 | OK |
| `/api/v1/api-keys` | 401 | 401 | OK |
| `/api/v1/billing` `/api/v1/chat` | 405 | 405 | OK |
| `/api/admin/providers` | 307 | 307 | OK |
| `/api/v1/admin/cost-optimization/fx-policies` | 403 | 404 | Curated **adds** M4 FX API |
| `POST /api/billing/checkout` | 307 (no Stripe session) | 307 | OK; no payment created |

**Prior hard blocker cleared:** `/api/v1/providers` is no longer 404 on Preview.

---

## 3. Prisma / database compatibility

| Check | Result |
|---|---|
| Agent* / Fx* / UsageLog models in candidate schema | Present |
| Agents already live on Production runtime | Yes (401 unauth) |
| M4 FX schema previously assessed present on Prod DB | Compatible; **do not** re-migrate |
| `vercel-build` migrate/db push/seed | Absent |
| This review ran SQL / migrate / seed | **NO** |

**PRODUCTION_DB_COMPATIBLE = YES** (no migration required for promote of this candidate).

---

## 4. Safety confirmations (this review)

| Item | Result |
|---|---|
| Migration executed | NO |
| Seed executed | NO |
| Database mutation executed | NO |
| Stripe payment created | NO |
| Live Provider HTTP executed by review | NO |
| Secret values printed | NO |
| Local secret/safety scan | PASS |
| Auto migration in build | NO |
| Auto seed in build | NO |
| Health DB writes | NO |
| Live Provider gate code | YES (`VERCEL_ENV===production` **and** `LIVE_PROVIDER_CALLS_ENABLED==="true"`) |

---

## 5. Production environment requirements (no values printed)

| Config | Assessment |
|---|---|
| `LIVE_PROVIDER_CALLS_ENABLED` | Code fail-closed. **Production key presence/value UNKNOWN** (env list not available in this worktree link). Current Prod health/`providers` behave **live-open**. Promoting without exact `true` will **close** live provider HTTP. |
| Stripe Production | **Unchanged** by this review; no env writes |
| Clerk Production | **Unchanged** |
| Resend Production | **Unchanged** |

**Promotion precondition:** Explicit decision on Production Live Provider policy **before** alias cutover (set flag to exact `true` if live calls must continue, or accept fail-closed).

---

## 6. Rollback target

| Field | Value |
|---|---|
| Rollback deployment | `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v` |
| Rollback aliases | `https://zwima-group.info`, `https://zwima-ai.vercel.app`, … |
| Meta SHA | `9ca804c7844a3b14a0401f9f2defc86de65dee6e` (dirty CLI source; non-reproducible) |

---

## 7. Precise file-level deployment diff

### A. vs remediation tip `0157570` (curated + parity delta) — **86 paths**

Additive curated/parity surface (grouped):

- **Docs/scripts (10):** inventory, gap matrix, reconstruction/parity results, safety scan, acceptance, route inventory writer  
- **Agents APIs (14):** `api/v1/agents/**`, `api/admin/agents*`  
- **Agents UI/libs (agents + compliance ~40):** `dashboard/agents/**`, `components/agents/**`, `lib/agents/**`, `lib/compliance/**`  
- **M4 FX (15):** `lib/fx/**`, FX admin APIs, `dashboard/admin/fx-cost-control`, FX client  
- **Providers parity (5):** `api/v1/providers/route.ts`, bridge/gateway fail-closed tweaks, providers contract test, router test env fix  

Full path list is exactly `git diff --name-only 0157570..2df2974` (86 files; +9867/−11 lines).

### B. Full promote stack vs Production meta `9ca804c`

Also includes secure baseline + remediation commits (`530be5c`, `4a0be37`, `0157570`) already ancestors of tip: Live Provider gate, safe `vercel-build`, health read-only Preview path, forgot-password public route, packages Preview-safe behavior, etc.

### C. Not included (intentional exclusions)

M9 workflows, M10 enterprise dashboard, M11 infra consoles, and other dirty-overlay sprawl present in Production’s ~1457 Lambdas but absent from curated Preview (~252). Promotion is a **capability shrink + harden**, not bit-identical dirty replay.

### D. Unrelated dirty workspace files

**Not included** in the Preview branch tip. Local dirty worktree outside this branch remains untouched for promotion content.

---

## 8. Risk assessment

### Cleared since prior BLOCKED review
- `/api/v1/providers` **404 → 200** with Production-shaped contract  
- Preview acceptance **16/16** on `dpl_8Kpc…`  
- Fail-closed Live Provider on Preview verified (providers + health)

### Remaining blockers / preconditions for SAFE_TO_PROMOTE=YES
1. **MEDIUM** — Production Live Provider policy unresolved (`LIVE_PROVIDER_CALLS_ENABLED` unknown; current Prod is live-open).  
2. **MEDIUM** — Intentional loss of unrebuilt dirty-overlay surfaces (M9–M11 / extra admin).  
3. **HIGH (process)** — Must **not** push/merge `origin/main` (`6f4eb66`). Use Vercel promote of `dpl_8KpcUr8fXXeFGsJB7HWSrQXMiG16` only.

### Verdict
- **SAFE_TO_PROMOTE = NO** until separate explicit authorization includes Live Provider Production policy + acceptance of capability shrink.  
- **READY_FOR_EXPLICIT_PRODUCTION_PROMOTION_AUTHORIZATION = YES** — candidate is reproducible, Preview-validated, and review-complete.  
- **PROMOTION_RISK_LEVEL = MEDIUM** (down from HIGH after providers parity fix).  
- **FINAL_RESULT = BLOCKED** (no Production change authorized by this review).

### Recommended next authorization (separate)
Authorize Vercel Production promote of Preview deployment `dpl_8KpcUr8fXXeFGsJB7HWSrQXMiG16` **only after**:
1. Confirm/set Production `LIVE_PROVIDER_CALLS_ENABLED` policy (exact `true` to keep live calls, or accept fail-closed),  
2. Accept capability shrink vs dirty overlay,  
3. Confirm rollback to `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v`,  
4. Explicitly forbid `main` push/merge.

---

## 9. Stop condition

```
PRODUCTION_CHANGED = NO
DATABASE_CHANGED = NO
DEPLOYMENT_EXECUTED = NO
LIVE_PROVIDER_CALL_EXECUTED = NO
SAFE_TO_PROMOTE = NO
READY_FOR_EXPLICIT_PRODUCTION_PROMOTION_AUTHORIZATION = YES
FINAL_RESULT = BLOCKED
```

Await **separate explicit Production promotion authorization**.
