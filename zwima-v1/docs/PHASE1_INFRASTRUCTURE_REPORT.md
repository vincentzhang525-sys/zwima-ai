# Phase 1 Infrastructure Report

## 目标

在不引入 Agent/Workflow/MCP 的前提下，交付 Multi-Model Gateway 基础设施层：定价库、路由策略、成本/毛利保护、API Key 治理、AI 审计、Admin UI 与 V1 API，且 **不破坏** 现有 Stripe/Credits/UsageLog/ProviderAdapter。

## 交付组件

| 模块 | 路径 | 状态 |
|------|------|------|
| Schema 扩展 | `prisma/schema.prisma` | ✅ |
| Incremental migration | `prisma/migrations/20250713180000_phase1_infra/` | ✅ 已生成 |
| Pricing service | `src/lib/pricing/` | ✅ |
| Routing engine | `src/lib/routing/` | ✅（opt-in） |
| Margin guard | `src/lib/cost/margin-guard.ts` | ✅ |
| API Key governance | `src/lib/api-keys/` | ✅ |
| AI audit | `src/lib/audit/ai-audit.ts` | ✅ |
| Chat integration | `src/lib/chat-service.ts` | ✅ legacy + policy |
| V1 APIs | `/api/v1/api-keys`, `/usage`, `/audit` | ✅ |
| Admin APIs/UI | `/api/admin/*`, `/dashboard/admin/*` | ✅ 基础 |
| Tests | `src/lib/__tests__/phase1-*.test.ts` | ✅ |
| Docs | `docs/*.md` | ✅ |

## 数据结构变更摘要

新增表：`ProviderModel`、`ModelPricingRecord`、`ProviderHealth`、`RoutingPolicy`、`RoutingWeightConfig`、`PlatformConfig`、`AiAuditLog`、`SecurityEvent`、`IdempotencyRecord`。

扩展列：`ApiKey.organizationId/status/...`、`UsageLog.requestId`、`Payment.stripeEventId`、`Provider.status/...`。

**无 DROP** 现有 User/Organization/ApiKey/UsageLog/Transaction/Invoice/Payment/Provider。

## 核心流程

1. 请求进入 `executeChatRequest` → 治理检查 → legacy 或 policy 路由 → margin/budget → adapter → 单次计费 → audit 更新。
2. Production 默认 `ROUTING_ENGINE=legacy`。
3. Policy 引擎 Preview 验证后 env 切换。

## 权限与安全

见 `docs/SECURITY_REVIEW.md`、`docs/API_KEY_GOVERNANCE.md`、`docs/AI_AUDIT_LOGGING.md`。

## 失败处理

全局 fail-closed：无 VERIFIED 价格、负毛利、无候选 provider、budget 超限均拒绝调用。

## Preview 验证方法

```bash
cd zwima-v1
export DATABASE_URL=<preview-db>
npx prisma migrate deploy
npx prisma db seed
npm run lint && npm run typecheck && npm test && npm run build
# Preview env: ROUTING_ENGINE=policy (optional)
```

## Production 上线前条件

- Preview migration PASS
- 全量测试 PASS
- VERIFIED 价格覆盖
- Clerk 生产配置
- 人工 sign-off
- **禁止本阶段 Production 部署**
