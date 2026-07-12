# Phase 3A — Implementation Precheck Report

**Date:** 2026-07-12 | **Status:** Complete — implementation authorized

---

## 1. Architecture documents reviewed

- `docs/architecture/PHASE1_ENTERPRISE_PLATFORM_VISION.md`
- `docs/product/PHASE2_PRODUCT_BUSINESS_SUMMARY.md` + all 17 product docs
- Sprint 46A audit reports (`PROJECT_AUDIT_REPORT.md`, `BUSINESS_READINESS.md`)

---

## 2. Production paths inspected *(confirmed from code)*

| Path | Current behavior |
|------|------------------|
| Email | `api/lib/email/policy.js` — production falls back to `mock-fallback` when SMTP incomplete |
| SMTP send | `SmtpEmailProvider.js` — silent fallback to mock on send failure |
| Billing | `api/billing/index.js` — instant credit fulfillment via mock Stripe |
| Stripe | `StripePaymentProvider.js` — always returns `status: completed` (mock) |
| Legacy Stripe | `stripe/stripeService.js` — mock/test/live for old mockServer stack (not Vercel prod path) |
| Credits | `credit_wallets` + `credit_transactions` — no idempotency keys, no atomic deduct |
| Gateway deduct | `api/gateway/chat.js` — read-modify-write (race possible) |
| Admin adjust | `api/admin/users-credits.js` — no actor/reason fields |
| Legal | `impressum.html` — placeholder entity, not GmbH data |
| Webhook | **Missing** on Vercel API (`/api/billing/webhook` does not exist) |

---

## 3. Mock fallbacks reachable in production

| Fallback | Location | Risk |
|----------|----------|------|
| Email mock-fallback | `policy.js` resolveProviderKind | Silent — users think email sent |
| SMTP→mock on error | `SmtpEmailProvider.send` | Silent delivery failure |
| Stripe instant complete | `StripePaymentProvider` | Credits without real payment |
| Manual invoice | Always available | OK for enterprise assist |
| GenericMockPaymentProvider | mollie/lemonsqueezy | Not used in billing UI default |

---

## 4. Environment variable contracts

### Email (IONOS SMTP)
| Variable | Required when `EMAIL_PROVIDER=smtp` |
|----------|-------------------------------------|
| `EMAIL_PROVIDER` | `smtp` \| `ionos` |
| `SMTP_HOST` | Yes |
| `SMTP_PORT` | Default 587 |
| `SMTP_USER` | Yes |
| `SMTP_PASS` | Yes |
| `SMTP_FROM` | Yes |
| `SMTP_SECURE` | Default false |
| `EMAIL_DISABLE_SEND` | Optional skip |
| `COMMERCIAL_BETA_MODE` | Explicit opt-in for controlled beta mock email |

### Stripe
| Variable | Required when `STRIPE_MODE=test` | Required when `STRIPE_MODE=live` |
|----------|----------------------------------|----------------------------------|
| `STRIPE_MODE` | `mock` \| `test` \| `live` | same |
| `STRIPE_SECRET_KEY` | Yes | Yes (live key) |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Yes |
| `STRIPE_WEBHOOK_SECRET` | Yes | Yes |

### Providers (unchanged)
`OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `QWEN_API_KEY`

---

## 5. Rollback and migration safety

| Item | Plan |
|------|------|
| **Rollback point** | Git tag before Phase 3A deploy; Vercel instant rollback |
| **Schema migration** | Additive only — new columns nullable, new tables, SQL functions |
| **Credit balances** | No balance migration; ledger extends existing transactions |
| **Billing behavior** | `STRIPE_MODE=mock` preserves current instant-fulfill for beta |
| **Email behavior** | `COMMERCIAL_BETA_MODE=true` preserves beta mock until SMTP creds supplied |
| **Verify scripts** | Must pass on production with current env (mock stripe) |
| **Feature flag** | `COMMERCIAL_BETA_MODE` defaults true until founder disables |

---

## 6. Precheck verdict

**Proceed with implementation.** No customer balance changes. Mock paths isolated behind explicit env modes. Live/test modes fail closed when misconfigured.
