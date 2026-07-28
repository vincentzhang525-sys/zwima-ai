# ZWIMA AI — V1 Critical Path (Frozen Architecture)

**AUDIT_DATE:** 2026-07-28  
**AUDIT_BASE_COMMIT:** `a728f19` (`m8-agent-platform-phase2b`)  
**Companions:**  
- `docs/ZWIMA_AI_FROZEN_ARCHITECTURE_FULL_AUDIT.md`  
- `docs/ZWIMA_AI_LAUNCH_GAP_REGISTER.md`

---

## 1. Where we actually are

**Stage label:** **Internal Preview capable / Closed Beta not ready**

- M8 Phase 1 → 2A → 2B Preview acceptance completed on this branch (mock agents + memory security + team invite).
- V1 commercial closed loop is **implemented in code** but **not continuously proven** end-to-end on Preview (live providers + Stripe fail-closed by design) and **not re-proven** on Production in this audit.
- M9–M11 are largely schema/UI/infra-incomplete relative to frozen ambitions.
- **M8 Phase 2C is not an authorized named phase in-repo** — do not start it from this audit.

---

## 2. Distance to Internal Preview (narrow)

Already largely met for:
- Preview deploys READY on `zwima-ai`
- Clerk Development dual-user auth
- Fail-closed providers / Stripe on Preview
- M8 mock agent + memory security acceptance

Still useful to tighten (optional for internal only):
- Document Preview “known blocked” surfaces (live chat, Stripe checkout)
- Keep Preview DB migrations authorized only under explicit flag

---

## 3. Distance to Closed Beta

Must close **P0 + P1** from gap register, especially:
1. Production Clerk verification (GAP-003)
2. Fresh Production provider smoke under change control (GAP-015 / GAP-001)
3. Stripe test/live playbook + idempotent credits (GAP-002 / GAP-004)
4. Keep `isRoutableStatus` gate; complete deprecation/migration policy wiring (GAP-010)
5. Wire FX snapshot onto billed chat path **or** formally defer (GAP-016)
6. Minimal compliance runtime checklist (GAP-011)
7. Viewer RBAC E2E (GAP-012)
8. CI + backup/restore evidence (GAP-013 / GAP-014)
9. Document dual routing stacks (v1 core vs playground smart) for ops

**Do not require** for Closed Beta:
- M9 Workflow product
- M8 live agents / MCP / workspace memory
- Full M10 analytics polish

---

## 4. Distance to Public Production

After Closed Beta stability:
- Full FX/margin reconciliation (GAP-023)
- Public legal/process completeness + DE locale/mobile (GAP-024)
- Dashboard provenance (GAP-025)
- Load/security hardening (GAP-031)
- Sustained real-customer observation period (L6 evidence)

---

## 5. Shortest critical path (V1 commercial)

```
A. Freeze feature work (no Phase 2C / M9 expansion)
B. Verify Production auth + provider smoke + Stripe test path (read-only/cheap)
C. Harden credits atomic debit + concurrency tests
D. Enforce model availability on /api/v1/chat
E. Minimal GDPR/AI Act V1 runtime checklist + DSAR procedure
F. CI gates + backup/restore drill record
G. Closed Beta cohort (invite-only) with support mailbox + kill switches
H. Observe billing accuracy for N days
I. Public launch decision gate
```

---

## 6. What can wait (does not block V1 API billing)

| Module | Defer? | Why |
|--------|--------|-----|
| M8 Phase 2C workspace memory | YES | Explicitly deferred; security-sensitive |
| M8 live agents / MCP / skills | YES | Not needed for unified API credits loop |
| M9 Workflow | YES | Schema-only; huge scope |
| M10 advanced dashboards | PARTIAL | Need basic usage/billing; fancy KPIs later |
| M11 full DR/load | PARTIAL | Need backup+CI before beta; full load later |

---

## 7. What must NOT expand before V1 launch

- New top-level modules beyond M1–M11 freeze
- Workflow builder productization
- Multi-agent orchestration
- Arbitrary HTTP/shell tools
- Enabling WORKSPACE memory without real workspace context
- Turning on live providers in Preview without explicit security policy

---

## 8. Effort ranges (solo + Cursor)

**Assumptions:** one operator; Cursor-assisted; no hiring; Production changes only under explicit approval; no inventing Phase 2C mid-flight.

| Path | Optimistic | Baseline | Conservative |
|------|------------|----------|--------------|
| Closed Beta gate (P0+P1) | 1.5–2.5 weeks | 3–5 weeks | 6–8 weeks |
| Public launch after beta | +2–4 weeks | +4–6 weeks | +8–12 weeks |

**Not calendar promises.** Slippage drivers: Clerk/Stripe/provider credential access, legal review, concurrency bugs, Production change freezes.

---

## 9. Recommended next authorization (human)

Choose **one**:
1. **Remediation track:** Closed Beta P0/P1 only (recommended)
2. **Re-verify Production:** smoke + Clerk + Stripe under production change control
3. **Explicitly name next feature phase** (e.g. Phase 2C workspace memory) — only after freeze audit accepted

**Forbidden without new authorization:** start M8 Phase 2C, M9, or any new architecture.

---

## 10. V1_CRITICAL_PATH (one-liner)

**Prove Production auth + live chat debit + Stripe credits safely, enforce model/compliance gates, add CI/backup — defer agents/workflows/workspace-memory until after Closed Beta.**
