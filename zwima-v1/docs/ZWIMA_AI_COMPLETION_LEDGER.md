# ZWIMA AI — Completion Ledger

**LEDGER_CREATED:** 2026-07-28  
**BRANCH:** `v1-p0-commercial-loop`  
**HEAD:** `f2d6118`  
**PURPOSE:** Historical Completion Check — prevent duplicate implementation, real spend, and secret reconfiguration.

**Rule:** Before any development / audit / acceptance task, read this ledger. If a matching PASS item exists and no retest trigger is true → output `ALREADY_COMPLETED` only. Do not modify code, create resources, reconfigure keys, re-pay, or re-run live Provider/Stripe charges.

---

## Locked PASS items

### CLERK-ORG-001
| Field | Value |
|--------|--------|
| ID | CLERK-ORG-001 |
| 模块 | M7 Auth / Clerk Organizations |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 (Phase 2B / prior E2E) |
| Git commit | `a728f19` (M8 Phase 2B finalize); invite fixes `90d7a9e`, `297d79e` |
| Deployment ID/URL | Preview E2E on M8 Phase 2B Preview deployments (team invite smoke) |
| Database migration | N/A (Clerk console + app membership tables already present) |
| Test result | Dual-user org E2E PASS; Team Invite 12/12 unit tests PASS |
| Evidence | Chat/audit: Clerk Organizations enabled; Primary/Secondary users; Owner=Admin, Member A=Member |
| Retest trigger | `related_code_changed` on team/org auth; `environment_changed` Clerk instance; `production_incident` |
| DO_NOT_REPEAT | Recreate Clerk orgs; re-provision dual users; re-enable Organizations in Dashboard |

### CLERK-USERS-001
| Field | Value |
|--------|--------|
| ID | CLERK-USERS-001 |
| 模块 | M7 / E2E identities |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `a728f19` |
| Deployment ID/URL | Preview (Clerk Development) dual-user E2E |
| Database migration | N/A |
| Test result | ZWIMA M8 E2E Primary / Secondary created; login → `/dashboard` PASS |
| Evidence | Phase 2B E2E; Owner=Admin, Member A=Member |
| Retest trigger | `provider_project_changed` (new Clerk app); `prior_evidence_missing` |
| DO_NOT_REPEAT | Create new Clerk users/orgs for the same E2E roles; re-run paid flows to “prove” users |

### M8-INVITE-001
| Field | Value |
|--------|--------|
| ID | M8-INVITE-001 |
| 模块 | M8 Team Invite |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `90d7a9e`, `297d79e`, finalize `a728f19` |
| Deployment ID/URL | Preview smoke after invite fix |
| Database migration | Phase 2A/2B Preview migrations already applied |
| Test result | `team-invite` **12/12 PASS**; invite/auth/isolation smoke PASS |
| Evidence | Membership-first org resolution; idempotent `alreadyMember=true` |
| Retest trigger | `related_code_changed` on `src/lib/team/invite.ts` / team API |
| DO_NOT_REPEAT | Re-fix invite 500; recreate invite test matrix without code change |

### M8-PHASE2B-001
| Field | Value |
|--------|--------|
| ID | M8-PHASE2B-001 |
| 模块 | M8 Agent Platform Phase 2B |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `a728f19` |
| Deployment ID/URL | Preview READY (Phase 2B acceptance series) |
| Database migration | Preview: Phase1 / Phase2A / M4 FX applied via authorized Preview migrate |
| Test result | `M8_PHASE2B_STATUS=COMPLETE`; `BLOCKERS=NONE` |
| Evidence | Memory isolation Preview mock; WORKSPACE deferred by design |
| Retest trigger | `related_code_changed` on M8 Phase 2B surfaces; new named phase authorization |
| DO_NOT_REPEAT | Re-run Phase 2B from scratch; start Phase 2C without explicit auth; expand Workspace Memory |

### PREVIEW-DB-MIG-001
| Field | Value |
|--------|--------|
| ID | PREVIEW-DB-MIG-001 |
| 模块 | Infrastructure / Prisma Preview |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `e528838`, `9a5c61c`, Phase 2A/2B migrations |
| Deployment ID/URL | Preview Git Integration builds with `PREVIEW_DB_MIGRATE_AUTHORIZED` |
| Database migration | `20260726120000_m8_agent_platform_phase1`; `20260726180000_m8_agent_platform_phase2a`; `20260728170000_m4_fx_usage_log_additive` (+ later GAP-004 unique) |
| Test result | Preview migrate exit 0; host `aws-0-eu-west-1.pooler.supabase.com`; Production DB untouched |
| Evidence | Preview diag env-db; migrate logs `LOOKS_PROD_HOST=NO` |
| Retest trigger | `schema_changed`; `environment_changed` Preview DB |
| DO_NOT_REPEAT | Re-apply same migrations; migrate Production without explicit authorize; confuse Preview/Prod DB |

### GAP-003
| Field | Value |
|--------|--------|
| ID | GAP-003 |
| 模块 | M7 Clerk Production/Preview isolation |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `28bedb6` |
| Deployment ID/URL | Preview `https://zwima-ojfy9jb4h-zwima.vercel.app` (`dpl_3qy1BJ6w4hzhMVvwNRsRfBXTJgks`) |
| Database migration | NONE |
| Test result | clerk-instance-gate 9/9; Preview diag `clerkInstanceType=development` isolated; Production login serves `pk_live_` |
| Evidence | `src/lib/auth/clerk-instance-gate.ts`; vercel env ls Production `pk_live_`; Preview `pk_test_` |
| Retest trigger | `environment_changed` Clerk keys/instance; `related_code_changed` auth gate |
| DO_NOT_REPEAT | Recreate Clerk Production instance; dump secrets; use Dev keys on Production |

### GAP-004
| Field | Value |
|--------|--------|
| ID | GAP-004 |
| 模块 | M3/M4 Credits atomic debit + usage idempotency |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `0ca9366` |
| Deployment ID/URL | Preview `https://zwima-8jmddcltp-zwima.vercel.app` |
| Database migration | `20260728210000_gap004_usage_requestid_unique` applied on **Preview only** |
| Test result | atomic-debit + v1-chat-usage persistence tests PASS |
| Evidence | Conditional SQL debit; `UsageLog.requestId` unique; fail-closed insufficient credits |
| Retest trigger | `related_code_changed` on `credits-engine` / `atomic-debit`; `schema_changed` UsageLog |
| DO_NOT_REPEAT | Re-prove concurrency without code change; Production migrate without authorize |

### GAP-001
| Field | Value |
|--------|--------|
| ID | GAP-001 |
| 模块 | M1 Live OpenAI Production smoke |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `9cea898`, `d415a1d` |
| Deployment ID/URL | Production `https://zwima-group.info` (live call against then-current Production) |
| Database migration | N/A for smoke |
| Test result | `POST /api/v1/chat` → `provider=openai`, `model=gpt-5-mini`, UsageLog + `costCredits=1` |
| Evidence | Closed Beta allowlist/budget; Preview remains `PROVIDER_LIVE_CALLS_DISABLED` |
| Retest trigger | `related_code_changed` live gate/chat billing; `production_incident`; `provider_project_changed` |
| DO_NOT_REPEAT | Additional real Provider calls “to re-prove”; expand to multi-provider live tests (P1) |

### STRIPE-LIVE-CFG-001
| Field | Value |
|--------|--------|
| ID | STRIPE-LIVE-CFG-001 |
| 模块 | M3 Stripe Live configuration |
| 完成状态 | PASS |
| 完成日期 | Historical (Phase 7+) / confirmed 2026-07-28 |
| Git commit | N/A (console config) |
| Deployment ID/URL | Production env (Vercel) |
| Database migration | N/A |
| Test result | Runtime diag: `secretKind=live`, `publishableKind=live`; webhook secret present |
| Evidence | User-confirmed Live account, Live keys, Webhook secret, Price ID exist |
| Retest trigger | `environment_changed` Stripe project/keys; `production_incident` |
| DO_NOT_REPEAT | Recreate Stripe account; overwrite Production Stripe keys; demand Test Mode reconfiguration |

### GAP-002
| Field | Value |
|--------|--------|
| ID | GAP-002 |
| 模块 | M3 Billing loop / Stripe ledger |
| 完成状态 | **PASS_BY_HISTORICAL_LIVE_EVIDENCE** |
| 完成日期 | 2026-07-28 (read-only verify); payment itself earlier |
| Git commit | `2de928e` (read-only acceptance); cleanup `f2d6118` |
| Deployment ID/URL | Production promote `https://zwima-enuxcnz0v-zwima.vercel.app` → `zwima-group.info` |
| Database migration | NONE (read-only) |
| Test result | Read-only: Payment €10 COMPLETED + stripeSessionId/PaymentId/EventId + RECHARGE Transaction + CreditBalance lifetimeRecharge; webhook idempotency schema+code PASS |
| Evidence | Internal `POST /api/internal/gap002-stripe-acceptance` read-only mode; no new charge |
| Retest trigger | `related_code_changed` webhook/billing; `schema_changed` Payment/Transaction; `prior_evidence_missing`; `production_incident` |
| DO_NOT_REPEAT | New real Stripe charges; force Test Mode setup; overwrite Live keys; re-pay €10 |

### P0-LOOP-001
| Field | Value |
|--------|--------|
| ID | P0-LOOP-001 |
| 模块 | V1 Production Commercial Loop (P0 set) |
| 完成状态 | PASS |
| 完成日期 | 2026-07-28 |
| Git commit | `f2d6118` (HEAD of P0 series) |
| Deployment ID/URL | Production alias `https://zwima-group.info` |
| Database migration | Preview-only GAP-004 unique; Production schema migrate not required for P0 PASS |
| Test result | GAP-003→004→001→002 historical/live evidence; `E2E_COMMERCIAL_LOOP_RESULT=PASS`; `P0_FINAL_RESULT=PASS` |
| Evidence | This ledger + chat gate reports |
| Retest trigger | Any GAP-* retest trigger; Closed Beta scope change |
| DO_NOT_REPEAT | Re-run entire P0 sequence without trigger; incur new Provider/Stripe cost |

---

### GAP-011

| Field | Value |
|--------|--------|
| ID | GAP-011 |
| 模块 | M6 Closed Beta Compliance Gate |
| 完成状态 | PASS (LOCKED) |
| 完成日期 | 2026-07-28 |
| Git commit | `bb4846b` (+ ledger `e405d13`) |
| Deployment ID/URL | Preview `https://zwima-k41pkqnlo-zwima.vercel.app` (`dpl_4ikSrkGkVFAsg69sKCsr9TtUPTnD`); alias `https://zwima-ai-git-v1-p0-commercial-loop-zwima.vercel.app` |
| Database migration | `20260728220000_gap011_legal_consent` applied on **Preview only** (`PREVIEW_DB_MIGRATE_AUTHORIZED=true`; build log: All migrations successfully applied) |
| Test result | Unit PASS; typecheck/lint PASS; public E2E 4/4 PASS; **Authenticated Preview E2E PASS** via existing M8 Member A + Clerk `testing_token`/`sign_in_token` (no new Clerk users): fail-closed `403 TERMS_NOT_ACCEPTED` → accept bundle → post-consent API `PROVIDER_LIVE_CALLS_DISABLED` (no live cost) → deletion request `PENDING_MANUAL_REVIEW`; temp auth artifacts deleted |
| Evidence | Legal pages + version badges; dashboard accept-terms gate; API fail-closed; Settings deletion entry/API; `docs/ZWIMA_AI_CLOSED_BETA_DATA_FLOW.md`; this ledger |
| Retest trigger | Legal bundle version bump; counsel replaces draft legal text; Production consent migrate authorized separately |
| DO_NOT_REPEAT | Re-implement consent ledger / re-migrate Preview; create Clerk users; send real email for deletion; Production migrate without auth; re-run authenticated consent E2E without retest trigger |

---

### GAP-012

| Field | Value |
|--------|--------|
| ID | GAP-012 |
| 模块 | M7 Viewer RBAC E2E |
| 完成状态 | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-28 |
| Git commit | `e7bc671` (impl); closeout `chore(gap-012): finalize viewer permission gate` |
| Deployment ID/URL | Preview `https://zwima-jypwtah8x-zwima.vercel.app` |
| Database migration | N/A (no schema change; invite accept-on-login + RBAC gates) |
| OWNER_PERMISSION_E2E | PASS |
| MEMBER_PERMISSION_E2E | PASS |
| VIEWER_READ_PERMISSION_E2E | PASS |
| VIEWER_WRITE_DENIAL_E2E | PASS |
| VIEWER_ADMIN_DENIAL_E2E | PASS |
| CROSS_ORG_ISOLATION_E2E | PASS |
| UNAUTHENTICATED_REDIRECT_E2E | PASS |
| Test result | Unit `gap012-rbac` PASS; Authenticated Preview E2E PASS — Owner admin OK; Member invite-to-Primary denied; Viewer read agents OK; Viewer agent write/admin/API key/billing/settings/invite denied 403; cross-org 403/404; unauth → login; reused Owner/Member A; created one Viewer only because none existed |
| Evidence | `assertCanAccess` / `assertCanManageOrg`; pending invite accept on Clerk link; this ledger |
| Retest trigger | RBAC matrix change; new org roles; Clerk E2E identity reset |
| DO_NOT_REPEAT | Recreate Viewer if present; change Owner/Member roles; re-run full RBAC E2E without trigger |

---

### GAP-016

| Field | Value |
|--------|--------|
| ID | GAP-016 |
| 模块 | M4 FX Billing Hot Path |
| 完成状态 | PASS_LOCKED |
| GAP_016_STATUS | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-28 |
| Git commit | (this closeout commit on `v1-p0-commercial-loop`) |
| Database migration | NONE (reused `20260728170000_m4_fx_usage_log_additive` schema fields) |
| FX_HOT_PATH_CONNECTED | YES — `chargeForUsage` → `buildUsageFxCost` + `PrismaFxRateProvider` before debit |
| FX_FAIL_CLOSED | YES — MISSING/STALE → `FX_RATE_UNAVAILABLE` (503); no invented rates; no debit |
| FX_IDEMPOTENCY | YES — `requestId` replay before FX; unique conflict → no double charge / no re-FX |
| FX_LEDGER_CONSISTENCY | YES — UsageLog FX snapshot + Transaction metadata/`amountEur` + CreditBalance debit aligned |
| FX_TEST_STATUS | PASS — `gap016-fx-billing-hot-path` + `v1-chat-usage-persistence` |
| Test result | Unit PASS; typecheck PASS; eslint on touched files PASS; no real Provider/Stripe/email |
| Evidence | Wire-only into M3 `chargeForUsage`; existing FX engine + UsageLog columns; this ledger |
| Retest trigger | `related_code_changed` on `chargeForUsage` / FX fail-closed policy; billing currency change |
| DO_NOT_REPEAT | Re-wire FX hot path; add migration for existing FX columns; invent default FX rates |

---

## Explicitly frozen bans (global)

| Ban ID | DO_NOT_REPEAT |
|--------|----------------|
| BAN-NO-DUP-CLERK | Create Clerk users/orgs already covered by CLERK-* |
| BAN-NO-DUP-STRIPE-ACCT | Create Stripe accounts / re-copy keys for proof |
| BAN-NO-DUP-OPENAI | Re-wire OpenAI integration already proven by GAP-001 |
| BAN-NO-DUP-MIGRATE | Re-run applied Preview migrations / unauthorized Production migrate |
| BAN-NO-REAL-COST | Real Provider or Stripe spend solely to re-prove PASS items |
| BAN-NO-PHASE-2C | M8 Phase 2C / Workspace Memory expansion without explicit phase auth |
| BAN-NO-MERGE-MAIN | Merge/push `main` without separate explicit authorize |

---

## Still open (not PASS in this ledger)

These remain **incomplete** relative to Closed Beta / Public launch (from audit P1+; do not invent new P0):

| ID | 模块 | 状态 | Notes |
|----|------|------|--------|
| GAP-010 | M5 Deprecation/Migration wiring | OPEN (P1) | Status gate exists; policy engines not fully wired |
| GAP-013 | M11 CI | OPEN (P1) | No `.github/workflows` evidence |
| GAP-014 | M11 Backup/DR | OPEN (P1) | Weak evidence |
| GAP-015 | Multi-provider live retest | OPEN (P1) | P0 only required one provider (done) |
| M9 | Workflow Automation | EXCLUDED / not started | Frozen: do not start without auth |
| M8-2C | Workspace Memory | DEFERRED | Explicitly frozen |
| PUBLIC_PRODUCTION_READY | Launch gate | NO | Platform ~48% at audit; P0 commercial loop closed, P1 remain |
| CLOSED_BETA_READY | Launch gate | CONDITIONAL | P0 loop PASS; P1 still open — product decision |

---

## Duplicate-work detector notes

Tasks that would map to ledger PASS and must return `ALREADY_COMPLETED` unless a retest trigger fires:

- “Enable Clerk Organizations / create E2E users”
- “Fix team invite / re-run Phase 2B”
- “Re-verify Preview migrations / touch Production DB”
- “Re-do GAP-003/004/001/002”
- “Switch Stripe to Test Mode / pay again”
- “Another OpenAI live smoke for proof”
- “Re-build GAP-011 consent / legal pages / Preview consent migration”
- “Re-run GAP-011 authenticated Preview consent E2E / recreate Playwright storageState”
- “Re-provision GAP-012 Viewer / re-run Viewer RBAC E2E without trigger”
- “Re-wire GAP-016 FX into chargeForUsage / invent FX rates / re-add FX migration”

---

## How to run Historical Completion Check

1. Identify proposed task IDs / modules.  
2. Match against Locked PASS items above.  
3. If match and no retest trigger → **stop**; report ALREADY_COMPLETED.  
4. If open item → proceed only within authorized scope.  
5. Every subsequent report must include:

```
HISTORICAL_COMPLETION_CHECK = PASS|FAIL
DUPLICATE_WORK_DETECTED = YES|NO
REUSED_EXISTING_EVIDENCE = YES|NO
NEW_REAL_COST_INCURRED = NO
USER_MANUAL_CONFIGURATION_REQUIRED = NO|YES(<reason>)
```
