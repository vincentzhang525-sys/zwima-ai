# ZWIMA AI — Production Migration History Reconciliation Audit

**AUDIT_DATE:** 2026-07-29  
**AUDIT_MODE:** READ-ONLY (no DB writes, no migrate deploy/reset/db push)  
**DATASOURCE:** Production PostgreSQL at `db.tgvnvytgkqiwhdyxfphf.supabase.co:5432` (host only; credentials not stored)  
**EVIDENCE:** Terminal `7.txt` — `npx prisma migrate status` (exit 1, divergence detected)  
**COMPLETION_LEDGER:** `PASS_LOCKED` items preserved; no GAP re-implementation attempted

---

## 1. Executive Summary

Production database connection is **successful**, but Prisma migration history is **diverged** from the current worktree's `prisma/migrations` directory.

**Root cause:** The current branch worktree (`m8-agent-platform-phase2b/zwima-v1`) carries a **consolidated 8-migration chain** written for Preview/Closed-Beta, while Production was migrated from the **canonical 31-migration chain** in `Project_T/zwima-v1`. After the last common migration `20250714120000_phase2_commercial`, the two histories fork completely.

**Critical finding:** `prisma migrate deploy` is **unsafe** until history is reconciled. Blind deploy would attempt to re-create objects that already exist on Production under different migration names (M8, FX, RLS), risking partial failures or constraint conflicts.

**Immediate Production blocker:** `LegalConsentAcceptance` / `AccountDeletionRequest` tables (GAP-011) are **not** in Production migration history and are the confirmed cause of `/dashboard` SSR crash (Digest `4074842504`).

---

## 2. Prisma migrate status (parsed)

```
8 migrations found in prisma/migrations
Last common migration: 20250714120000_phase2_commercial

Not yet applied (local → Production):
  20260726120000_m8_agent_platform_phase1
  20260728170000_m4_fx_usage_log_additive
  20260728210000_gap004_usage_requestid_unique
  20260728220000_gap011_legal_consent
  20260729091000_preview_public_rls_hardening

Database-only (Production → local missing):
  20250715100000_clerk_rls_policies
  20250715130000_m5_model_registry
  20250715140000_m5_model_version_management
  20250715150000_m5_model_capability_management
  20250715160000_m5_model_deprecation_management
  20250715170000_m5_model_availability_management
  20250715180000_m5_model_health_history_management
  20250715190000_m5_model_release_channel_management
  20250715200000_m5_model_auto_discovery
  20250715210000_m5_provider_model_sync
  20250715220000_m5_model_lifecycle_api
  20250716010000_m6_1_compliance_foundation
  20250716100000_m6_2_ai_act_risk_engine
  20250716200000_m6_3_documentation_center
  20250716300000_m6_4_audit_evidence_center
  20250716400000_m6_5_compliance_automation
  20250716500000_m6_6_regulatory_change_management
  20250717010000_m7_enterprise_management_console
  20250719120000_v11_cost_engine          ← duplicate row in _prisma_migrations
  20250719130000_m5_model_migration_policy
  20250719140000_v11_m6_compliance_center
  20250720010000_m8_agent_platform
  20250720020000_m9_workflow_automation
  20250720030000_m10_enterprise_dashboard
  20260721100000_v11_frozen_architecture_enhancement
  20260721120000_m11_digital_infrastructure
  20260722100000_m8_m11_rls_security_gap_fix
  20260724120000_m4_fx_cost_margin_control
```

**Note:** Local directory also contains `20260726180000_m8_agent_platform_phase2a` (8th local migration) but Prisma status did **not** list it under "not yet applied". Requires `_prisma_migrations` row-level query to explain (possible ordering/checksum edge case).

---

## 3. Local migration inventory (worktree)

| Migration | Purpose | Category |
|-----------|---------|----------|
| `20250713180000_phase1_infra` | Base infra | **A** — common with Production |
| `20250714120000_phase2_commercial` | Commercial loop | **A** — last common |
| `20260726120000_m8_agent_platform_phase1` | AgentToolBinding, AgentExecutionLog | **C** — local rename; Production has `20250720010000_m8_agent_platform` |
| `20260726180000_m8_agent_platform_phase2a` | AgentTemplate, AgentMemoryPolicy, Phase2A fields | **C** — likely superseded by frozen-arch / M11 migrations on Production |
| `20260728170000_m4_fx_usage_log_additive` | UsageLog FX columns, FxRateSnapshot | **C** — Production has `20260724120000_m4_fx_cost_margin_control` (canonical, richer) |
| `20260728210000_gap004_usage_requestid_unique` | UsageLog.requestId UNIQUE | **C** — Preview-only per ledger; Production status unknown |
| `20260728220000_gap011_legal_consent` | LegalConsentAcceptance, AccountDeletionRequest | **C** — **must apply**; tables absent on Production |
| `20260729091000_preview_public_rls_hardening` | Preview RLS hardening | **PREVIEW-ONLY** — **must NOT apply to Production** |

---

## 4. Canonical migration source (read-only discovery)

Full Production-aligned migration files exist in:

`C:\Users\张文杰\Documents\Project_T\zwima-v1\prisma\migrations\` (**31 migrations**)

This canonical tree contains all 28 unique Production `_prisma_migrations` names (except GAP-004/GAP-011 which are worktree-only additions). It does **not** contain `LegalConsentAcceptance` — confirming GAP-011 is genuinely new and not yet on Production.

---

## 5. Divergence classification

### A. Database and local both exist and consistent
| Migration | Status |
|-----------|--------|
| `20250713180000_phase1_infra` | Applied on both sides |
| `20250714120000_phase2_commercial` | Last common migration |

### B. Database exists, local missing (restore from canonical repo)
**Count: 28 unique** (29 rows including duplicate `20250719120000_v11_cost_engine`)

These must be **restored to Git** from `Project_T/zwima-v1/prisma/migrations/` — not re-executed on Production.

| Migration | Production role |
|-----------|-----------------|
| `20250715100000_clerk_rls_policies` | Clerk RLS baseline |
| `20250715130000` – `20250715220000` | M5 model registry lifecycle |
| `20250716010000` – `20250716500000` | M6 compliance modules |
| `20250717010000_m7_enterprise_management_console` | M7 console |
| `20250719120000_v11_cost_engine` | V11 cost engine (**duplicate apply row — audit required**) |
| `20250719130000_m5_model_migration_policy` | Migration policy |
| `20250719140000_v11_m6_compliance_center` | Compliance center |
| `20250720010000_m8_agent_platform` | Full M8 schema (supersedes worktree phase1) |
| `20250720020000_m9_workflow_automation` | M9 |
| `20250720030000_m10_enterprise_dashboard` | M10 |
| `20260721100000_v11_frozen_architecture_enhancement` | Frozen arch |
| `20260721120000_m11_digital_infrastructure` | M11 infra |
| `20260722100000_m8_m11_rls_security_gap_fix` | Production RLS security fix |
| `20260724120000_m4_fx_cost_margin_control` | Production FX (supersedes worktree m4_fx additive) |

### C. Local exists, database not applied
| Migration | Safe to deploy on Production? | Reason |
|-----------|-------------------------------|--------|
| `20260726120000_m8_agent_platform_phase1` | **NO** — resolve only | Objects exist via `20250720010000_m8_agent_platform` |
| `20260726180000_m8_agent_platform_phase2a` | **INVESTIGATE** | Phase2A objects may exist via frozen-arch migrations |
| `20260728170000_m4_fx_usage_log_additive` | **NO** — resolve only | FX exists via `20260724120000_m4_fx_cost_margin_control` |
| `20260728210000_gap004_usage_requestid_unique` | **CONDITIONAL** | Apply only if `UsageLog_requestId_key` unique index missing |
| `20260728220000_gap011_legal_consent` | **YES** | Tables confirmed missing; fixes dashboard crash |
| `20260729091000_preview_public_rls_hardening` | **NO — PREVIEW ONLY** | Explicitly excluded from Production |

### D. Same name, checksum mismatch
**Count: 0 confirmed** (cannot verify without `_prisma_migrations.checksum` query; no overlapping migration names between local-only and database-only sets)

### E. Failed / unfinished / rolled-back
**Count: UNKNOWN** — requires read-only query:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs
FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL OR logs IS NOT NULL
ORDER BY started_at;
```

**Flag:** Duplicate `20250719120000_v11_cost_engine` row — investigate whether one entry is failed/duplicate apply.

---

## 6. Production schema object audit (inferred + prior incident evidence)

| Object | Expected on Production | Evidence | Status |
|--------|------------------------|----------|--------|
| M8 Phase 1 tables (`AgentDefinition`, `AgentMemory`, `AgentRun`, …) | YES | `20250720010000_m8_agent_platform` applied | **LIKELY EXISTS** — confirm via `to_regclass` |
| M8 Phase 1 worktree extras (`AgentToolBinding`, `AgentExecutionLog`) | MAYBE | Only in worktree phase1 migration | **UNKNOWN** — may need additive apply if missing |
| UsageLog FX columns (`providerCurrency`, `costInEur`, `fxRateStatus`, …) | YES | `20260724120000_m4_fx_cost_margin_control` applied | **LIKELY EXISTS** |
| `UsageLog.requestId` UNIQUE constraint | UNKNOWN | GAP-004 Preview-only per ledger | **VERIFY** — `pg_indexes` for `UsageLog_requestId_key` |
| `LegalConsentAcceptance` | NO | Dashboard SSR crash; not in Production migration history | **MISSING — CONFIRMED** |
| `AccountDeletionRequest` | NO | Same GAP-011 migration | **MISSING — CONFIRMED** |
| RLS enabled on business tables | PARTIAL | `clerk_rls_policies` + `m8_m11_rls_security_gap_fix` on Production | **PARTIAL** — differs from Preview hardening migration |

### Recommended read-only verification SQL (run in user's PowerShell session)

```sql
-- Table existence
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND relname IN ('LegalConsentAcceptance','AccountDeletionRequest','AgentDefinition','AgentToolBinding','AgentExecutionLog','UsageLog')
ORDER BY 1;

-- UsageLog FX columns
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='UsageLog'
  AND column_name IN ('providerCurrency','costInEur','fxRateStatus','requestId')
ORDER BY 1;

-- requestId unique constraint
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='UsageLog' AND indexdef ILIKE '%requestId%';

-- RLS status
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('User','Organization','UsageLog','LegalConsentAcceptance','AgentDefinition')
ORDER BY 1;
```

---

## 7. Safe recovery plan (no writes until authorized)

### Phase 1 — Git history restore (NO Production DB writes)
1. Copy all 28 missing migration directories from canonical `Project_T/zwima-v1/prisma/migrations/` into this branch's `prisma/migrations/`.
2. Retain worktree-only migrations: `gap004`, `gap011`, and keep `preview_rls` marked Preview-only (do not deploy to Production).
3. Remove or archive conflicting worktree renames (`20260726120000_m8_agent_platform_phase1`, `20260728170000_m4_fx_usage_log_additive`) **only after** confirming Production equivalents are restored and `prisma migrate status` shows them as applied.
4. Commit restored migrations to `main` (Git write only).

### Phase 2 — Read-only Production verification
1. Re-run `npx prisma migrate status` — expect divergence to collapse to ≤3 pending items.
2. Run schema object SQL above.
3. Query `_prisma_migrations` for failed/duplicate rows.

### Phase 3 — Targeted Production apply (requires separate authorization)
1. **Apply:** `20260728220000_gap011_legal_consent` only (fixes dashboard).
2. **Conditional apply:** `20260728210000_gap004_usage_requestid_unique` if unique index missing.
3. **Never apply:** `20260729091000_preview_public_rls_hardening` on Production.
4. **Never re-execute:** M8, FX, RLS migrations already recorded in Production `_prisma_migrations`.
5. **Do not use:** `migrate reset`, `db push`, batch `migrate resolve`.

### Phase 4 — Post-apply acceptance
- `/login` 200
- Authenticated `/dashboard` 200 (no Digest `4074842504`)
- `LegalConsentAcceptance` + `AccountDeletionRequest` exist
- RLS spot-check (service_role OK; anon denied)
- GitHub CI green

---

## 8. Counts summary

| Metric | Value |
|--------|-------|
| Local migrations (worktree) | 8 |
| Production database-only (unique) | 28 |
| Production database-only (rows, incl. duplicate) | 29 |
| Local-only pending (Prisma status) | 5 |
| Checksum mismatches (confirmed) | 0 (unverified — needs DB checksum column) |
| Failed migrations (confirmed) | UNKNOWN |
| Preview-only migrations | 1 (`20260729091000_preview_public_rls_hardening`) |
| Production-critical missing migration | 1 (`20260728220000_gap011_legal_consent`) |

---

## 9. Blockers

1. **Migration history fork** — worktree 8-migration chain ≠ Production 31-migration chain.
2. **Direct `migrate deploy` forbidden** — would attempt duplicate M8/FX DDL.
3. **`_prisma_migrations` deep audit incomplete** — agent shell unavailable; full row metadata (checksum, failed rows) not yet queried.
4. **Duplicate `v11_cost_engine` row** — requires investigation before any resolve operations.

---

**END OF READ-ONLY AUDIT — awaiting explicit authorization for Phase 1 (Git restore) or Phase 3 (targeted Production apply).**
