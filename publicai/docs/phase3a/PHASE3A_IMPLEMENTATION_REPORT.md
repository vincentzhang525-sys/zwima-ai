# Phase 3A — Implementation Report

**Date:** 2026-07-12  
**Commit message:** `feat(phase3a): harden commercial activation foundation`

---

## Summary

Phase 3A hardens commercial activation paths without activating live Stripe or production SMTP. Controlled Public Beta behavior is preserved via `COMMERCIAL_BETA_MODE=true` (default).

---

## Changes

| Area | Change |
|------|--------|
| Email | Fail-closed production SMTP; mock only in dev/preview/beta mode; no silent SMTP→mock in production SMTP mode |
| Stripe | Real checkout/webhook architecture; mock instant fulfill when `STRIPE_MODE=mock` |
| Credits | Atomic RPC functions; idempotency keys; ledger reconciliation |
| Legal | Central `companyConfig.js`; Impressum updated with confirmed GmbH address |
| Admin | Commercial Activation Health panel |
| Migration | `20260712140000_phase3a_commercial_activation.sql` |

---

## Rollback

1. Vercel → Deployments → Promote previous deployment  
2. Git revert commit  
3. DB: migration is additive — rollback optional  

---

## Post-deploy

Run migration: `POST /api/db/migrate` with `SUPABASE_SEED_SECRET`  
Founder supplies SMTP + Stripe env vars in Vercel when ready.
