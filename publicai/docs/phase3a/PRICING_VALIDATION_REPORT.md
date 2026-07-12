# Phase 3A — Pricing Validation Report

**Status:** PROPOSAL — not commercially approved  
**Date:** 2026-07-12

> Included credit quantities on public pages remain **proposed** until unit economics are verified and founder-approved.

---

## Provider cost assumptions *(proposed)*

| Provider | Model example | Input / 1M tokens | Output / 1M tokens | Source |
|----------|---------------|------------------:|-------------------:|--------|
| OpenAI | gpt-4o | $2.50 | $10.00 | Public list price *(verify at launch)* |
| Google | gemini-2-flash | $0.10 | $0.40 | Public list price *(verify at launch)* |
| Claude | claude-sonnet | $3.00 | $15.00 | Public list price *(verify at launch)* |
| DeepSeek | deepseek-chat | $0.28 | $0.42 | Public list price *(verify at launch)* |
| Qwen | qwen-plus | $0.40 | $1.20 | Estimate *(verify)* |

**FX assumption:** 1 USD ≈ 0.92 EUR *(update weekly)*

---

## Credits conversion assumptions *(proposed)*

| Rule | Value |
|------|-------|
| Customer-facing unit | ZWIMA Credits |
| Internal mapping | 1 credit ≈ 1 token equivalent for metering simplicity |
| Target gross margin | 25–35% blended |
| VAT | 19% Germany (B2C); reverse charge B2B EU with valid VAT ID |

**Example:** 1M tokens mixed usage at €3 provider cost → charge ~€4.00–€4.50 equivalent in credits (25–33% margin).

---

## Plan economics *(PROPOSED — not approved)*

| Plan | Fee | Included credits | Implied provider cost @ 30% margin | Risk |
|------|-----|-----------------:|-------------------------------------:|------|
| Developer | €0 | 500 | ~€0.35 | Abuse / free tier farming |
| Startup | €29 | 20,000 | ~€8–10 | Heavy coders on cheap models |
| Business | €99 | 100,000 | ~€40–50 | Team sharing keys |
| Enterprise | Custom | Custom | Negotiated | SLA + support cost |

---

## Worst-case provider mix

Scenario: 100% OpenAI gpt-4o output-heavy traffic  
→ Provider cost dominates; margin can drop below 10% without routing to Gemini/DeepSeek.

**Mitigation:** Intelligent routing (Phase 3A rules engine), plan caps, rate limits.

---

## Tax treatment assumptions

| Case | Treatment |
|------|-----------|
| DE B2C | 19% VAT on digital services |
| DE B2B | VAT on invoice if no valid USt-IdNr. |
| EU B2B | Reverse charge with valid VAT ID |
| Non-EU | Export rules — legal review required |

---

## Break-even usage *(proposed)*

Fixed monthly infra ~€200–€500 (Vercel + Supabase + email) at current scale.  
Break-even ≈ **15–25 paying Startup customers** OR equivalent credit top-up revenue.

---

## Risks

1. **Underpriced unlimited routing** — Professional/Business "all models" without caps  
2. **Credit = token 1:1** — heavy users on expensive models unprofitable  
3. **Mock payment period** — no real margin data until Stripe live  
4. **Provider price changes** — 30-day review cadence required  

---

## Founder approval required

- [ ] Final credits per plan  
- [ ] Credit-to-EUR display ratio  
- [ ] Minimum margin floor (e.g. 20%)  
- [ ] VAT ID and invoice legal text  
