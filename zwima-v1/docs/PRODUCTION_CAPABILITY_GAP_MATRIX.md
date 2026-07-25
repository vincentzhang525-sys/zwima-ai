# Production Capability Gap Matrix

**Generated:** 2026-07-25  
**Targets compared:**
- **A.** Live Production `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v` (compiled route inventory; source unavailable)
- **B.** Remediation Preview commit `0157570f27106c394537da95faeff0999a18f17f`
- **C.** Frozen architecture M1–M11 (docs + schema presence)

**Legend**
- Presence: YES / NO / PARTIAL
- Confidence: VERIFIED / INFERRED / UNKNOWN
- Action: KEEP / REBUILD / EXCLUDE / DEFER

> Production file count 1457 is Lambda/function outputs, not source files. Shared digest bundles mean many routes ≠ many source trees.

---

## Explicit capability inspection

| Capability | Production | Remediation 0157570 | Known source | Auth | DB write | External provider | Reconstruction | Confidence | Action |
|---|---|---|---|---|---|---|---|---|---|
| `/api/v1/agents/**` | YES (401) | NO (404) | dirty `src/app/api/v1/agents`, `src/lib/agents` (mock-provider) | Clerk/workspace | YES on mutate/seed | NO live LLM (mock only) | REBUILD into curated | VERIFIED | REBUILD |
| `/api/v1/agents/seed` | YES | NO | same + gated seed | Auth + `AGENT_SEED_AUTHORIZED` | YES | NO | REBUILD gated (Preview blocked) | VERIFIED | REBUILD |
| `/api/v1/chat` | YES | YES (fail-closed) | remediation `src/app/api/v1/chat` | API key / session | YES usage | Gate: live only prod+flag | KEEP | VERIFIED | KEEP |
| `/api/v1/health` | YES (live online JSON) | YES (blocked, RO) | remediation health route | Public | NO writes | Probe only if gate open | KEEP curated RO | VERIFIED | KEEP |
| `/api/v1/packages` | YES | YES (Preview-safe) | remediation packages | Mixed | NO on GET Preview | NO | KEEP | VERIFIED | KEEP |
| `/api/v1/models` | YES | YES | remediation | Public/auth mix | NO on GET | NO | KEEP | VERIFIED | KEEP |
| `/api/v1/providers` | YES | YES | remediation | Admin/auth | Config reads | Status via gate | KEEP | VERIFIED | KEEP |
| Clerk auth pages (`/login`, `/signup`, `/forgot-password`) | YES | YES (incl. forgot-password) | remediation auth pages | Public | NO | Clerk | KEEP | VERIFIED | KEEP |
| Resend / email routes | PARTIAL (admin email test in inventory) | PARTIAL | remediation + dirty admin email | Admin | Audit possible | Resend if configured | DEFER full Resend ops | INFERRED | DEFER |
| Stripe checkout / webhooks | YES | YES + Preview guard | remediation stripe + preview guard | Auth/webhook sig | YES on paid events | Stripe blocked Preview | KEEP gated | VERIFIED | KEEP |
| UsageLog persistence | YES | YES | schema + chat/billing path | Auth | YES on usage | N/A | KEEP | VERIFIED | KEEP |
| API key management | YES | YES | remediation api-keys routes | Auth | YES create/revoke | NO | KEEP | VERIFIED | KEEP |
| Billing / credits | YES | YES | remediation billing | Auth | YES recharge/checkout | Stripe gated | KEEP | VERIFIED | KEEP |
| Admin routes (core) | YES (large set) | PARTIAL (subset) | remediation admin pages/APIs | Admin | YES on mutate | Mixed | KEEP existing; DEFER enterprise/infra sprawl | INFERRED | KEEP / DEFER |
| Admin Agents APIs | YES | NO | dirty `api/admin/agents*` | Admin | YES | NO live LLM | REBUILD | VERIFIED | REBUILD |
| Provider adapters / gateway | YES | YES + live gate | remediation providers + core adapters | Auth | Health RO | Fail-closed | KEEP | VERIFIED | KEEP |
| Core API / gateway | YES | YES | remediation v1 routes | Mixed | Explicit ops | Gate | KEEP | VERIFIED | KEEP |
| M4 FX cost-control UI | UNKNOWN in Prod UI (FX schema likely live) | NO | dirty `dashboard/admin/fx-cost-control` + client | Admin | Read APIs only | NO outbound FX HTTP in provider | REBUILD read models | VERIFIED | REBUILD |
| M4 FX APIs (`/api/v1/admin/cost-optimization/fx-*`) | PARTIAL (cost-optimization paths in inventory) | NO | dirty FX admin API routes + `lib/fx` | Admin | READ list; no migrate | NO live FX fetch in `fx-rate-provider` | REBUILD | VERIFIED | REBUILD |
| M8 Agents dashboard UI | YES | NO | dirty dashboard/agents (+ minimal overview stub) | Auth | Via APIs | Mock | REBUILD (no enterprise overview) | VERIFIED | REBUILD |
| M9 Workflows | YES in Prod inventory | PARTIAL/NO | dirty workflows | Auth | YES | NO | EXCLUDE from curated (scope) | INFERRED | EXCLUDE |
| M10 Enterprise dashboard | YES in Prod inventory | NO | dirty enterprise | Admin | YES | NO | EXCLUDE (stub overview only) | INFERRED | EXCLUDE |
| M11 Infra/ops | YES in Prod inventory | NO | dirty infra APIs | Admin | YES | Mixed | EXCLUDE | INFERRED | EXCLUDE |
| Auto migrate on build | UNKNOWN historically | NO (`vercel-build` generate+next only) | `scripts/vercel-build.mjs` | N/A | NO | NO | KEEP | VERIFIED | KEEP |
| Auto seed on build | UNKNOWN historically | NO | no seed in vercel-build | N/A | NO | NO | KEEP; agent seed gated | VERIFIED | KEEP |

---

## Grouped Production inventory vs curated actions

| Group | Prod unique paths (approx) | Curated action |
|---|---:|---|
| Public pages | inventory | KEEP from remediation |
| Authentication pages | inventory | KEEP (incl. forgot-password) |
| Dashboard pages | large | KEEP remediation + REBUILD agents pages |
| Admin pages | large | KEEP remediation + REBUILD fx-cost-control; DEFER/EXCLUDE M9–M11 admin sprawl |
| API routes | 341+ | KEEP remediation core |
| Agents APIs | 11 | REBUILD |
| Core API/gateway | chat/models/providers/health/packages | KEEP |
| Provider routes | inventory | KEEP + fail-closed gate |
| Billing/packages | inventory | KEEP + Stripe Preview block |
| Webhooks | Stripe | KEEP gated |
| Health/monitoring | health | KEEP read-only |
| Static/generated `.rsc` / `_` | ~729 markers | EXCLUDE (framework outputs, not source) |

---

## Confidence rollup (capability rows above)

| Confidence | Count (approx) |
|---|---:|
| VERIFIED | 18 |
| INFERRED | 6 |
| UNKNOWN | 2 (Resend depth; historical auto-migrate/seed on dirty Prod deploy) |

---

## Reconstruction policy applied

Include only when **all** hold:
1. Required for functioning Production surface **or** frozen M1–M7 (+ M8 Agents mock + M4 FX read admin as authorized)
2. Source traced to known local dirty files or commit `0157570`
3. No embedded secrets
4. No auto migrate / auto seed
5. No default-open live provider
6. Auth + DB write safety review passed

**Excluded from curated candidate:** M9 workflows platform, M10 enterprise dashboard (except minimal agents overview stub), M11 infrastructure consoles, unknown generated/backup/env artifacts, full dirty workspace.

**M4 note:** FX schema already present in Production DB / remediation schema. Curated candidate includes read-oriented FX admin APIs/UI only. **Do not** re-run FX migration.
