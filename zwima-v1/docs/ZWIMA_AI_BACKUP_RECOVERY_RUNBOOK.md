# ZWIMA AI — Backup & Recovery Runbook (GAP-014)

**STATUS:** ACTIVE  
**DEFAULT MODE:** dry-run  
**PRODUCTION RESTORE:** fail-closed in-repo (no live restore path in GAP-014 scripts)

---

## 0. Safety rules (read first)

1. Never paste secrets, `DATABASE_URL`, dumps, or customer PII into tickets/logs/chat.  
2. Never run `prisma migrate deploy` against Production from this runbook.  
3. Never set `DB_MIGRATION_AUTHORIZED=true` for a “recovery proof”.  
4. Never send real email, create real payment, or enable live Provider calls to prove DR.  
5. Recovery drill CLI defaults to dry-run and **refuses** `--target production`.  
6. Physical Supabase restore is an **operator console** action with separate executive authorization — not automated here.

---

## 1. Quick verification (safe, local)

```bash
cd zwima-v1
npm run backup:check
npm run recovery:drill
# equivalent:
npm run recovery:drill -- --dry-run --target preview
```

Expected:

- `BACKUP_CAPABILITY_CHECK=PASS`
- `DRY_RUN_RECOVERY_STATUS=PASS`
- `PRODUCTION_RECOVERY_FAIL_CLOSED=PASS`
- `PRODUCTION_DATABASE_MODIFIED=NO`

Negative check (must fail):

```bash
npm run recovery:drill -- --target production
# expect PRODUCTION_RECOVERY_FAIL_CLOSED / exit 1
```

---

## 2. Supabase database backups

### Capability

- Supabase manages automated backups / Point-in-Time Recovery (PITR) according to the project plan.  
- GAP-014 records this as a **platform capability** and documents operator steps; it does **not** download or restore Production data.

### Operator checklist (manual, outside CI)

1. Open Supabase project → Database → Backups / PITR.  
2. Confirm backup schedule / PITR window meets Closed Beta RPO.  
3. Record evidence externally (screenshot in secure ops store) — **do not commit** dumps or credentials to git.  
4. If restore is required: obtain written authorization → restore to a **non-Production** clone first when possible → only then consider Production with break-glass.

### Fail-closed

- In-repo scripts never call Supabase restore APIs.  
- Any attempt to select Production as drill target fails closed.

---

## 3. Prisma schema & migration recoverability

1. Confirm `prisma/schema.prisma` and all `prisma/migrations/*/migration.sql` exist in git.  
2. Run `npm run ci:prisma-validate` (validate only).  
3. Do **not** re-apply migrations that are already applied on Preview/Production solely to “prove” recovery.

Schema-only recovery path (Preview / new empty DB, authorized separately):

1. Provision empty non-Production database.  
2. Set local env to that database (never log URL).  
3. Use existing authorized migrate path for Preview only (`PREVIEW_DB_MIGRATE_AUTHORIZED`) — not covered as automatic GAP-014 execute.

---

## 4. Vercel environment variables

### Integrity check (names + scopes)

- Manifest: `docs/ZWIMA_AI_BACKUP_MANIFEST.md` §3  
- Automated: `npm run backup:check` prints `ENV_NAME_SCOPE` lines only  

### Forbidden

- Do not dump env values to logs.  
- Do not modify Production env vars as part of GAP-014.  
- Do not commit `.env`, `.env.local`, or pulled Vercel env files.

---

## 5. Preview rollback

1. Identify last known good Preview deployment id/url (Vercel dashboard or operator `preview-list-deployments` on a secured machine).  
2. Use Vercel UI **Rollback** / redeploy previous Preview deployment.  
3. Do **not** promote to Production from this runbook.  
4. After rollback: hit Preview health/public routes only; keep `PROVIDER_LIVE_CALLS_DISABLED` behavior.

---

## 6. Git commit / branch recovery point

```bash
git rev-parse --abbrev-ref HEAD   # expect v1-p0-commercial-loop for this workstream
git rev-parse --short HEAD
git status
```

To recreate app source at a known SHA (no DB touch):

```bash
git fetch origin
git switch --detach <known_good_sha>   # inspection only
# return to feature branch when done — do not merge main
```

---

## 7. Incident order (Closed Beta)

1. Stabilize: disable live spend paths if needed (feature flags / Preview disable) — no key rotation dump in chat.  
2. Capture git SHA + Vercel deployment id (ids only).  
3. Prefer Preview rollback before any database action.  
4. Database restore: Supabase console + authorization; never via GAP-014 execute.  
5. Re-run `npm run backup:check` and unit tests after mitigation.  
6. Update Completion Ledger only if process/code changed under an authorized GAP.

---

## 8. Related files

| File | Role |
|------|------|
| `docs/ZWIMA_AI_BACKUP_MANIFEST.md` | Inventory |
| `src/lib/ops/gap014-backup-recovery.ts` | Gate logic + redaction |
| `scripts/backup/gap014-backup-capability-check.ts` | Capability CLI |
| `scripts/recovery/gap014-recovery-drill.ts` | Dry-run drill CLI |
| `tests/backup-recovery/gap014-backup-recovery.test.ts` | Automated verification |
