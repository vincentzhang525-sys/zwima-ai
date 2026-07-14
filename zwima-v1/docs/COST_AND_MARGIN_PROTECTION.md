# Cost & Margin Protection

## 目标

在每次 AI 调用前预估 provider 成本与客户扣费，强制执行 **最低毛利率（MIN_MARGIN_PERCENT）**、输出 token 上限、API Key budget，防止负毛利与预算穿透。

## 数据结构

- `CostEstimate`：`providerCostEur`、`customerChargeCredits`、`marginPercent`、`pricingVersionId`
- `SecurityEvent`：类型 `LOW_MARGIN_ALERT`、`BUDGET_SPIKE` 等
- `ApiKey`：`dailyBudget`、`monthlyBudget`、`currentMonthUsage`、`tpmLimit`

环境变量：`MIN_MARGIN_PERCENT`（默认 10）、`MAX_ESTIMATED_OUTPUT_TOKENS`、`MAX_PROVIDER_RETRIES`。

## 核心流程

1. `clampOutputTokens()` 限制 max output。
2. `estimateCost()` 基于 VERIFIED 价格 + margin multiplier 计算。
3. `checkMarginProtection()` — 低于阈值 → `MarginGuardError` + SecurityEvent。
4. `checkBudget()` — monthly/daily/usageLimit 校验。
5. 聊天成功后 **单次** `chargeForUsage()`；fallback 重试 **不重复扣费**（`chargedOnce: true` 语义）。

## 权限与安全

- Margin 阈值仅平台 env 配置，非租户可改。
- Budget 按 API Key / Organization 隔离。
- 拦截事件写入 SecurityEvent 与 AiAuditLog（routingReason / errorCode）。

## 失败处理

- 负毛利预估 → HTTP 402 `MARGIN_PROTECTION`。
- Budget 超限 → HTTP 402 `API_KEY_BUDGET_EXCEEDED`。
- Provider 实际价格变化导致事后负毛利 → 运营告警 + 禁止新 VERIFIED 0 价。

## Preview 验证方法

1. 设置 `MIN_MARGIN_PERCENT=30`，用高 output token 请求验证拦截。
2. 设置 Key `monthlyBudget` 低于预估扣费。
3. 运行 cost/margin 单元测试。
4. 对比 UsageLog `requestId` 与 Transaction 一致性。

## Production 上线前条件

- [ ] MIN_MARGIN_PERCENT 与财务模型对齐
- [ ] 所有活跃模型 VERIFIED 价格覆盖
- [ ] 重试场景计费抽样审计通过
- [ ] SecurityEvent 告警接入监控（可选）
