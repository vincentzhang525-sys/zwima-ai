# Phase 7 环境检查报告 — Stripe Production

**Generated:** 2026-07-12  
**Scope:** Vercel Production (`zwima-ai` / https://zwima-group.info)  
**Phase:** 7 Step 1 — 环境检查 only（无代码变更、无 DB 变更、无 Billing 开发）

---

## 一、Vercel Production 变量检查

检查方式：`npx vercel env ls production`（仅变量名，不 decrypt 值）

| 变量 | 要求 | Vercel Production | 状态 |
|------|------|-------------------|------|
| `STRIPE_SECRET_KEY` | 必须 | **未列出** | ❌ **缺失** |
| `STRIPE_WEBHOOK_SECRET` | 必须 | **未列出** | ❌ **缺失** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 必须 | **未列出** | ❌ **缺失** |

### 相关但未要求的变量（供参考）

| 变量 | `.env.example` | Vercel Production | 说明 |
|------|----------------|-------------------|------|
| `STRIPE_PUBLISHABLE_KEY` | 有 | 未列出 | 代码当前未读取 |
| `STRIPE_CREDIT_PRICE_ID` | 有 | 未列出 | 代码使用 `price_data` 动态定价，非必须 |

**结论：三项必需 Stripe 变量均未在 Vercel Production 配置。**

---

## 二、Stripe API 连通性

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Stripe API 连接测试 | ⏸ **未执行** | `STRIPE_SECRET_KEY` 缺失，无法发起合法 API 调用 |
| 使用测试/假 Key | ❌ **未使用** | 按指令不生成、不使用占位 Key |

---

## 三、Production 运行时侧证

| 端点 | HTTP | 响应 | 含义 |
|------|------|------|------|
| `POST /api/webhooks/stripe` | 400 | `{"error":"Webhook not configured"}` | 与 `STRIPE_WEBHOOK_SECRET` 未配置一致 |

`createCheckoutSession`（`src/lib/stripe.ts`）在缺少 `STRIPE_SECRET_KEY` 时走 **mock 充值路径**，不会调用 Stripe API。

---

## 四、代码读取的 Stripe 变量（zwima-v1）

| 变量 | 读取位置 | 用途 |
|------|----------|------|
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts`, `subscription-engine.ts` | Checkout、Webhook、订阅 |
| `STRIPE_WEBHOOK_SECRET` | `src/app/api/webhooks/stripe/route.ts` | Webhook 签名校验 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.example` 列出 | 前端 Stripe.js（当前代码库 **尚未引用**） |

---

## 五、Phase 7 下一步（需用户确认后执行）

在 **Vercel Dashboard → zwima-ai → Production** 添加（请自行从 Stripe Dashboard 复制，勿发送给第三方）：

```
STRIPE_SECRET_KEY=sk_live_... 或 sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... 或 pk_test_...
```

并在 Stripe Dashboard 注册 Webhook：

```
https://zwima-group.info/api/webhooks/stripe
```

建议事件：`checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `charge.refunded`

配置完成后 redeploy Production，再执行 Phase 7 Step 2（Stripe API 连通性 + Checkout 联调）。

---

## 六、总结

| 项 | 结果 |
|----|------|
| 环境变量 3/3 已配置 | ❌ **0/3** |
| Stripe API 可连接 | ⏸ 阻塞（缺 `STRIPE_SECRET_KEY`） |
| 可进入 Billing 联调 | ❌ **否** — 等待用户配置并确认 |

**本步骤已完成，已停止，等待您的确认。**
