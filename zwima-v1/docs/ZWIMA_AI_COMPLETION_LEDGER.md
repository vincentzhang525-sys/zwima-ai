# ZWIMA AI — Completion Ledger

**LEDGER_CREATED:** 2026-07-28  
**BRANCH:** `v1-p0-commercial-loop`  
**HEAD:** `bb5ee61`  
**LAST_CLOSEOUT:** 2026-07-29 — Dashboard Performance Phase 2 PASS_LOCKED  
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
| 完成状态 | PASS (LOCKED) — Preview + **Production physical audit PASS_LOCKED** |
| 完成日期 | 2026-07-28 (Preview); 2026-07-29 (Production physical audit closeout) |
| Git commit | `bb4846b` (+ ledger `e405d13`); Production closeout on `v1-p0-commercial-loop` |
| Deployment ID/URL | Preview `https://zwima-k41pkqnlo-zwima.vercel.app` (`dpl_4ikSrkGkVFAsg69sKCsr9TtUPTnD`); Production `https://zwima-group.info` |
| Database migration | `20260728220000_gap011_legal_consent` applied on **Preview** (`PREVIEW_DB_MIGRATE_AUTHORIZED=true`) and **Production** (`LegalConsentAcceptance` + `AccountDeletionRequest` confirmed via read-only physical audit; `_prisma_migrations` status APPLIED) |
| Test result | Preview: Unit PASS; typecheck/lint PASS; public E2E 4/4 PASS; Authenticated Preview E2E PASS. Production: read-only physical audit PASS (`PHYSICAL_SCHEMA_MATCH=YES`; tables + migration record confirmed; P1014 was verify-script false positive) |
| Evidence | Legal pages + version badges; dashboard accept-terms gate; API fail-closed; Settings deletion entry/API; `docs/ZWIMA_AI_CLOSED_BETA_DATA_FLOW.md`; `docs/ZWIMA_AI_PRODUCTION_MIGRATION_RECONCILIATION_AUDIT.md`; `scripts/gap011-production-readonly-audit.ts` |
| Retest trigger | Legal bundle version bump; counsel replaces draft legal text; Production schema drift detected |
| DO_NOT_REPEAT | Re-implement consent ledger; re-apply gap011 migration on Production; re-migrate Preview; create Clerk users; send real email for deletion; re-run physical audit without drift trigger; re-run authenticated consent E2E without retest trigger |

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
| Git commit | `585d1e0` (impl); ledger lock `3f1df6e` |
| Database migration | NONE (reused `20260728170000_m4_fx_usage_log_additive` schema fields) |
| FX_HOT_PATH_CONNECTED | YES — `chargeForUsage` → `buildUsageFxCost` + `PrismaFxRateProvider` before debit |
| FX_FAIL_CLOSED | YES — MISSING/STALE → `FX_RATE_UNAVAILABLE` (503); no invented rates; no debit |
| FX_IDEMPOTENCY | YES — `requestId` replay before FX; unique conflict → no double charge / no re-FX |
| FX_LEDGER_CONSISTENCY | YES — UsageLog FX snapshot + Transaction metadata/`amountEur` + CreditBalance debit aligned |
| FX_TEST_STATUS | PASS — `gap016-fx-billing-hot-path` + `v1-chat-usage-persistence` |
| Test result | Unit PASS; typecheck PASS; eslint on touched files PASS; no real Provider/Stripe/email |
| Evidence | Wire-only into M3 `chargeForUsage`; existing FX engine + UsageLog columns; this ledger |
| Recovery closeout 2026-07-29 | Historical Completion Check PASS; untracked `scripts/ci/*` classified as GAP-013 draft (not GAP-016) and deleted; formal GAP-016 already on branch; no Production/main/keys/cost |
| Retest trigger | `related_code_changed` on `chargeForUsage` / FX fail-closed policy; billing currency change |
| DO_NOT_REPEAT | Re-wire FX hot path; add migration for existing FX columns; invent default FX rates; start GAP-013 from recovery drafts |

---

### GAP-013

| Field | Value |
|--------|--------|
| ID | GAP-013 |
| 模块 | M11 CI launch gate |
| 完成状态 | PASS_LOCKED |
| GAP_013_STATUS | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-29 |
| Git commit | `503e428` |
| Deployment ID/URL | N/A (GitHub Actions workflow only; no Production deploy) |
| Database migration | NONE — CI runs `prisma validate` only; migrate deploy forbidden |
| CI_WORKFLOW | `.github/workflows/gap013-ci.yml` — push `v1-p0-commercial-loop` + PRs touching `zwima-v1/**` |
| CI_STEPS | `npm ci` → safety gate → secret scan → prisma validate → lint → typecheck → unit tests |
| CI_SCRIPTS | `scripts/ci/gap013-ci-safety-gate.mjs`; `gap013-secret-scan.mjs`; `gap013-prisma-validate.mjs` (redesigned; prior recovery drafts not restored) |
| BANS_ENFORCED | No Production migrate; no live Provider; no live Stripe charge; no real email; no tracked `.env`/key artifacts |
| Test result | Local `npm run ci` PASS — unit 385/385; typecheck PASS; lint `src` PASS; prisma validate PASS; secret scan PASS; safety PASS |
| Evidence | Workflow + scripts + `package.json` `ci*` scripts; this ledger |
| Retest trigger | `related_code_changed` on CI workflow/gates; GitHub Actions runner/policy change |
| DO_NOT_REPEAT | Re-invent CI from deleted recovery drafts; enable Production migrate in Actions; add live Provider/Stripe/email jobs |

---

### CI-PREVIEW-REPAIR-001

| Field | Value |
|--------|--------|
| ID | CI-PREVIEW-REPAIR-001 |
| 模块 | Emergency Preview Deployment + GAP-013 CI Repair |
| 完成状态 | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-29 |
| Git commit | `b30b5fb` (repair chain: `1cb3c98`, `b30b5fb`) |
| Deployment ID/URL | Preview `https://zwima-4obmmi089-zwima.vercel.app` (`dpl_8adSrjHvpSpfbf5NJQQahkBDmbzL`); alias `https://zwima-ai-git-v1-p0-commercial-loop-zwima.vercel.app` |
| GitHub CI | Run `30449090266` — **success** on `b30b5fb` |
| Database migration | **NONE on Production** — Preview-only P3009 recovery path in `scripts/db-migrate-authorized.mjs`; Production DB untouched |
| GAP-011 | **NOT re-executed** — Production physical audit remains PASS_LOCKED |
| Root cause A (GitHub CI) | `dc23266`: `scripts/gap011-production-readonly-audit.ts` included in `tsc --noEmit` without `@types/pg` → TS7016/TS7006 Typecheck exit 2. Fixed in `1fe77c8` + excluded from tsconfig in `1cb3c98`. |
| Root cause B (Vercel Preview) | Independent: Prisma **P3009** failed migration `20260722100000_m8_m11_rls_security_gap_fix` on Preview DB blocked `vercel-preview-build.mjs`; recovery initially failed because `prisma db execute` lacked `--schema`. Fixed P3009 recovery + `--schema prisma/schema.prisma` in `1cb3c98` / `b30b5fb`. |
| Test result | Local: npm ci PASS; unit 425/425; typecheck PASS; lint PASS; prisma validate PASS; build PASS. Remote: GAP-013 CI success; Vercel Preview **Ready**. |
| Evidence | GitHub Actions run 30449090266; Vercel deployment Ready on `b30b5fb`; commits `1cb3c98`, `b30b5fb`; this ledger |
| Retest trigger | `related_code_changed` on gap013-ci.yml, vercel-preview-build, db-migrate-authorized; Preview DB new failed migration; gap011 audit script re-added to tsconfig |
| DO_NOT_REPEAT | Re-debug as single root cause; re-run GAP-011 on Production; modify Production DB; merge main without authorize; trigger Production deployment; batch migrate resolve on Production |

---

### DASHBOARD-PERFORMANCE-PHASE2

| Field | Value |
|--------|--------|
| ID | DASHBOARD-PERFORMANCE-PHASE2 |
| 模块 | Production Dashboard Overview Performance (Phase 2) |
| 完成状态 | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-29 |
| Git commit | `bb5ee61` (chain: `f284341` infinite-skeleton/timeout → `a5ae0a0` slim first-screen → `bb5ee61` identity merge + TTL cache) |
| Deployment ID/URL | Production `dpl_9CTUzR1iMWAbcrozuBz6AUdokr5p` → `https://zwima-90ut202k2-zwima.vercel.app`; alias **`https://zwima-group.info`** |
| Database migration | **NONE** — no migrate deploy/reset/db push; Production schema unchanged |
| Root cause | Identity path ~3.2s + multi-round-trip overview ~2.1s under `connection_limit=1`; Strict Mode duplicate details fetch |
| Fix | Read-only `requireOverviewIdentity` (single User+membership+org query); one SQL metrics round-trip; per-org/user TTL caches; deferred `/api/workspace/overview/details`; 15s hard client timeout retained |
| Production timing (authenticated `workspace.overview` HTTP 200) | Unique samples in retained logs: **n=2**; `total_ms` **min=2 / median=2 / p95=3 / max=3** (warm identity+slim cache hits); `writeOps=0` |
| Mobile Owner acceptance | PASS — `/dashboard` renders; Organization/Credits/This month + Overview load; no infinite skeleton; no Request timed out; perceived warm load **~2s** (≤3s target) |
| Test result | Unit/typecheck/lint/prisma validate/build PASS on `bb5ee61` |
| Evidence | Vercel Production Ready on `bb5ee61`; timing JSON `msg=workspace.overview`; this ledger |
| Retest trigger | `related_code_changed` on overview/identity/cache fetch path; Production DB pooler/region change; mobile Owner reports warm load >3s sustained |
| DO_NOT_REPEAT | Re-tune Dashboard overview performance without retest trigger; increase frontend timeout to mask API latency; add Production migration for overview indexes without authorize; re-open infinite-skeleton client state machine |

---

### GAP-014

| Field | Value |
|--------|--------|
| ID | GAP-014 |
| 模块 | M11 Backup & Recovery Gate |
| 完成状态 | PASS_LOCKED |
| GAP_014_STATUS | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-29 |
| Git commit | `a7b4907` |
| Deployment ID/URL | N/A (docs + dry-run gates only; no Production restore) |
| Database migration | NONE — no migrate; no Production DB touch |
| BACKUP_MANIFEST | `docs/ZWIMA_AI_BACKUP_MANIFEST.md` |
| RECOVERY_RUNBOOK | `docs/ZWIMA_AI_BACKUP_RECOVERY_RUNBOOK.md` |
| SCRIPTS | `scripts/backup/gap014-backup-capability-check.ts`; `scripts/recovery/gap014-recovery-drill.ts` |
| LOGIC | `src/lib/ops/gap014-backup-recovery.ts` (redaction + fail-closed Production restore) |
| TESTS | `tests/backup-recovery/gap014-backup-recovery.test.ts` |
| DEFAULT_MODE | dry-run |
| PRODUCTION_RESTORE | fail-closed (in-repo scripts always refuse) |
| Test result | backup:check PASS; recovery:drill dry-run PASS; `--target production` refuses; unit + typecheck + lint PASS; no real payment/email/provider |
| Evidence | Manifest + runbook + automated gates; CI steps wired into GAP-013 workflow |
| Retest trigger | `related_code_changed` on backup/recovery gates; Supabase plan/PITR policy change |
| DO_NOT_REPEAT | Live Production DB restore via repo scripts; dump env values; re-run locked migrations as DR proof; start GAP-015 |

---

### GAP-015

| Field | Value |
|--------|--------|
| ID | GAP-015 |
| 模块 | M1/M2 Multi-Provider Production Readiness Gate |
| 完成状态 | PASS_LOCKED |
| GAP_015_STATUS | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-29 |
| Git commit | `629af84` |
| Deployment ID/URL | N/A (readiness gate only; no new live Provider calls) |
| Database migration | NONE |
| OPENAI | PASS — contract + compliance + historical GAP-001 live evidence (no re-spend) |
| GEMINI / CLAUDE / DEEPSEEK / QWEN | PASS_OR_CONFIG_PENDING — contracts/fail-closed/compliance PASS; keys optional |
| REGISTRY | Five adapters in `src/lib/providers/registry.ts` (+ core foundation registry) |
| CONTRACTS | `provider-readiness.assertAdapterContract` + existing `ProviderAdapter` |
| FAIL_CLOSED | missing key / DISABLED / UNAVAILABLE / NO_ROUTABLE_PROVIDER |
| BILLING | `chargeForUsage` preserved; FX hot path reused (GAP-016) |
| DOCS | `docs/ZWIMA_AI_PROVIDER_READINESS_MATRIX.md`; `docs/ZWIMA_AI_PROVIDER_ACTIVATION_RUNBOOK.md` |
| TESTS | `tests/providers/gap015-provider-readiness.test.ts` |
| Test result | Unit PASS; typecheck PASS; lint PASS; secret scan PASS; NEW_REAL_PROVIDER_CALLS=NO |
| Evidence | Readiness module + matrix/runbook; reused adapters; this ledger |
| Retest trigger | `related_code_changed` on provider adapters/readiness; new focus provider added |
| DO_NOT_REPEAT | Re-run OpenAI live smoke for proof; force user to buy vendor quota; enable live providers in CI; rewrite FX/routing formulas |

---

### GAP-010

| Field | Value |
|--------|--------|
| ID | GAP-010 |
| 模块 | M5 Deprecation / Migration policy wiring |
| 完成状态 | PASS_LOCKED |
| GAP_010_STATUS | PASS_LOCKED |
| DUPLICATE_EXECUTION_FORBIDDEN | YES |
| 完成日期 | 2026-07-29 |
| Git commit | `3c15727` |
| Database migration | NONE — reused existing `ModelDeprecationPolicy` / `ModelMigrationPolicy` schema |
| STATUS_GATE | `isRoutableStatus` preserved (ACTIVE / Preview-only PREVIEW) |
| DEPRECATION_ENGINE | `deprecation-policy-engine.ts` — DISABLED/RETIRED/DEPRECATED/past sunset fail-closed |
| MIGRATION_ENGINE | `migration-policy-engine.ts` — autoMigrate rewrite; human-approval blocks auto |
| ROUTING_WIRE | `provider-candidate-builder.ts` loads policy index + `resolveLifecycleRoutingDecision` |
| NOTIFICATIONS | IN_APP plan/dispatch only; EMAIL fail-closed (no Resend) |
| Test result | `gap010-lifecycle-policies` PASS; full suite PASS; typecheck/lint PASS; no email/Provider/Stripe |
| Evidence | Engines + loader + candidate wiring + unit tests; this ledger |
| Retest trigger | `related_code_changed` on lifecycle policy engines / candidate builder |
| DO_NOT_REPEAT | Send deprecation EMAIL; live Provider calls; rewrite M2 scoring; start M8-2C/M9 |

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
| M9 | Workflow Automation | EXCLUDED / not started | Frozen: do not start without auth |
| M8-2C | Workspace Memory | DEFERRED | Explicitly frozen |
| PUBLIC_PRODUCTION_READY | Launch gate | NO | Broader public launch; not Closed Beta P0/P1 scope |
| CLOSED_BETA_READY | Launch gate | CONDITIONAL | P0+P1 engineering PASS_LOCKED; see `docs/ZWIMA_AI_P1_FINAL_READINESS_AUDIT.md` — remaining USER_MANUAL / counsel / deploy authorize only |

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
- “Re-build GAP-013 CI from deleted recovery drafts / add Production migrate or live spend jobs”
- “Re-run Emergency Preview Deployment + GAP-013 CI repair (typecheck gap011 / Preview P3009 recovery)”
- “Re-tune Production Dashboard overview performance / raise client timeout / re-open infinite-skeleton state machine (DASHBOARD-PERFORMANCE-PHASE2)”
- “Live-restore Production DB / dump Vercel env values / re-apply locked migrations to prove GAP-014”
- “Re-run multi-provider live smoke / buy vendor quota / enable LIVE_PROVIDER_CALLS for GAP-015 proof”
- “Re-wire GAP-010 deprecation EMAIL / re-implement migration engines without trigger”

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
