# ZWIMA AI — Closed Beta Manual Release Checklist

**CREATED:** 2026-07-29  
**BRANCH:** `v1-p0-commercial-loop`  
**PROJECT:** Vercel `zwima-ai` (`prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B`)  
**MODE:** Manual release checklist only — no code, no GAP re-run, no Production mutate, no spend  
**RULE:** Never paste secret values into chat/git. Names and kinds only.

---

## Snapshot (auto + historical)

| Check | Result |
|-------|--------|
| Historical Completion | PASS — P0/P1 gaps NONE remaining |
| Domain `zwima-group.info` | DNS A present; HTTPS `200`; Vercel team domain listed |
| Production env **names** | Present for Clerk/Stripe/DB/OpenAI/live flags/SMTP/Resend (see §A) |
| Stripe webhook | Route + `STRIPE_WEBHOOK_SECRET` name on Production; Phase7/GAP-002 historical evidence |
| IONOS/SMTP | Policy **CONFIRMED:** `SYSTEM_EMAILS_ONLY_NO_MARKETING` |
| Cohort / credits / counsel | **CONFIRMED:** owner-only smoke; owner 1000 credits plan; legal draft accepted for Closed Beta |
| main merge / Production deploy | **WAITING** explicit passphrases |

---

## User decisions locked (2026-07-29)

| Key | Value | Status |
|-----|--------|--------|
| CANONICAL_DOMAIN_CONFIRMED | `zwima-group.info` | DONE |
| STRIPE_WEBHOOK_URL_CONFIRMED | `USE_EXISTING_ALREADY_COMPLETED_CONFIGURATION` | DONE |
| IONOS_SMTP_POLICY | `SYSTEM_EMAILS_ONLY_NO_MARKETING` | DONE |
| LEGAL_MANUAL_SIGNOFF | `LEGAL_DRAFT_ACCEPTED_FOR_CLOSED_BETA` | DONE |
| CLOSED_BETA_COHORT | `OWNER_ONLY_INITIAL_SMOKE_TEST` | DONE |
| MANUAL_CREDITS_PLAN | `OWNER_ACCOUNT_1000_CREDITS` | DONE (plan; grant not auto-run) |

See also: `docs/ZWIMA_AI_CLOSED_BETA_FINAL_AUTHORIZATION_SUMMARY.md`

---

## A. CURSOR_CAN_VERIFY_AUTOMATICALLY

### A1. Production domain DNS + HTTPS
| Field | Value |
|--------|--------|
| 当前状态 | `zwima-group.info` resolves; HTTPS HEAD **200**; `/login` **200** |
| 是否已经完成 | **YES — ALREADY_COMPLETED** |
| 是否必须处理 | NO（无需重复绑定） |
| 用户最简单操作 | 无 |
| 完成后的回复口令 | `DOMAIN_DNS_HTTPS = ALREADY_COMPLETED` |

### A2. Vercel domain registration
| Field | Value |
|--------|--------|
| 当前状态 | `vercel domains ls` → `zwima-group.info` under team `zwima` |
| 是否已经完成 | **YES — ALREADY_COMPLETED** |
| 是否必须处理 | NO |
| 用户最简单操作 | 无 |
| 完成后的回复口令 | `VERCEL_DOMAIN_REGISTERED = ALREADY_COMPLETED` |

### A3. Production env names (presence only)
| Field | Value |
|--------|--------|
| 当前状态 | `vercel env ls production` shows required **names** including: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CREDIT_PRICE_ID`, `OPENAI_API_KEY`, `LIVE_PROVIDER_CALLS_ENABLED`, `CLOSED_BETA_STRIPE_TEST_ONLY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PORT`, `EMAIL_PROVIDER` |
| 是否已经完成 | **YES — ALREADY_COMPLETED**（名称存在；不读取正文） |
| 是否必须处理 | NO（勿重新配置密钥） |
| 用户最简单操作 | 无 |
| 完成后的回复口令 | `PRODUCTION_ENV_NAMES = ALREADY_COMPLETED` |

### A4. Stripe webhook code + secret **name**
| Field | Value |
|--------|--------|
| 当前状态 | `src/app/api/webhooks/stripe/route.ts` present; Production env name `STRIPE_WEBHOOK_SECRET` present; Phase7 + GAP-002 / STRIPE-LIVE-CFG-001 historical PASS |
| 是否已经完成 | **YES — ALREADY_COMPLETED**（配置记录/历史证据） |
| 是否必须处理 | NO（禁止新付款验证） |
| 用户最简单操作 | 无 |
| 完成后的回复口令 | `STRIPE_WEBHOOK_CONFIG = ALREADY_COMPLETED` |

### A5. P0/P1 engineering readiness
| Field | Value |
|--------|--------|
| 当前状态 | Ledger + `ZWIMA_AI_P1_FINAL_READINESS_AUDIT.md` → `PASS_CONDITIONAL`; CODE_BLOCKERS=NONE |
| 是否已经完成 | **YES — ALREADY_COMPLETED** |
| 是否必须处理 | NO |
| 用户最简单操作 | 无 |
| 完成后的回复口令 | `P0_P1_ENGINEERING = ALREADY_COMPLETED` |

---

## B. USER_MUST_CONFIRM

### B1. Canonical Closed Beta domain is `https://zwima-group.info`
| Field | Value |
|--------|--------|
| 当前状态 | Domain live; confirm it is the **only** Closed Beta customer domain |
| 是否已经完成 | PARTIAL（技术可达；产品确认待你回复） |
| 是否必须处理 | YES |
| 用户最简单操作 | 在 Vercel → Project `zwima-ai` → Domains 确认 Production 主域为 `zwima-group.info`，无误绑临时域 |
| 完成后的回复口令 | `CANONICAL_DOMAIN_CONFIRMED = YES` |

### B2. Stripe Dashboard webhook URL still points to Production
| Field | Value |
|--------|--------|
| 当前状态 | 仓库与 env 名称已齐；Dashboard URL 需人工目视（只读） |
| 是否已经完成 | PARTIAL |
| 是否必须处理 | YES（目视即可，禁止发测试付款） |
| 用户最简单操作 | Stripe Dashboard → Developers → Webhooks → 确认 endpoint 为 `https://zwima-group.info/api/webhooks/stripe` 且 enabled |
| 完成后的回复口令 | `STRIPE_WEBHOOK_URL_CONFIRMED = YES` |

### B3. IONOS / SMTP remains banned (or test-mailbox only)
| Field | Value |
|--------|--------|
| 当前状态 | Production 存在 `SMTP_*` + `EMAIL_PROVIDER` **名称**；代码侧 GAP-010 EMAIL fail-closed；**是否禁发**需你确认运营策略 |
| 是否已经完成 | NO（策略确认待你） |
| 是否必须处理 | YES |
| 用户最简单操作 | 确认 Closed Beta 期间：**不向真实客户发信**；仅保留禁发或测试邮箱。勿改 Production 密钥 |
| 完成后的回复口令 | `IONOS_SMTP_POLICY = BANNED` 或 `IONOS_SMTP_POLICY = TEST_MAILBOX_ONLY` |

### B4. Legal draft remains counsel-pending (no re-build of GAP-011)
| Field | Value |
|--------|--------|
| 当前状态 | GAP-011 PASS（Closed Beta minimal）；counsel 终稿为业务项 |
| 是否已经完成 | Engineering YES / Counsel NO |
| 是否必须处理 | CONDITIONAL（可带 draft 进 Closed Beta，若产品接受） |
| 用户最简单操作 | 确认是否接受 draft legal 上线 Closed Beta，或等待 counsel 后再邀请客户 |
| 完成后的回复口令 | `LEGAL_DRAFT_ACCEPTED_FOR_CLOSED_BETA = YES` 或 `LEGAL_WAIT_COUNSEL = YES` |

---

## C. USER_MUST_PROVIDE

### C1. Closed Beta invitee list
| Field | Value |
|--------|--------|
| 当前状态 | 无仓库内最终名单 |
| 是否已经完成 | NO |
| 是否必须处理 | YES（业务） |
| 用户最简单操作 | 提供首批邀请邮箱列表（或声明“仅内部自测，暂不邀请外部”） |
| 完成后的回复口令 | `CLOSED_BETA_COHORT = <N> INVITEES` 或 `CLOSED_BETA_COHORT = INTERNAL_ONLY` |

### C2. Manual credit grant plan
| Field | Value |
|--------|--------|
| 当前状态 | 计费引擎已锁定；人工充值流程未在本清单自动执行 |
| 是否已经完成 | NO |
| 是否必须处理 | YES（若有外部受邀用户） |
| 用户最简单操作 | 说明每位受邀用户初始 Credits 数量与执行人（Dashboard/admin） |
| 完成后的回复口令 | `MANUAL_CREDITS_PLAN = READY` |

---

## D. FINAL_RELEASE_AUTHORIZATION

### D1. Authorize merge to `main`
| Field | Value |
|--------|--------|
| 当前状态 | Feature branch `v1-p0-commercial-loop`；**未** merge main |
| 是否已经完成 | NO |
| 是否必须处理 | YES（若要以 main 为发布源） |
| 用户最简单操作 | 明确回复授权口令；**不要**要求 Cursor 自动 merge |
| 完成后的回复口令 | `AUTHORIZE_MAIN_MERGE = YES` |

### D2. Authorize Production deploy
| Field | Value |
|--------|--------|
| 当前状态 | Production 已有历史部署；本会话**未**执行新 Production deploy |
| 是否已经完成 | NO（新发布授权） |
| 是否必须处理 | YES（若要推送本分支变更到 Production） |
| 用户最简单操作 | 明确回复授权口令；**不要**要求 Cursor 自动 deploy |
| 完成后的回复口令 | `AUTHORIZE_PRODUCTION_DEPLOY = YES` |

---

## Removed / not re-asked (deduped from prior audit)

| Prior manual item | Disposition |
|-------------------|-------------|
| “Confirm Production env names exist” | → **A3 ALREADY_COMPLETED** |
| “Confirm domain binding / DNS” | → **A1/A2 ALREADY_COMPLETED** (+ B1 product confirm only) |
| “Re-prove Stripe Live €10 / webhook secret” | → **ALREADY_COMPLETED** (GAP-002 / Phase7) — do not re-pay |
| “Re-run any locked GAP” | → Forbidden / ALREADY_COMPLETED |
| Reconfigure Stripe/Clerk/OpenAI | → Forbidden |

---

## Suggested user reply batch

```
CANONICAL_DOMAIN_CONFIRMED = YES
STRIPE_WEBHOOK_URL_CONFIRMED = YES
IONOS_SMTP_POLICY = BANNED
LEGAL_DRAFT_ACCEPTED_FOR_CLOSED_BETA = YES
CLOSED_BETA_COHORT = INTERNAL_ONLY
MANUAL_CREDITS_PLAN = READY
AUTHORIZE_MAIN_MERGE = NO
AUTHORIZE_PRODUCTION_DEPLOY = NO
```
