# API Key Governance (V1)

## 目标

统一 Dashboard 与 **V1 API**（`/api/v1/api-keys`）的 Key 生命周期：创建、轮换、吊销、权限、RPM/TPM、budget、IP 白名单、组织隔离；存储 **hash only**，明文仅创建/轮换时返回一次。

## 数据结构

`ApiKey` 扩展字段：`organizationId`、`status`（ACTIVE/DISABLED/EXPIRED/REVOKED/COMPROMISED）、`permission`/`permissions`、`rpmLimit`、`tpmLimit`、`dailyBudget`、`monthlyBudget`、`ipWhitelist`、`allowedProviders`、`allowedModels`、`expiresAt`、`revokedAt`。

## 核心流程

| 操作 | 路径 | 说明 |
|------|------|------|
| List | `GET /api/v1/api-keys` | 组织 scoped，mask prefix |
| Create | `POST /api/v1/api-keys` | 返回 `fullKey` 一次 |
| Update | `PATCH /api/v1/api-keys/:id` | enable/disable、limits、permissions |
| Revoke | `POST .../revoke` | status=REVOKED |
| Rotate | `POST .../rotate` | 旧 key revoke + 新 key |

治理检查（chat 路径）：`validateApiKeyState` → `checkPermission` → `checkRateLimit` → `checkTpmLimit` → `checkIpWhitelist` → `checkBudget`。

## 权限与安全

- 普通用户仅能访问 **本组织** Key（`ensureDefaultOrganization` + orgId filter）。
- 管理员路由统一 `requireAdmin()`。
- 所有管理操作 `writeAudit`（不含 Key 明文）。
- IP 白名单逗号分隔；空则不限。

## 失败处理

| 场景 | Code |
|------|------|
| 过期 | `API_KEY_EXPIRED` |
| 吊销 | `API_KEY_REVOKED` |
| RPM/TPM | `API_KEY_RATE_LIMITED` |
| Budget | `API_KEY_BUDGET_EXCEEDED` |
| Provider/Model | `API_KEY_*_NOT_ALLOWED` |
| IP | `API_KEY_PERMISSION_DENIED` |

## Preview 验证方法

1. 创建 Key → 确认 DB 仅存 `keyHash`。
2. 测试 RPM/TPM/budget/IP 拦截。
3. Rotate → 旧 Key 401，新 Key 200。
4. 跨组织 PATCH 应 404/403。

## Production 上线前条件

- [ ] V1 路由与 Dashboard UI 字段一致
- [ ] 审计日志含 rotate/revoke
- [ ] 无跨租户 Key 访问（渗透测试）
- [ ] Clerk 真实认证启用（当前 placeholder 阻塞真实用户）
