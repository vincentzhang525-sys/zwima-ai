# ZWIMA AI — Provider Readiness Matrix (GAP-015)

**STATUS:** ACTIVE  
**BRANCH:** `v1-p0-commercial-loop`  
**RULE:** No new live Provider calls for proof. OpenAI live evidence is historical (GAP-001). Never print secret values.

---

## Focus providers

| Provider | Adapter slug | Env key (name only) | Currency | EU available | Historical live evidence | Expected verdict without re-spend |
|----------|--------------|---------------------|----------|--------------|--------------------------|-----------------------------------|
| OpenAI | `openai` | `OPENAI_API_KEY` | USD | YES | YES (GAP-001) | `PASS` |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | USD | YES | NO | `PASS_OR_CONFIG_PENDING` |
| Anthropic Claude | `claude` | `ANTHROPIC_API_KEY` | USD | YES | NO | `PASS_OR_CONFIG_PENDING` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` | USD | NO | NO | `PASS_OR_CONFIG_PENDING` |
| Alibaba Qwen | `qwen` | `QWEN_API_KEY` | USD | NO | NO | `PASS_OR_CONFIG_PENDING` |

---

## Gate dimensions

| Dimension | Implementation |
|-----------|----------------|
| Registry | `src/lib/providers/registry.ts` + `src/core/providers/registry.ts` |
| Adapter contract | `ProviderAdapter` in `src/lib/providers/types.ts` / `contracts.ts` |
| Readiness / routing filter | `src/lib/providers/provider-readiness.ts` |
| Error normalization | `src/lib/providers/provider-errors.ts` |
| Billing hot path | `chargeForUsage` in `src/lib/billing/credits-engine.ts` |
| FX hot path | GAP-016 inside `chargeForUsage` (reused, not rewritten) |
| Compliance metadata | catalog in `provider-readiness.ts` + `/legal/sub-processors` |
| Live HTTP gate | `src/lib/providers/live-provider-gate.ts` (fail-closed outside Production flag) |

---

## Routability rules (fail-closed)

A provider is **fully routable** only when all are true:

1. Adapter registered and contract methods present  
2. Gate status is `ACTIVE` (not `DISABLED` / `UNAVAILABLE`)  
3. Env key **name** is configured (value never logged)  
4. Compliance metadata complete (`dataRegion`, retention disclosure, sub-processor ref, EU flag, status ≠ `INCOMPLETE`)

Otherwise it is excluded from the candidate set. If **zero** providers remain → `NO_ROUTABLE_PROVIDER`.

`CONFIG_PENDING` means code/contract/compliance PASS but key absent — **not** a license to invent keys or buy quota.

---

## Automated verification

```bash
cd zwima-v1
npx vitest run tests/providers
npm run typecheck
npm run lint
```

---

## Explicit non-goals

- No re-run of OpenAI live smoke  
- No forced registration or top-up for Gemini/Claude/DeepSeek/Qwen  
- No Production env mutation  
- No M8 Phase 2C / M9 / Workspace Memory  
- No GAP-010 work in this change  
