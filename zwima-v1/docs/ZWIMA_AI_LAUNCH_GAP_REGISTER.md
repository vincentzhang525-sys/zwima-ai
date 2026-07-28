# ZWIMA AI — Launch Gap Register

**AUDIT_DATE:** 2026-07-28  
**AUDIT_BASE_COMMIT:** `a728f19` (`m8-agent-platform-phase2b`)  
**Companion:** `docs/ZWIMA_AI_FROZEN_ARCHITECTURE_FULL_AUDIT.md`

Priority legend: **P0** block any customer use · **P1** before Closed Beta · **P2** before Public · **P3** post-launch

---

## P0

### GAP-001
- **MODULE:** M1 / V1 loop
- **PRIORITY:** P0
- **ISSUE:** Preview cannot execute live provider HTTP; V1 “real return from supplier” loop fails closed on Preview
- **CURRENT_STATE:** `isLiveProviderHttpAllowed` requires Production + exact flag
- **EVIDENCE:** `src/lib/providers/live-provider-gate.ts`; `/api/v1/providers` fail-closed body; Preview diag `stripePreviewDisabled` / clerk configured separately
- **CUSTOMER_IMPACT:** Cannot demonstrate live chat on Preview
- **SECURITY_OR_FINANCIAL_RISK:** Low on Preview (by design); high if Production flag mis-set
- **REQUIRED_FIX:** Controlled Preview live-provider policy **or** accept Preview mock-only and prove Production smoke under change control
- **DEPENDENCIES:** Provider keys, gate policy decision
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** CLOSED_BETA (Production proof) / INTERNAL (Preview policy)

### GAP-002
- **MODULE:** M3
- **PRIORITY:** P0
- **ISSUE:** Stripe Preview disabled path blocks recharge closed loop on Preview; Production live payment not re-verified in this audit
- **CURRENT_STATE:** `STRIPE_PREVIEW_DISABLED` guard; Phase 7 dated PASS
- **EVIDENCE:** `src/lib/stripe-preview-guard.ts`; `docs/PHASE7_FINAL_REPORT.md`
- **CUSTOMER_IMPACT:** No safe Preview payment rehearsal; Prod uncertainty
- **SECURITY_OR_FINANCIAL_RISK:** Financial — mis-billing / open checkout
- **REQUIRED_FIX:** Test-mode Stripe Preview playbook + fresh Production smoke under approval
- **DEPENDENCIES:** Stripe test/live keys, webhook
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-003
- **MODULE:** M7 / Auth
- **PRIORITY:** P0
- **ISSUE:** Production Clerk readiness historically flagged as possibly placeholder; not re-verified
- **CURRENT_STATE:** Dev Clerk dual-user works on Preview; Prod unknown in this audit
- **EVIDENCE:** `docs/PHASE7_FINAL_REPORT.md` Step 3 manual note; Preview E2E used `sk_test_` / `pk_test_`
- **CUSTOMER_IMPACT:** Customers cannot sign in if Prod Clerk broken
- **SECURITY_OR_FINANCIAL_RISK:** Auth outage / wrong instance
- **REQUIRED_FIX:** Production Clerk instance verification (no secret dump)
- **DEPENDENCIES:** Clerk Production dashboard
- **ESTIMATED_COMPLEXITY:** S
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-004
- **MODULE:** M3 / M4
- **PRIORITY:** P0
- **ISSUE:** Credits debit + usage persistence not proven under concurrent live load
- **CURRENT_STATE:** Unit tests for persistence exist; no load/concurrency E2E
- **EVIDENCE:** `src/lib/__tests__/v1-chat-usage-persistence.test.ts`; no load-test artifacts
- **CUSTOMER_IMPACT:** Overdraft / inconsistent balances
- **SECURITY_OR_FINANCIAL_RISK:** Direct financial loss
- **REQUIRED_FIX:** Atomic debit proof + concurrency tests
- **DEPENDENCIES:** Billing engine
- **ESTIMATED_COMPLEXITY:** L
- **LAUNCH_GATE:** CLOSED_BETA

---

## P1

### GAP-010
- **MODULE:** M5
- **PRIORITY:** P1
- **ISSUE:** `ProviderModel.status` is gated via `isRoutableStatus`, but DeprecationPolicy/MigrationPolicy engines are not wired; auto-migrate / customer notification incomplete
- **CURRENT_STATE:** Status fail-closed on candidate builder; policy tables schema-first
- **EVIDENCE:** `lifecycle-service.ts` `isRoutableStatus`; `provider-candidate-builder.ts`; no `modelDeprecationPolicy` service usage ([Audit M5-M8](454d20aa-769f-428e-9d4f-f2b028386717))
- **CUSTOMER_IMPACT:** Sunset/migration workflows incomplete even when status blocks routing
- **SECURITY_OR_FINANCIAL_RISK:** Compliance / support cost
- **REQUIRED_FIX:** Wire deprecation/migration policy services + notifications; keep status gate
- **DEPENDENCIES:** M5 catalog accuracy
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-016
- **MODULE:** M4
- **PRIORITY:** P1
- **ISSUE:** M4 FX / EUR margin snapshot engines exist but are not invoked on `/api/v1/chat` billing hot path
- **CURRENT_STATE:** `chargeForUsage` writes credits/`providerCost`; FX builders unused outside `src/lib/fx`
- **EVIDENCE:** [Audit M1-M4](a84ca3e1-b51f-497e-85d5-06eaf6d9ae83) — `buildUsageFxCost` / `computeUsageFxCost` no external call sites
- **CUSTOMER_IMPACT:** Incomplete cost/FX audit trail on customer usage
- **SECURITY_OR_FINANCIAL_RISK:** Financial / margin opacity
- **REQUIRED_FIX:** Persist FX snapshot fields on each successful billed call (or explicitly defer FX to admin-only)
- **DEPENDENCIES:** FX rate provider
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-011
- **MODULE:** M6
- **PRIORITY:** P1
- **ISSUE:** EU AI Act / GDPR operational runtime incomplete vs schema size
- **CURRENT_STATE:** **PASS (Closed Beta minimal gate)** — legal pages versioned; consent ledger + dashboard gate; commercial API fail-closed; manual deletion request; sensitive log redaction; Preview additive migration
- **EVIDENCE:** `LegalConsentAcceptance` / `AccountDeletionRequest`; `/dashboard/accept-terms`; `assertCommercialApiConsent`; `docs/ZWIMA_AI_CLOSED_BETA_DATA_FLOW.md`; Completion Ledger GAP-011
- **CUSTOMER_IMPACT:** Regulatory exposure reduced for Closed Beta minimum
- **SECURITY_OR_FINANCIAL_RISK:** Residual: draft legal text pending counsel; Production migrate not applied
- **REQUIRED_FIX:** ~~Minimal V1 compliance runtime checklist~~ Done for Closed Beta; counsel sign-off remains separate
- **DEPENDENCIES:** Legal review (counsel) for final text
- **ESTIMATED_COMPLEXITY:** L
- **LAUNCH_GATE:** CLOSED_BETA
- **STATUS:** PASS (Preview)

### GAP-012
- **MODULE:** M7
- **PRIORITY:** P1
- **ISSUE:** Viewer permission E2E NOT_TESTED; RBAC matrix incomplete
- **CURRENT_STATE:** Owner/Admin + Member only in Primary org tests
- **EVIDENCE:** Phase 2B E2E `VIEWER_PERMISSION = NOT_TESTED`
- **CUSTOMER_IMPACT:** Privilege bugs
- **SECURITY_OR_FINANCIAL_RISK:** Authorization bypass risk
- **REQUIRED_FIX:** Provision Viewer test identity + denial tests
- **DEPENDENCIES:** Clerk Dev user
- **ESTIMATED_COMPLEXITY:** S
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-013
- **MODULE:** M11
- **PRIORITY:** P1
- **ISSUE:** No GitHub Actions CI workflows in worktree
- **CURRENT_STATE:** Local vitest/playwright; no `.github/workflows`
- **EVIDENCE:** glob zero workflows
- **CUSTOMER_IMPACT:** Regression risk on every push
- **SECURITY_OR_FINANCIAL_RISK:** Medium
- **REQUIRED_FIX:** CI for unit + lint + typecheck (+ gated e2e)
- **DEPENDENCIES:** GitHub
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-014
- **MODULE:** M11
- **PRIORITY:** P1
- **ISSUE:** Backup/restore, monitoring, incident runbooks not evidenced
- **CURRENT_STATE:** Supabase/Vercel used; DR drills undocumented here
- **EVIDENCE:** absence of ops runbook proofs in repo
- **CUSTOMER_IMPACT:** Outage recovery unknown
- **SECURITY_OR_FINANCIAL_RISK:** High availability risk
- **REQUIRED_FIX:** Backup schedule + restore test record + alerting
- **DEPENDENCIES:** Supabase/Vercel plans
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** CLOSED_BETA

### GAP-015
- **MODULE:** M1/M2
- **PRIORITY:** P1
- **ISSUE:** Production provider smoke is dated (2026-07-12); not re-run in this audit
- **CURRENT_STATE:** Report PASS 5/5 historically
- **EVIDENCE:** `docs/PHASE6_PROVIDER_FINAL_REPORT.md`
- **CUSTOMER_IMPACT:** Silent provider breakages
- **SECURITY_OR_FINANCIAL_RISK:** Availability
- **REQUIRED_FIX:** Scheduled Production smoke (read-only/cheap models) under approval
- **DEPENDENCIES:** Live gate, keys
- **ESTIMATED_COMPLEXITY:** S
- **LAUNCH_GATE:** CLOSED_BETA

---

## P2

### GAP-020
- **MODULE:** M8
- **PRIORITY:** P2
- **ISSUE:** Agent runtime is mock-only; live agent execution not productized
- **CURRENT_STATE:** Phase 1–2B Preview pass on mock
- **EVIDENCE:** `agent-runner.ts` mock resolution; `PROVIDER_LIVE_CALLS_DISABLED` path
- **CUSTOMER_IMPACT:** Agents not usable as live copilots
- **SECURITY_OR_FINANCIAL_RISK:** Medium if live tools expand carelessly
- **REQUIRED_FIX:** Separate authorized phase for live agent runtime (not Phase 2C invent)
- **DEPENDENCIES:** M1 live gate, tool policy
- **ESTIMATED_COMPLEXITY:** XL
- **LAUNCH_GATE:** PUBLIC / POST_LAUNCH (can defer for V1 API billing)

### GAP-021
- **MODULE:** M8
- **PRIORITY:** P2
- **ISSUE:** WORKSPACE memory deferred fail-closed
- **CURRENT_STATE:** `workspaceMemoryDeferred: true`
- **EVIDENCE:** `memory-policy-service.ts`; acceptance `WORKSPACE_MEMORY_DEFERRED=YES`
- **CUSTOMER_IMPACT:** No shared workspace memory
- **SECURITY_OR_FINANCIAL_RISK:** Low while deferred; high if enabled without workspace context
- **REQUIRED_FIX:** Only after real Workspace context (not orgId spoof)
- **DEPENDENCIES:** M7 workspace model
- **ESTIMATED_COMPLEXITY:** L
- **LAUNCH_GATE:** POST_LAUNCH (optional V1)

### GAP-022
- **MODULE:** M9
- **PRIORITY:** P2
- **ISSUE:** Workflow schema without API/UI/runtime
- **CURRENT_STATE:** Prisma only
- **EVIDENCE:** `WorkflowDefinition` models; zero workflow routes
- **CUSTOMER_IMPACT:** No automation product
- **SECURITY_OR_FINANCIAL_RISK:** N/A until enabled
- **REQUIRED_FIX:** Full M9 program (do not start for V1 critical path)
- **DEPENDENCIES:** M8 stable
- **ESTIMATED_COMPLEXITY:** XL
- **LAUNCH_GATE:** POST_LAUNCH

### GAP-023
- **MODULE:** M4
- **PRIORITY:** P2
- **ISSUE:** Full FX / margin / promotion accounting completeness
- **CURRENT_STATE:** Fields + admin APIs exist
- **EVIDENCE:** UsageLog FX columns; cost-optimization admin routes
- **CUSTOMER_IMPACT:** Margin errors
- **SECURITY_OR_FINANCIAL_RISK:** Financial
- **REQUIRED_FIX:** Reconciliation jobs + alerts
- **DEPENDENCIES:** FX rate source
- **ESTIMATED_COMPLEXITY:** L
- **LAUNCH_GATE:** PUBLIC

### GAP-024
- **MODULE:** Frontend
- **PRIORITY:** P2
- **ISSUE:** i18n DE, mobile, a11y, SEO not verified
- **CURRENT_STATE:** EN-first UI
- **EVIDENCE:** no comprehensive i18n audit in suite
- **CUSTOMER_IMPACT:** EU market friction
- **SECURITY_OR_FINANCIAL_RISK:** Low
- **REQUIRED_FIX:** Locale + responsive QA
- **DEPENDENCIES:** Design
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** PUBLIC

### GAP-025
- **MODULE:** M10
- **PRIORITY:** P2
- **ISSUE:** Enterprise dashboard data freshness / static risk
- **CURRENT_STATE:** Many pages; mixed data provenance
- **EVIDENCE:** `dashboard/analytics`, admin revenue pages
- **CUSTOMER_IMPACT:** Misleading metrics
- **SECURITY_OR_FINANCIAL_RISK:** Medium
- **REQUIRED_FIX:** Provenance labeling + real aggregates
- **DEPENDENCIES:** UsageLog quality
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** PUBLIC

---

## P3

### GAP-030
- **MODULE:** M8
- **PRIORITY:** P3
- **ISSUE:** MCP / Skills / Plugins / Subagents absent
- **CURRENT_STATE:** Explicitly out of Phase 2B scope
- **EVIDENCE:** Phase 2B execution constraints in transcript/docs comments
- **CUSTOMER_IMPACT:** Advanced agent features missing
- **SECURITY_OR_FINANCIAL_RISK:** High if rushed
- **REQUIRED_FIX:** Future M8+ phases only under freeze rules
- **DEPENDENCIES:** Security review
- **ESTIMATED_COMPLEXITY:** XL
- **LAUNCH_GATE:** POST_LAUNCH

### GAP-031
- **MODULE:** M11
- **PRIORITY:** P3
- **ISSUE:** Load testing / WAF / dependency audit automation thin
- **CURRENT_STATE:** Not evidenced
- **EVIDENCE:** no load-test artifacts
- **CUSTOMER_IMPACT:** Scale risk
- **SECURITY_OR_FINANCIAL_RISK:** Medium
- **REQUIRED_FIX:** Periodic audits
- **DEPENDENCIES:** Tooling budget
- **ESTIMATED_COMPLEXITY:** M
- **LAUNCH_GATE:** POST_LAUNCH

---

## Counts

| Priority | Count |
|----------|------:|
| P0 | 4 |
| P1 | 7 |
| P2 | 6 |
| P3 | 2 (sample; more P3 exist in audit narrative) |

**P0_BLOCKER_COUNT = 4**  
**P1_BLOCKER_COUNT = 7**  
**P2_GAP_COUNT = 6+**
