# ZWIMA AI — Backup Manifest (GAP-014)

**STATUS:** ACTIVE  
**BRANCH:** `v1-p0-commercial-loop`  
**SCOPE:** Closed Beta launch gate — capability inventory only  
**RULE:** Never store secret values, connection strings, dumps, or customer PII in this document.

---

## 1. Database (Supabase / Postgres)

| Capability | Evidence / expectation | Production data touched by GAP-014 scripts? |
|------------|------------------------|-----------------------------------------------|
| Automated backups | Supabase project backups (plan-dependent daily backups) | NO |
| Point-in-Time Recovery (PITR) | Supabase PITR when enabled on project plan | NO — operator console only |
| Schema recoverability | `prisma/schema.prisma` + `prisma/migrations/*` in git | NO |
| Migration replay | Numbered folders with `migration.sql` + `migration_lock.toml` | NO — validate only in CI |

**Operator note:** Physical restore of Production must use Supabase dashboard / authorized break-glass process **outside** GAP-014 scripts. Scripts always **fail-closed** for Production restore.

---

## 2. Prisma recovery artifacts (in-repo)

| Artifact | Path |
|----------|------|
| Schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/<timestamp>_<name>/migration.sql` |
| Lock | `prisma/migrations/migration_lock.toml` |
| Validate gate | `npm run ci:prisma-validate` (no migrate deploy) |

---

## 3. Vercel environment variable names (names + scopes only)

Values are **never** listed here. Completeness is checked against `.env.example` + code manifest in `src/lib/ops/gap014-backup-recovery.ts`.

| Name | Scopes |
|------|--------|
| DATABASE_URL | production, preview |
| DIRECT_URL | production, preview |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | production, preview, development |
| CLERK_SECRET_KEY | production, preview, development |
| CLERK_WEBHOOK_SECRET | production, preview |
| STRIPE_SECRET_KEY | production, preview |
| STRIPE_PUBLISHABLE_KEY | production, preview |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | production, preview, development |
| STRIPE_WEBHOOK_SECRET | production, preview |
| STRIPE_CREDIT_PRICE_ID | production, preview |
| RESEND_API_KEY | production, preview |
| RESEND_FROM_EMAIL | production, preview |
| NEXT_PUBLIC_APP_URL | production, preview, development |
| OPENAI_API_KEY | production, preview |
| INTERNAL_SERVICE_ROLE_KEY | production, preview |

**GAP-014 check:** prints `ENV_NAME_SCOPE name=scope|scope` only — never values.

---

## 4. Preview deployment rollback

| Item | Location / method |
|------|-------------------|
| List recent Preview deployments | `scripts/preview-list-deployments.mjs` (operator machine; do not log tokens) |
| Rollback procedure | See `docs/ZWIMA_AI_BACKUP_RECOVERY_RUNBOOK.md` § Preview rollback |
| Production promote | **Out of scope** for GAP-014 dry-run |

---

## 5. Git recovery points

| Item | Value source |
|------|----------------|
| Feature branch | `v1-p0-commercial-loop` |
| Commit SHA | `git rev-parse HEAD` |
| Remote | `origin/v1-p0-commercial-loop` |
| Forbidden | merge `main` as part of GAP-014 |

---

## 6. Automated gates

| Script | Default | Production restore |
|--------|---------|--------------------|
| `npm run backup:check` | read-only capability audit | N/A |
| `npm run recovery:drill` | `--dry-run` | **always refuse** |
| Unit tests | `tests/backup-recovery/` | N/A |

---

## 7. Explicit non-goals (GAP-014)

- No real Production database restore  
- No Production env value mutation  
- No real Stripe charge / Resend email / live Provider call  
- No re-running already locked migrations as “proof”  
- No GAP-015 provider retest  
