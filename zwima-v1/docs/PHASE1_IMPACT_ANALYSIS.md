# Phase 1 Infrastructure — Impact Analysis (Step 1)

**Date:** 2026-07-13  
**Scope:** Multi-Model Gateway, Routing, Pricing, API Key Governance, AI Audit  
**Out of scope:** Agent, Workflow, MCP, OAuth integrations

---

## 1. Current State Summary

| Area | Current | Gap |
|------|---------|-----|
| Provider | `Provider` table + 5 adapters | No `ProviderModel`, no versioned pricing, health in-memory |
| Pricing | `ModelPricing` unique per model, upsert overwrites | No history, no effectiveFrom/Until, no DRAFT/VERIFIED |
| Routing | `routeByModel()` first-match | No policy engine, no fallback, weight/priority unused |
| API Keys | Basic hash, enabled, usageLimit | No org binding, no RPM/TPM, permissions not enforced |
| Audit | `AuditLog` for admin actions | No AI call audit, no prompt hash, no SecurityEvent |
| Billing | `BillingEngine` + Stripe | **Must not change** payment chain |
| Adapters | `ProviderAdapter` interface | **Must not change** interface |

---

## 2. Schema Impact

### Add (new tables)
- `ProviderModel` — model catalog per provider
- `ModelPricingRecord` — versioned pricing with effective dates (spec: ModelPricing)
- `ProviderHealth` — persisted health metrics
- `RoutingPolicy` — org/global routing strategies
- `RoutingWeightConfig` — balanced scoring weights (not hardcoded in UI)
- `AiAuditLog` — GDPR-aware AI call records
- `SecurityEvent` — abuse / anomaly events
- `PlatformConfig` — MIN_MARGIN_PERCENT, retry limits, etc.
- `IdempotencyRecord` — clientRequestId dedup

### Extend (backward compatible)
- `Provider` — region, dataResidency, capabilities, status enum
- `ApiKey` — governance fields (rpm, tpm, budgets, allowed models/providers, status enum)
- `Organization` — defaultRoutingPolicyId

### Preserve (no breaking changes)
- `UsageLog`, `Transaction`, `Payment`, `Invoice`, `CreditBalance` — unchanged structure
- Legacy `ModelPricing` — kept; pricing-engine reads new table first, falls back to legacy
- `Provider.slug` — remains adapter registry key

### Migration risk
- **LOW** for billing tables (additive only)
- **MEDIUM** for ApiKey (organizationId backfill via default org)
- **LOW** for Provider (additive columns with defaults)

---

## 3. Code Impact Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Major additive extension |
| `prisma/seed.ts` | ProviderModel + DRAFT pricing placeholders |
| `src/lib/billing/pricing-engine.ts` | Read versioned pricing + legacy fallback |
| `src/lib/chat-service.ts` | Integrate routing engine + audit + governance |
| `src/lib/providers/router.ts` | Delegate to routing engine; keep adapter calls |
| `src/lib/routing/*` | **New** policy engine |
| `src/lib/api-keys/*` | **New** governance module |
| `src/lib/audit/ai-audit.ts` | **New** AI audit writer |
| `src/lib/cost/*` | **New** margin guard |
| `src/lib/env.ts` | **New** startup validation |
| `src/app/api/v1/chat/route.ts` | requestId, strategy, standard errors |
| `src/app/api/v1/models/route.ts` | Filter by key permissions |
| `src/app/api/api-keys/*` | Governance fields |
| Admin pages | New/extended 7 pages |
| `webhooks/stripe/route.ts` | Add idempotency (existing gap) |

### Must NOT change
- `ProviderAdapter` interface in `types.ts`
- Individual adapter files (openai, gemini, etc.)
- Stripe checkout + webhook core logic
- `chargeForUsage` transaction semantics

---

## 4. Production Impact

| System | Impact |
|--------|--------|
| 5/5 Provider health | Unchanged adapter path; routing adds fallback layer |
| Stripe Live | No schema changes to Payment |
| Existing API keys | Continue working; backfilled to default org |
| Existing pricing | Legacy `ModelPricing` still used until VERIFIED records exist |
| Credits deduction | Same `chargeForUsage`; enhanced pre-check |

**Rollback:** Revert routing to `routeByModel()` via env `ROUTING_ENGINE=legacy`.

---

## 5. Execution Order

1. ✅ Impact analysis (this document)
2. Prisma schema + seed (DRAFT placeholders)
3. Routing policy engine + pricing service
4. Cost/margin protection
5. API key governance
6. AI audit log + security events
7. Admin UI + v1 API extensions
8. Vitest unit/integration tests
9. Documentation pack
10. Build/lint/typecheck gate

---

## 6. BLOCKER Assessment (pre-implementation)

| Item | Status |
|------|--------|
| Breaking Stripe chain | Not planned |
| Breaking ProviderAdapter | Not planned |
| Production data loss | Prevented via additive migration |
| Unverified pricing in production routing | DRAFT excluded by design |

**Proceed:** YES — additive architecture with legacy fallback.
