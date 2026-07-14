# Routing Policy Engine

## 目标

在保持 **ProviderAdapter 接口不变** 的前提下，引入可配置的 **RoutingPolicy + RoutingWeightConfig**，支持多策略选型、fallback、重试上限；Production 默认 `ROUTING_ENGINE=legacy`，Preview 验证通过后方可切换 `policy`。

## 数据结构

| 实体 | 用途 |
|------|------|
| `RoutingPolicy` | 组织级或全局策略（strategy、allowed/blocked providers/models、maxRetries、fallbackEnabled、status） |
| `RoutingWeightConfig` | BALANCED 等策略的权重（cost/latency/quality/reliability/region） |
| `ProviderHealth` | 健康状态供 scoring 使用 |

策略枚举：`LOWEST_COST`、`LOWEST_LATENCY`、`HIGHEST_QUALITY`、`BALANCED`、`EU_PREFERRED`、`PROVIDER_PRIORITY`、`MODEL_PINNED`、`BUDGET_MODE`、`PREMIUM_MODE`。

## 核心流程

1. `routeRequest()` 解析 policy（组织默认 → 全局 ACTIVE）。
2. `buildCandidates()` 从 DB 构建候选，应用 allowlist/blocklist、价格、margin、maximumCost。
3. `scoreCandidates()` 按 strategy 打分；`selectTopCandidate()` 选最优。
4. `executeWithFallback()` 按 `maxRetries` 依次尝试 adapter；成功返回 `chargedOnce: true`。
5. 无候选 → `RoutingError` (503)。

Legacy 路径：`ROUTING_ENGINE=legacy` 时仍使用 `routeByModel()`，不读 RoutingPolicy。

## 权限与安全

- Policy CRUD / 模拟：`requireAdmin()` + `/api/admin/routing`、`/api/admin/routing/simulate`。
- API Key allowlist 与 policy allowlist 取交集。
- 模拟器不发起真实 Provider 调用（`simulate=true`）。

## 失败处理

- 全部候选 excluded → fail closed，返回 `ROUTING_FAILED`。
- Provider adapter 失败 → fallback；超出 maxRetries → 502/503。
- disabled Provider / 无 VERIFIED 价格 → 候选排除并记录 exclusionReason。

## Preview 验证方法

1. 设置 Preview `ROUTING_ENGINE=policy`。
2. Admin **Routing Policies**：启用/停用、调整 priority/weight。
3. **Routing Simulator**：验证 LOWEST_COST、EU_PREFERRED、disabled provider 排除。
4. 运行 routing 单元测试（scoring、fallback、retry 上限）。

## Production 上线前条件

- [ ] Preview 7 天无 routing 回归
- [ ] 显式 env 切换 `ROUTING_ENGINE=policy`（非默认）
- [ ] fallback 率与 latency 基线对比通过
- [ ] legacy 路径仍可一键回滚
