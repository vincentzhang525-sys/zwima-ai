# Provider & Model Pricing Architecture

## 目标

将 Provider/Model 价格从硬编码与 legacy `ModelPricing` 表迁移到可审计、可版本化的 **ProviderModel + ModelPricingRecord** 结构，支持 DRAFT → VERIFIED → EXPIRED 生命周期，并保证 Production 在缺少 VERIFIED 价格时 **fail closed**。

## 数据结构

| 实体 | 用途 |
|------|------|
| `Provider` | 平台 Provider 注册（slug、enabled、status、region） |
| `ProviderModel` | Provider 下的模型目录（modelCode、status、qualityTier） |
| `ModelPricingRecord` | 版本化价格记录（input/output/cached、currency、effectiveFrom/Until、pricingStatus） |
| `ModelPricing` (legacy) | 现有计费链保留，policy 路由优先 VERIFIED 记录 |

价格字段：`inputPricePerMillionTokens`、`outputPricePerMillionTokens`、`cachedInputPricePerMillionTokens`（可选）、`currency`、`platformMarkupPercent`、`effectiveFrom`、`effectiveUntil`、`pricingStatus`（DRAFT / VERIFIED / EXPIRED）、`sourceUrl`、`verifiedAt`。

## 核心流程

1. Admin 创建 `ProviderModel` 与 `ModelPricingRecord`（默认 DRAFT）。
2. 运营验证后标记 **VERIFIED**（写入 `verifiedAt` / `verifiedBy`）。
3. `getActivePricing()` 仅返回 **ACTIVE 模型 + VERIFIED + 在有效期内 + 价格 > 0** 的记录。
4. `estimateCost()` 优先 VERIFIED 记录；无记录时回退 legacy `ModelPricing`（Production 兼容）。
5. DRAFT / EXPIRED / 0 价格 **不参与** policy 路由成本计算。

## 权限与安全

- 价格 CRUD：`requireAdmin()` 保护 `/api/admin/pricing-records`、`/api/admin/models`。
- VERIFIED 状态变更仅管理员；DRAFT 不可用于 Production 路由。
- 不存储 Provider API Key；价格来源 URL 可选记录。

## 失败处理

- 无 VERIFIED 价格 → `getActivePricing` 返回 `null` → 路由候选被排除或 legacy 回退。
- 0 价格 VERIFIED → 视为无效，返回 `null`（禁止 placeholder 真实调用）。
- 过期记录（`effectiveUntil < now`）自动排除。

## Preview 验证方法

1. Preview DB 执行 migration + seed。
2. Admin UI **Pricing Records**：创建 DRAFT → 确认路由模拟器排除 → 标记 VERIFIED → 模拟器可用。
3. 运行 `npm test` 中 pricing fail-closed 用例。
4. 调用 `/api/v1/chat`（Preview，`ROUTING_ENGINE=policy`）验证成本与 UsageLog。

## Production 上线前条件

- [ ] Preview 全量 VERIFIED 价格覆盖活跃模型
- [ ] 无 DRAFT/0 价格参与路由
- [ ] legacy `ModelPricing` 与 VERIFIED 记录交叉校验通过
- [ ] Admin 价格变更审计完整
- [ ] incremental migration 已在 Preview `migrate deploy` 成功
