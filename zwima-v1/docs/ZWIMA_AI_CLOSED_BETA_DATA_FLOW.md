# ZWIMA AI — Closed Beta Data Flow (GAP-011)

Scope: minimum commercial loop on Preview / Closed Beta. Not a counsel-approved DPIA.

## 1. Customer registration & identity

| Field / system | Purpose | Controller / processor notes | Retention (Closed Beta) |
|----------------|---------|------------------------------|-------------------------|
| Clerk user id, email, session | AuthN / AuthZ | Clerk processes identity; ZWIMA stores local `User` mirror (`clerkId`, `email`) | Account lifetime + manual deletion review |
| Organization membership | Team access | ZWIMA DB | Account / org lifetime |

No new Clerk users/orgs are created by GAP-011 automation.

## 2. API Key

| Data | Flow | Notes |
|------|------|-------|
| `sk_live_…` plaintext | Shown once at creation to customer | Never logged (`sanitizeForLog` redacts) |
| Key hash | Stored in DB; used for request auth | Commercial `/api/v1/*` requires current legal consent (fail-closed) |

## 3. Prompt / response

| Data | Flow | Notes |
|------|------|-------|
| Prompt / messages | Client → ZWIMA `/api/v1/chat` → model provider (e.g. OpenAI) | Transmitted for inference; **not** written to application logs |
| Response text | Provider → ZWIMA → client | Same; UsageLog stores tokens/cost metadata only, not full prompt bodies |
| Token estimates | May use message length in-memory for billing fallback | Bodies are not persisted on UsageLog |

## 4. UsageLog

Persists: userId, apiKeyId, provider, model, tokens, credits, latency, requestId, FX snapshot fields (when present).  
Does **not** persist full prompt/response text.

## 5. Billing / Stripe

| Data | Flow | Notes |
|------|------|-------|
| Checkout / PaymentIntent ids, amounts | Stripe + ZWIMA Payment/Transaction tables | Existing Stripe safety gates unchanged by GAP-011 |
| Secrets (`sk_…`, `whsec_…`) | Env only | Redacted from logs; no real charges initiated by GAP-011 |

## 6. Provider data transmission

| Provider | Categories | Region / transfer | Disclosure page |
|----------|------------|-------------------|-----------------|
| OpenAI (Closed Beta lock) | Prompt/response content, usage metadata | See `/legal/sub-processors` (draft) | Provider disclosure versioned in legal bundle |
| Infrastructure (Vercel, Supabase, Clerk, Stripe) | Account, ops, billing | Draft status on sub-processors page | Same |

## 7. Logs & retention

| Surface | Policy |
|---------|--------|
| Application / platform logs | No API keys, Stripe secrets, Bearer tokens, DB URLs, or full prompts (`sanitizeForLog`, `stripPromptBodies`) |
| Consent ledger | `LegalConsentAcceptance`: bundle + doc versions + `acceptedAt` (+ hashed IP / UA optional) |
| Deletion | `AccountDeletionRequest` queues `PENDING_MANUAL_REVIEW` — no auto-erase, no email send |

## 8. Consent fail-closed

1. Dashboard: unsigned users redirected to `/dashboard/accept-terms` before other dashboard routes.  
2. Commercial API: `validateV1ApiKey` → `assertCommercialApiConsent` → `403 TERMS_NOT_ACCEPTED` if current `LEGAL_BUNDLE_VERSION` not accepted.
