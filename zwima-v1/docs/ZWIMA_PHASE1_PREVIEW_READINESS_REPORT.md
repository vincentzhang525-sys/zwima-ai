# ZWIMA AI Phase 1 Preview Readiness Report

**Date:** 2026-07-13  
**Scope:** Phase 1 Core Infrastructure — Preview validation gate (not Production release)  
**Verdict:** **BLOCKED** — engineering gates PASS; Preview DB migration not yet executed on a live Preview database.

---

## 1. Modified / Added File Count

| Category | Count |
|----------|------:|
| Git tracked modifications | 13 |
| New untracked paths (dirs + files) | ~45 |
| **Estimated total Phase 1 touchpoints** | **~58** |

Key areas: `prisma/schema`, incremental migration, `src/lib/routing|pricing|cost|api-keys|audit`, Admin/V1 APIs, tests, docs.

---

## 2. Migration Status

| Item | Status |
|------|--------|
| from-empty migration removed | ✅ Replaced |
| Incremental SQL | ✅ `prisma/migrations/20250713180000_phase1_infra/migration.sql` (~410 lines) |
| `migration_lock.toml` | ✅ Present (`provider = postgresql`) |
| DROP on core tables | ✅ None |
| Safe backfill | ✅ `Provider.updatedAt`, `ApiKey.status` from `enabled` |
| `prisma validate` | ✅ PASS |
| `prisma generate` | ✅ PASS |
| **Preview `migrate deploy`** | ❌ **BLOCKED** — no PostgreSQL at `127.0.0.1:5432` in this environment |

### Migration Risk Summary (no Production contact)

- **User / Organization / ApiKey / UsageLog / Transaction / Invoice / Payment / Provider:** ALTER ADD only; no table rebuild.
- **New nullable fields:** `organizationId`, `requestId`, `stripeEventId` — compatible with existing rows.
- **ApiKey.status:** backfilled from `enabled`; new enums additive.
- **Risk:** first deploy on DB with partial manual changes may need `_prisma_migrations` baseline review.
- **Mitigation:** run `migrate deploy` on disposable Preview clone of Production schema before merge.

---

## 3. Build / Lint / Typecheck / Test Results

| Gate | Result | Detail |
|------|--------|--------|
| `npm run lint` | ✅ **0 errors** | 3 warnings (scripts only) |
| `npm run typecheck` | ✅ **0 errors** | |
| `npm run build` | ✅ **PASS** | Next.js 15.5.20 production build |
| `npm test` | ✅ **31/31 PASS** | 2 files, Vitest 3.2.4 |
| `npx prisma validate` | ✅ PASS | |
| `npx prisma generate` | ✅ PASS | |

### Warnings (non-blocking)

1. `scripts/debug-env-parse.mjs` — unused `parse`
2. `scripts/stripe-step2-verify.mjs` — unused `createHash`
3. `scripts/sync-vercel-env.mjs` — unused `listExisting`
4. Webpack: large string serialization cache notice (build)

---

## 4. Test Count & Coverage Modules

| Module | Tests | Notes |
|--------|------:|-------|
| Routing (scoring, exclude, EU, retry, no candidate) | 8 | |
| Fallback / chargedOnce | 3 | |
| Cost & margin | 3 | incl. MIN_MARGIN guard |
| API Key governance | 11 | RPM, TPM, IP, budget, permissions, serialize |
| Pricing fail-closed | 3 | DRAFT / zero / VERIFIED |
| Audit hash-only | 1 | |
| Stripe idempotency pattern | 1 | mock findFirst |
| Billing single-charge intent | 1 | |
| **Total** | **31** | |

**Gaps vs spec:** full E2E billing/Stripe webhook HTTP tests, org-isolation integration tests, admin UI e2e — deferred to Preview manual QA.

---

## 5. API Key V1 Status

| Endpoint | Status |
|----------|--------|
| `GET /api/v1/api-keys` | ✅ Implemented |
| `POST /api/v1/api-keys` | ✅ |
| `PATCH /api/v1/api-keys/:id` | ✅ |
| `POST .../revoke` | ✅ |
| `POST .../rotate` | ✅ |
| Hash storage / one-time plaintext | ✅ |
| Audit on CRUD | ✅ |
| Org isolation | ✅ Code-level; Preview pentest pending |

---

## 6. Pricing Database Status

| Requirement | Status |
|-------------|--------|
| Provider / ProviderModel / ModelPricingRecord | ✅ Schema + seed (DRAFT placeholders) |
| RoutingPolicy / RoutingWeightConfig | ✅ |
| effectiveFrom / effectiveUntil / status | ✅ |
| DRAFT excluded from routing | ✅ |
| Zero-price VERIFIED rejected | ✅ |
| Fail closed without VERIFIED | ✅ (policy path) |

---

## 7. Routing Engine Status

| Item | Status |
|------|--------|
| Policy engine implementation | ✅ |
| **Production default** | `ROUTING_ENGINE=legacy` ✅ |
| Admin simulate API | ✅ |
| Preview switch to `policy` | ⏳ After DB migration + VERIFIED prices |

---

## 8. Cost Protection Status

| Control | Status |
|---------|--------|
| Pre-call estimate | ✅ |
| MIN_MARGIN_PERCENT | ✅ |
| Output token clamp | ✅ |
| Retry single charge semantics | ✅ (`chargedOnce`) |
| Monthly budget | ✅ |
| dailyBudget check | ⚠️ Stub (empty block) |

---

## 9. Audit Status

| Requirement | Status |
|-------------|--------|
| requestId propagation | ✅ chat / usage / audit |
| No prompt/response plaintext | ✅ SHA-256 hashes |
| No API key plaintext in audit | ✅ |
| Org-scoped queries | ✅ API design |
| Retention design documented | ✅ `AI_AUDIT_LOGGING.md` |
| CSV export gated | 📋 Designed; endpoint optional in Preview |

---

## 10. Admin UI Status

| Page | Loading / Empty / Error | Admin guard |
|------|-------------------------|-------------|
| Models | ⚠️ Basic | ✅ |
| Pricing Records | ⚠️ Basic | ✅ |
| Routing + Simulator | ✅ Client component | ✅ |
| Margins | ✅ Existing | ✅ |
| API Keys | ✅ Existing dashboard | ✅ |
| AI Audit | ⚠️ Basic list | ✅ |
| Security Events | ⚠️ Basic list | ✅ |
| Providers | ✅ Existing | ✅ |

---

## 11. Secret Scan Results

- Pattern scan `sk_live_[20+ chars]` in source: **no matches**
- Real Provider/Stripe keys: expected in env only (`.env.local` gitignored)
- **High-risk secret in repo:** none detected in scanned paths

---

## 12. Production Compatibility Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Migration not yet on Preview DB | **High** | Run `migrate deploy` on Preview clone |
| New tables required for legacy chat audit writes | **Medium** | Migration must precede deploy |
| Clerk placeholder keys | **Medium** | Real auth before public Preview |
| Policy engine accidental enable | **Low** | Default legacy |
| dailyBudget not enforced | **Low** | Document + follow-up |

**Stripe / existing billing paths:** unchanged core recharge; `stripeEventId` additive idempotency.

---

## 13. Outstanding Items

1. Execute `npx prisma migrate deploy` + seed on **real Preview PostgreSQL** (clone of Production schema).
2. Manual Preview QA: Admin pages, V1 API keys cross-org, routing simulator with VERIFIED prices.
3. Configure Preview env: real Clerk, `DATABASE_URL`, optional `ROUTING_ENGINE=policy`.
4. Implement `dailyBudget` enforcement (currently stub).
5. Full RBAC `canAccess()` enforcement for Viewer role.
6. E2E / integration tests for Stripe webhook and billing chain.
7. **No Release commit** until human sign-off after Preview migration PASS.

---

## 14. Deploy Preview Allowed?

**NO** — incremental migration not verified on a live Preview database in this session.

---

## 15. Deploy Production Allowed?

**NO** — explicitly out of scope for Phase 1 wrap-up.

---

## READY FOR PREVIEW VALIDATION?

| Criterion | Met |
|-----------|-----|
| build PASS | ✅ |
| lint 0 error | ✅ |
| typecheck 0 error | ✅ |
| tests PASS | ✅ |
| incremental migration generated | ✅ |
| Preview DB migration PASS | ❌ |
| no high-risk secrets | ✅ |
| no cross-tenant access (proven) | ⚠️ code review only |
| Stripe / Provider / Production paths intact | ✅ |

### Conclusion

**NOT READY FOR PREVIEW VALIDATION** until Preview DB `migrate deploy` succeeds.

**Next step for operator:** provision Preview DB → `DATABASE_URL=... npx prisma migrate deploy && npx prisma db seed` → smoke `/api/v1/health` + admin pricing → re-run this checklist item 14 = **YES**.

---

*No Production deployment performed. No Release commit created. Awaiting manual confirmation.*
