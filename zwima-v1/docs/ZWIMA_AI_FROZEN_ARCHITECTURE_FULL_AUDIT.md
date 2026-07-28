# ZWIMA AI — Frozen Architecture Full Audit (M1–M11)

**AUDIT_DATE:** 2026-07-28  
**AUDIT_BASE_BRANCH:** `m8-agent-platform-phase2b`  
**AUDIT_BASE_COMMIT:** `a728f1996f59c52f006a3a31b6f66d99d3f052b5` (`chore(m8): finalize phase 2b preview acceptance`)  
**ARCHITECTURE_VERSION:** M1–M11 FROZEN  
**MODE:** Read-only (no code changes, no migrations, no deploys, no live paid calls)  
**PROJECT:** Vercel `zwima-ai` (root `zwima-v1`)  
**DOMAIN (Production alias historically):** `https://zwima-group.info`

---

## 0. Audit method and limits

### Evidence sources
- Git: branch/commit/worktrees on this worktree
- Code: `src/`, `prisma/`, `tests/`, `scripts/`, `vercel.json`
- Docs: Phase reports under `docs/` (treated as claims; not automatic proof of current Production state)
- Vercel CLI metadata: project inspect + recent Preview READY deployments (no secret values)

### Explicit non-claims
- This audit **did not** re-run Production provider smoke, Stripe live payment, or customer E2E against Production.
- Historical Phase 6/7 reports (`docs/PHASE6_PROVIDER_FINAL_REPORT.md`, `docs/PHASE7_FINAL_REPORT.md`) are cited as **dated claims** (2026-07-12), not re-validated today.
- Preview environment is **fail-closed** for live providers (`LIVE_PROVIDER_CALLS_ENABLED` gate) and Stripe when `STRIPE_PREVIEW_DISABLED=true`.

### Maturity scale (mandatory)
| Level | Meaning |
|-------|---------|
| L0 | Does not exist |
| L1 | Docs/design only |
| L2 | UI / schema / mock prototype |
| L3 | Backend implemented, incomplete closed loop |
| L4 | Real closed loop verified on Preview |
| L5 | Production-ready, not formally customer-open |
| L6 | Production running with real customer verification |

---

## 1. Git / environment baseline

| Item | Evidence |
|------|----------|
| Branch | `m8-agent-platform-phase2b` |
| HEAD | `a728f19` |
| Worktree | `.worktrees/m8-agent-platform-phase2b` |
| Other worktrees | `main` @ `530be5c`, `m8-agent-platform-phase2a` @ `37d090c`, several baseline/m4 worktrees |
| Recent Preview | READY deployments present (e.g. `zwima-pezmn90ka-zwima.vercel.app`, `zwima-dpt8qls2j-zwima.vercel.app`) |
| Production deploy in this audit | **Not triggered** |
| `vercel.json` on branch | `buildCommand`: `node scripts/vercel-preview-build.mjs` |
| Project inspect Build Command | Shows `npm run vercel-build` (project setting may differ from branch `vercel.json`) |

---

## 2. V1 commercial closed-loop verdict

**Target loop:** register → org/workspace → credits → API key → unified API → provider → tokens/cost/price/margin → debit credits → usage/billing → admin views.

| Segment | Preview | Production (documented / code) |
|---------|---------|--------------------------------|
| Auth (Clerk) | Development dual-user E2E passed in Phase 2B work | Phase 7 note: Clerk may have been placeholder — **not re-verified** |
| Org / team | Prisma org + invite fixed (`src/lib/team/invite.ts`) | Same codebase |
| Credits | Ledger models + persistence path exist | Phase 7 claimed live recharge once |
| API Key | `/api/v1/api-keys`, `validateV1ApiKey` | Present |
| Unified API | `/api/v1/chat` → `gatewayChat` | Present |
| Live provider | **Blocked** by `isLiveProviderHttpAllowed` unless Production + flag | Phase 6 claimed 5/5 smoke PASS (dated) |
| Cost / debit | `persistV1ChatUsage` | Implemented; depends on live usage |
| Stripe | Preview guard can disable | Phase 7 claimed live checkout path |
| Admin views | Dashboard admin pages exist | Pages exist; Production ops not re-verified |

**Verdict:** Preview **cannot** run the full paid live-provider commercial loop under current fail-closed gates. Production **historically claimed** provider + Stripe smoke PASS, but this audit does **not** reconfirm, and customer-facing “first real customers” is **not** evidenced as ongoing L6.

---

## 3. Module audits (M1–M11)

### M1 — AI API Aggregation

**Evidence**
- Unified chat: `src/app/api/v1/chat/route.ts` → `gatewayChat` (`src/core/api/gateway.ts`)
- Stream route: `src/app/api/v1/chat/stream/route.ts`
- Health / providers: `src/app/api/v1/health/route.ts`, `src/app/api/v1/providers/route.ts`
- Adapters registered: openai, gemini, claude, deepseek, qwen — `src/core/adapters/index.ts`
- Bridge: `src/core/adapters/bridge-adapter.ts` — live path requires `assertLiveProviderHttpAllowed()`; else falls through to **stub** `BaseAIProvider.chat` (`src/core/providers/base-provider.ts` returns `[provider] stub response`)
- Legacy HTTP adapters: `src/lib/providers/{openai,gemini,claude,deepseek,qwen}.ts`
- Fail-closed gate: `src/lib/providers/live-provider-gate.ts` (Production + `LIVE_PROVIDER_CALLS_ENABLED=true` only)
- API key auth: `validateV1ApiKey` used by chat route

**Assessment**
- `M1_LEVEL = L3`
- `M1_COMPLETION_PERCENT = 55`
- `M1_REAL_PROVIDERS_CONNECTED = CONDITIONAL` — real HTTP adapters in `src/lib/providers/*` + dated Production smoke; Preview fail-closed
- `M1_MOCK_PROVIDERS = YES` — core `BaseAIProvider` stubs when no key / gate closed; M8 agent mock provider
- `M1_CRITICAL_GAPS =` Dual stack (v1 chat vs playground); no public `/api/v1/embeddings`; tools not on chat body; rate limits on chat-service not v1 chat; Preview cannot exercise live providers

**Follow-up evidence** ([Audit M1-M4](a84ca3e1-b51f-497e-85d5-06eaf6d9ae83)): Bridge uses legacy real adapters only when key configured **and** live gate open; otherwise stub.

---

### M2 — Smart Model Routing

**Evidence**
- **Stack A (public `/api/v1/chat`):** `gatewayChat` → core `RoutingEngine` (`src/core/router/routing-engine.ts`)
- **Stack B (playground/admin):** `executeChatRequest` → policy/smart routers (`src/lib/routing/policy-engine.ts`, `smart-router.ts`) via `ROUTING_ENGINE` env — **not** the v1 chat path
- Failover / policy libs + admin simulate APIs under `src/app/api/admin/routing/*`
- Report: `docs/PHASE3_SMART_ROUTING_REPORT.md` (product “Phase 3” ≠ M3 Billing)

**Assessment**
- `M2_LEVEL = L3`
- `M2_COMPLETION_PERCENT = 50`
- `M2_RUNTIME_ROUTING_ACTIVE = PARTIAL` — core router on v1 chat; smart/policy on playground; live only when provider gate open
- `M2_CRITICAL_GAPS =` Split product paths; Preview cannot prove live routing; smart router not unified onto `/api/v1/chat`

---

### M3 — Unified Billing

**Evidence**
- Credits: `CreditBalance` model (`prisma/schema.prisma`), `persistV1ChatUsage` (`src/lib/billing/v1-chat-usage.ts`)
- Stripe: `src/lib/stripe.ts`, webhook `src/app/api/webhooks/stripe/route.ts`, checkout APIs under billing
- Preview guard: `src/lib/stripe-preview-guard.ts` (`STRIPE_PREVIEW_DISABLED`)
- Packages / invoices / recharge routes under `src/app/api/v1/{packages,recharge,billing,invoices}`
- Pages: `dashboard/billing`, `wallet`, `balance`, `invoices`
- Dated claim: `docs/PHASE7_FINAL_REPORT.md` (live Stripe + credits)

**Assessment**
- `M3_LEVEL = L3`
- `M3_COMPLETION_PERCENT = 60`
- `M3_CREDIT_LEDGER_STATUS = IMPLEMENTED` (code + unit tests; concurrency hardening not fully proven)
- `M3_STRIPE_STATUS = PREVIEW_DISABLED_CAPABLE / PRODUCTION_CLAIMED_LIVE` — Preview often disabled; Production claimed 2026-07-12
- `M3_CRITICAL_GAPS =` Preview payment loop blocked by design; VAT/invoice completeness; concurrent overdraft proof; no fresh live payment in this audit

---

### M4 — Cost Optimization

**Evidence**
- `UsageLog` FX / margin fields in schema
- Admin APIs: `src/app/api/v1/admin/cost-optimization/*`
- UI: `dashboard/admin/fx-cost-control`, `cost-calculator`
- Persistence: `persistV1ChatUsage` writes usage + cost side effects
- Migration additive FX: `prisma/migrations/20260728170000_m4_fx_usage_log_additive`

**Assessment**
- `M4_LEVEL = L3`
- `M4_COMPLETION_PERCENT = 50`
- `M4_REAL_COST_ENGINE_ACTIVE = PARTIAL` — v1 chat persists credits via `chargeForUsage`; **M4 FX fields are not written on that hot path**
- `M4_CRITICAL_GAPS =` `buildUsageFxCost` / `computeUsageFxCost` lack call sites outside `src/lib/fx` (admin only); per-call EUR FX snapshot missing; negative-margin hard block incomplete

**Follow-up evidence** ([Audit M1-M4](a84ca3e1-b51f-497e-85d5-06eaf6d9ae83)): Schema + engines advanced; billing hot path remains credits-centric (`costCredits` / `providerCost`), not full FX margin snapshot.

---

### M5 — Model Lifecycle Management

**Evidence**
- Models: `ProviderModel`, `ModelDeprecationPolicy`, `ModelMigrationPolicy`, availability tables in schema
- Admin: `listModelsWithLifecycle` / `updateModelLifecycle` — `src/lib/model-lifecycle/lifecycle-service.ts`; UI `dashboard/admin/models`
- **Runtime enforcement:** `isRoutableStatus` — only `ACTIVE` (and `PREVIEW` on Preview env) routable; used in `buildProviderCandidates` (`src/lib/routing/provider-candidate-builder.ts`) and pricing estimates
- Deprecation/migration **policy tables** largely schema-first (no `prisma.modelDeprecationPolicy` service wiring found)

**Assessment**
- `M5_LEVEL = L3`
- `M5_COMPLETION_PERCENT = 45`
- `M5_LIFECYCLE_RUNTIME_ENFORCEMENT = STATUS_GATE_YES / POLICY_ENGINE_NO` — `ProviderModel.status` fail-closed; full deprecation-policy auto-migrate not wired
- `M5_CRITICAL_GAPS =` DeprecationPolicy/MigrationPolicy engines; customer notification; sunset workflows beyond status enum

**Follow-up evidence** ([Audit M5-M8](454d20aa-769f-428e-9d4f-f2b028386717)): Corrects earlier “weak enforcement” — status gating is real on routing candidates.

---

### M6 — EU AI Act Compliance Center

**Evidence**
- Legal pages: `privacy`, `terms`, `cookies`, `legal/dpa`, `legal/sub-processors`
- Large compliance Prisma surface (many `Compliance*` models)
- Admin: `dashboard/admin/compliance`, `api/admin/compliance`
- Runtime-ish: AI audit / review bridges in agents; memory sensitive-data + prompt sanitization (M8)
- Not proven: compliance gating every provider call in Production today

**Assessment**
- `M6_LEVEL = L2`
- `M6_COMPLETION_PERCENT = 45`
- `M6_RUNTIME_COMPLIANCE_ACTIVE = PARTIAL` — logging/filters exist; Act risk engine not proven end-to-end
- `M6_CRITICAL_GAPS =` DSAR delete/export automation; consent ledger; runtime risk classification on every call; DPA operational process

---

### M7 — Enterprise Management Console

**Evidence**
- Clerk: `@clerk/nextjs`, `src/lib/auth.ts` (`getCurrentDbUser` / clerkId→email)
- Org/RBAC: `Organization`, `OrganizationMember`, `OrgRole`; workspace context `src/lib/workspace/workspace-context.ts`
- Team invite hardened: `src/lib/team/invite.ts`, `/api/team`
- API keys, usage, billing, team, settings dashboard pages
- Admin console: `dashboard/admin/*`
- Phase 2B dual-user Preview auth smoke PASSED (session evidence in prior task)

**Assessment**
- `M7_LEVEL = L3`
- `M7_COMPLETION_PERCENT = 65`
- `M7_MULTI_TENANCY_STATUS = PARTIAL_PASS` — org isolation patterns present; Viewer role E2E NOT_TESTED; workspace entity vs org still thin
- `M7_CRITICAL_GAPS =` Viewer coverage; enterprise workspace onboarding polish; platform-admin vs org-admin separation evidence incomplete

---

### M8 — Agent Platform

**Evidence (do not over-claim)**

| Slice | Status | Evidence |
|-------|--------|----------|
| Phase 1 | Preview foundation PASS (historical branch work) | commits `4099c10`, tool allowlist freeze `d2b2f37`; mock runner `agent-runner.ts` |
| Phase 2A | Templates + memory foundation | commit `37d090c`; `AgentTemplate`, `AgentMemoryPolicy` migration |
| Phase 2B | Memory isolation + fail-closed WORKSPACE | commit `9910415`…`a728f19`; E2E Preview PASS; team invite fix |
| WORKSPACE memory | **Deferred / fail-closed** | `workspaceMemoryDeferred: true`; `WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE` |
| Phase 2C | **Not implemented** — candidate name only | No branch/docs naming Phase 2C as authorized scope |
| Real model execution | **Mock** | `resolveProviderMode` → mock unless live gate; synthetic summary |
| MCP / Skills / Plugins / Subagents | **Not implemented** as product features | No MCP server product surface; Phase 2B explicitly forbade |
| Tool allowlist | Three safe tools | `ALLOWED_TOOL_KEYS` / forbidden list in agent-safety |

**Assessment**
- `M8_LEVEL = L4` **only for Preview mock-agent + memory security scope**; overall module toward commercial agents remains incomplete → scored as **L3 overall** with L4 subset
- Chosen overall: `M8_LEVEL = L3`, `M8_COMPLETION_PERCENT = 50`
- `M8_PHASE1_STATUS = PREVIEW_PASS (mock)`
- `M8_PHASE2A_STATUS = PREVIEW_PASS (templates/memory foundation)`
- `M8_PHASE2B_STATUS = PREVIEW_PASS (isolation/security)`
- `M8_WORKSPACE_MEMORY_STATUS = DEFERRED_FAIL_CLOSED`
- `M8_REAL_AGENT_RUNTIME_STATUS = MOCK_ONLY`
- `M8_CRITICAL_GAPS =` live model agent runs; workspace memory; MCP/skills; multi-agent; production agent acceptance

---

### M9 — Workflow Automation

**Evidence**
- Rich Prisma models: `WorkflowDefinition`, `WorkflowExecution`, etc. (`prisma/schema.prisma` ~6058–6760)
- **No** `src/app/api/**/workflow*` routes; **no** dashboard workflow pages; **no** TS runtime imports
- Curated matrix explicitly marks M9–M11 as EXCLUDE: `docs/PRODUCTION_CAPABILITY_GAP_MATRIX.md`
- M8 report historically said stop before M9

**Assessment**
- `M9_LEVEL = L2` (schema prototype; no verified runtime/UI loop)
- `M9_COMPLETION_PERCENT = 15`
- `M9_RUNTIME_STATUS = NOT_SHIPPED`
- `M9_CRITICAL_GAPS =` entire runtime, builder UI, triggers, billing integration, E2E

**Follow-up evidence** ([Audit M9-M11](4a020878-fc5a-4ddd-9081-ae856451569e)).

---

### M10 — Enterprise Dashboard

**Evidence**
- Customer dashboards: overview, usage, billing, analytics, projects, providers
- Admin: revenue, pricing, models, compliance, routing, fx-cost
- Some data paths use Prisma (workspace overview historically schema-sensitive)
- Not proven: all charts live vs placeholder

**Assessment**
- `M10_LEVEL = L2`
- `M10_COMPLETION_PERCENT = 40`
- `M10_REAL_DATA_STATUS = MIXED`
- `M10_CRITICAL_GAPS =` unified enterprise KPI freshness; agent/workflow usage panels; proven non-static analytics

---

### M11 — Digital Infrastructure

**Evidence**
- Vercel Preview + Production project `zwima-ai`; domain claimed `zwima-group.info`
- Env isolation patterns: live-provider gate, Stripe preview guard, Preview-only diag `/api/v1/preview-diag/env-db`
- Preview migrate path: `scripts/db-migrate-authorized.mjs`, `vercel-preview-build.mjs`
- Tests: Vitest many; Playwright e2e present; M8 dual-user Preview authenticated E2E executed in prior task
- **No** `.github/workflows` found in this worktree
- Monitoring / backup / DR / load tests: docs sparse; not operationally proven here

**Assessment**
- `M11_LEVEL = L3`
- `M11_COMPLETION_PERCENT = 50`
- `M11_PRODUCTION_READINESS = PARTIAL`
- `M11_CRITICAL_GAPS =` CI/CD Actions missing; backup/restore drills; error tracking productization; load/security tests; ops runbooks incomplete

---

## 4. Frontend V1 pages (summary table)

| PAGE | ROUTE | UI | AUTH | BACKEND | REAL_DATA | RBAC | PROD_READY | GAPS |
|------|-------|----|------|---------|-----------|------|------------|------|
| Home | `/` | Y | N | marketing | static-ish | N/A | Partial | SEO/i18n incomplete |
| Pricing | `#pricing` on `/` (no `/pricing` page) | Y | N | packages API + static `PLANS` | mixed | N/A | Partial | no dedicated `/pricing` route; live purchase depends Stripe |
| Dashboard | `/dashboard` | Y | Y | overview API | mixed | org | Partial | overview schema sensitivity historically |
| API Keys | `/dashboard/api-keys` | Y | Y | `/api/v1/api-keys` | Y | Y | Partial | — |
| Usage | `/dashboard/usage*` | Y | Y | usage APIs | Y | Y | Partial | — |
| Providers | `/dashboard/providers` | Y | Y | providers API | fail-closed Preview | Y | Partial | live status Preview blocked |
| Billing | `/dashboard/billing` | Y | Y | billing/checkout | Preview often disabled | Y | Partial | Stripe Preview guard |
| Compliance | `/dashboard/admin/compliance` | Y | Y | admin API | mixed | admin | Partial | runtime Act depth |
| Legal | `/privacy` `/terms` `/cookies` `/legal/*` | Y | N | static | N/A | N/A | Better | process ops |
| Team | `/dashboard/team` | Y | Y | `/api/team` | Y | invite RBAC | Partial | Viewer untested |
| Agents | `/dashboard/agents*` | Y | Y | agent APIs | mock runtime | Y | Preview mock | live agents |
| Auth | Clerk login/signup | Y | — | Clerk | — | — | Partial | Prod Clerk historically uncertain |

Mobile / a11y / DE locale: **not comprehensively verified** in this audit → treat as gaps (P2/P3).

---

## 5. Launch readiness gates

| Gate | Result | Why |
|------|--------|-----|
| INTERNAL_PREVIEW_READY | **YES** (narrow) | Preview deploys READY; Clerk Dev dual-user; M8 Phase 2B mock/security acceptance; providers intentionally fail-closed |
| CLOSED_BETA_READY | **NO** | Live commercial loop not re-proven; Stripe/Preview gates; lifecycle/compliance/runtime gaps; no Viewer E2E; ops/CI gaps |
| PUBLIC_PRODUCTION_READY | **NO** | No evidence of sustained real-customer L6; legal/ops/load/security incomplete; M9–M11 unfinished |

---

## 6. Scores (0–100, evidence-weighted)

| Score | Value | Basis |
|-------|------:|-------|
| ARCHITECTURE_COVERAGE_SCORE | 62 | M1–M11 artifacts exist unevenly |
| CORE_API_SCORE | 58 | Chat gateway + keys; Preview live blocked |
| BILLING_SCORE | 55 | Ledger+Stripe code; Preview disabled; dated Prod claim; FX not on hot path |
| SECURITY_SCORE | 60 | Fail-closed gates, allowlists, memory filters; incomplete pen-test |
| COMPLIANCE_SCORE | 42 | Legal pages + large schema; weak runtime Act proof |
| MULTI_TENANCY_SCORE | 58 | Org scoping + invite fix; Viewer gap |
| AGENT_PLATFORM_SCORE | 50 | Preview mock Phases 1/2A/2B; no live agents |
| WORKFLOW_SCORE | 15 | Schema only (EXCLUDE in curated matrix) |
| INFRASTRUCTURE_SCORE | 52 | Vercel/Supabase/Clerk patterns; weak CI/DR; no security headers |
| OPERATIONS_SCORE | 35 | Thin runbooks/monitoring/backup proof |
| **OVERALL_PLATFORM_COMPLETION_PERCENT** | **48** | |
| **CLOSED_BETA_READINESS_PERCENT** | **35** | |
| **PUBLIC_LAUNCH_READINESS_PERCENT** | **22** | |

---

## 7. Final audit result

**FINAL_AUDIT_RESULT = NOT_READY_FOR_CLOSED_BETA_OR_PUBLIC_LAUNCH**  
**INTERNAL_PREVIEW = READY (scoped: auth + mock agents + fail-closed providers)**  

**Do not start M8 Phase 2C or other feature work from this audit.** Next step is gap prioritization (see companion registers), then an authorized remediation plan.
