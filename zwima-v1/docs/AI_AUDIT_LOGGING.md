# AI Audit Logging

## 目标

为每次 AI 调用提供可合规追溯的审计链：**requestId** 贯穿 chat、UsageLog、billing、AiAuditLog；不存 prompt/response/API Key 明文。

## 数据结构

`AiAuditLog`：`requestId`、`correlationId`、`organizationId`、`userId`、`apiKeyId`、`providerId`、`routingPolicyId`、`promptHash`、`completionHash`（SHA-256）、tokens、cost、margin、latency、`status`、`fallbackCount`、`attemptedProviders`、`routingReason`、`retentionUntil`。

Legacy `AuditLog` 继续记录 Dashboard 管理操作（API Key CRUD 等）。

## 核心流程

1. `executeChatRequest()` 生成/接受 `requestId`。
2. `writeAiAudit()` PENDING → 成功后 `updateAiAudit()` SUCCESS/FAILED。
3. `chargeForUsage()` 写入 UsageLog 同 `requestId`。
4. Admin 查询 `/api/admin/audit`、`/api/v1/audit`（org 过滤）。

## 权限与安全

- 组织隔离：非 admin 仅本 org。
- Viewer 角色只读（Dashboard RBAC 目标；Preview 需验证）。
- CSV 导出需 admin + org scope（接口设计见 retention 节）。
- 哈希不可逆还原明文；禁止 log 完整 sk_live_*。

## 失败处理

- Audit 写入失败不阻塞 chat（try/catch 静默），但 Production 应监控失败率。
- Provider 失败记录 `errorCode`、`attemptedProviders`。

## Retention / Cleanup（设计）

- 默认 `retentionUntil = now + 365d`（可 per-request 覆盖）。
- 计划任务：`DELETE FROM "AiAuditLog" WHERE "retentionUntil" < NOW()`（cron / Supabase pg_cron）。
- CSV 导出：`GET /api/admin/audit/export?from=&to=` + `requireAdmin()` + 速率限制。

## Preview 验证方法

1. 单次 chat 后按 `requestId` 联查 UsageLog + AiAuditLog。
2. 确认 DB 无 prompt 明文列 populated。
3. 运行 audit 单元测试（hash-only）。
4. SecurityEvent 与 audit 交叉验证 margin 拦截。

## Production 上线前条件

- [ ] retention 策略法务确认
- [ ] 导出权限与 GDPR 流程
- [ ] Audit 表索引（requestId、organizationId、createdAt）
- [ ] migration 已部署（AiAuditLog 表存在）
