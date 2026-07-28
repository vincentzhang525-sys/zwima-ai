# ZWIMA AI — Provider Activation Runbook (GAP-015)

**DEFAULT:** do not enable new live providers.  
**OPENAI:** already proven historically (GAP-001) — do not re-spend to re-prove.

---

## 1. Pre-checks (safe)

```bash
cd zwima-v1
npx vitest run tests/providers
```

Confirm matrix doc + readiness reports show contract PASS for all five adapters.

---

## 2. Adding a key for a CONFIG_PENDING provider (operator)

1. Obtain key from the vendor console (operator-owned account — do **not** ask the product user to re-register for GAP proof).  
2. Set the env **name** only in Vercel Preview first (never paste values into git/chat/logs):
   - `GEMINI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `DEEPSEEK_API_KEY`
   - `QWEN_API_KEY`
3. Keep `LIVE_PROVIDER_CALLS_ENABLED` unset/false on Preview (`live-provider-gate` fail-closed).  
4. Re-run unit/readiness tests only — **no** mandatory live chat.  
5. Production enablement requires separate written authorization + `VERCEL_ENV=production` + `LIVE_PROVIDER_CALLS_ENABLED=true` (exact).

---

## 3. Disabling a provider

- Prefer DB/admin `DISABLED` or remove/rotate env key (Preview first).  
- Readiness filter treats `DISABLED` / missing key / `UNAVAILABLE` as non-routable.

---

## 4. Incident: vendor outage

1. Mark provider unavailable (admin status or remove from eligible set).  
2. Confirm routing fail-closed when no candidates remain.  
3. Do not bypass `chargeForUsage` or FX fail-closed (GAP-016).  
4. Do not log raw vendor payloads or secrets.

---

## 5. Forbidden

- Hardcoded API keys in source  
- Client-exposed secrets  
- Logging key bodies / connection strings  
- Real Stripe charges or Resend mail to “prove” providers  
- Merge to `main` as part of this gate  
- Re-running GAP-001 OpenAI live smoke solely for GAP-015  

---

## 6. Related code

| Path | Role |
|------|------|
| `src/lib/providers/registry.ts` | Lib adapter registry |
| `src/lib/providers/*` | OpenAI / Gemini / Claude / DeepSeek / Qwen adapters |
| `src/lib/providers/provider-readiness.ts` | GAP-015 readiness gate |
| `src/lib/providers/provider-errors.ts` | Customer-safe errors |
| `src/lib/providers/live-provider-gate.ts` | Live HTTP fail-closed |
| `docs/ZWIMA_AI_PROVIDER_READINESS_MATRIX.md` | Matrix |
