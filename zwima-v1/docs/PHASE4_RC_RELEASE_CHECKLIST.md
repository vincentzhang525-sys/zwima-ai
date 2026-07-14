# Phase 4 RC Release Checklist

**Release candidate:** Phase 4 — Customer Workspace  
**Preview URL:** https://zwima-f21rv0w6b-zwima.vercel.app  
**Deployment ID:** `dpl_EyuYHgFr8vd3RXiodpgZLkeXQavQ`  
**Date:** 2026-07-14  
**Infrastructure freeze:** Clerk / Google OAuth / Supabase / Prisma schema & migrations / Vercel env — **NO CHANGES**

---

## 1. Full regression

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | **PASS** (0 errors) |
| ESLint | `npm run lint` | **PASS** (0 errors; 2 warnings in ops scripts only) |
| Unit tests | `npm run test` | **PASS** (105/105, 20 files) |
| Production build | `npm run build` | **PASS** |
| Phase 4 E2E | `npm run e2e:phase4` | **PASS** (12/12, real Clerk Google OAuth) |

### E2E module matrix

| Module | Status |
|---|---|
| A — Dashboard overview | PASS |
| B — Workspace pages (8 routes) | PASS |
| C — Projects CRUD | PASS |
| D — API Keys create/mask/rotate | PASS |
| E — Playground 5 routing modes | PASS |
| J — API Key revoke | PASS |
| F — Usage + CSV export | PASS |
| G — Billing Preview Guard (403) | PASS |
| H — Logs security | PASS |
| I — Settings + Audit | PASS |
| Admin regression | PASS |
| Admin routing API | PASS |

---

## 2. Temp debug cleanup

**Removed (24 scripts):** one-off Preview/DB/env decrypt & diagnose utilities superseded by Playwright E2E and `/api/v1/preview-diag/env-db` (Preview-only, redacted).

**Removed:** local `*-out.txt` / `build-report.txt` artifact dumps from repo root.

**Kept (operational):**
- `scripts/vercel-build.mjs`, `bootstrap-smoke-user.mjs`, `qwen-probe.mjs`, `stripe-step2-verify.mjs`
- `scripts/e2e-auth.mjs`, `scripts/e2e-phase4.mjs`
- `scripts/preview-env-check.mjs`, `scripts/preview-list-deployments.mjs`
- Production smoke scripts (`production-smoke-test.mjs`, `phase6-final-smoke-test.mjs`)

---

## 3. Console error / warning audit (`src/`)

| Location | Type | RC disposition |
|---|---|---|
| `api/billing/checkout` | `console.error` on catch | **Keep** — server error logging |
| `api/auth/register` | `console.error` on catch | **Keep** |
| `lib/audit/ai-audit.ts` | `console.error` on write failure | **Keep** |
| `lib/env.ts` | `console.warn` placeholder Clerk in prod | **Keep** — safety guard |
| `lib/resend.ts` | `console.log` mock email dev | **Keep** — dev-only mock path |

No stray `console.log` debug in workspace UI or API routes.

---

## 4. Stability notes (non-blocking)

- **10× dashboard refresh:** `/dashboard` 10/10 HTTP 200; `/api/workspace/overview` 6–7/10 HTTP 200 under 1s rapid polling (transient timeout, not 500).
- **Stripe Preview:** `STRIPE_PREVIEW_DISABLED=true` — checkout/webhook/recharge return 403 `STRIPE_PREVIEW_DISABLED`.
- **PgBouncer:** runtime `DATABASE_URL` uses transaction pooler :6543 with `pgbouncer=true` (code-side, env unchanged).

---

## 5. RC gate

| Gate | Status |
|---|---|
| P0 defects | **None** |
| P1 defects | **None** |
| Architecture frozen | **Yes** |
| E2E green | **Yes** |
| Build green | **Yes** |

## **READY FOR PHASE 4 RC: YES**

## **READY FOR PHASE 5: YES** (after RC tag + production promotion plan)

---

## 6. Tag & next steps

```bash
git tag -a phase4-rc.1 -m "Phase 4 RC: Customer Workspace (E2E 12/12, infra frozen)"
git push origin phase4-rc.1
```

**Phase 5 entry criteria:**
1. Promote RC to production (or production-equivalent staging).
2. Enable Stripe on non-Preview environment per commercial runbook.
3. Org isolation E2E (`phase4-isolation.spec.ts`) with second Google account.
4. Production smoke (`production-smoke-test.mjs`) against live providers.
