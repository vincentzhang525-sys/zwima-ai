# Phase 1 Security Review

## 目标

评估 Phase 1 基础设施改动的安全面：租户隔离、密钥处理、审计、Stripe、路由 fail-closed。

## 审查范围

- API Key hash 存储与 V1 治理
- AiAuditLog 无明文 prompt/key
- Admin 路由 `requireAdmin()` 一致性
- Stripe webhook `stripeEventId` 幂等
- Routing/pricing fail-closed
- 无 Production db push / from-empty migration

## 发现摘要

| 级别 | 项 | 状态 |
|------|-----|------|
| P0 | from-empty migration 已替换为 incremental | 已缓解 |
| P0 | Production 默认 legacy 路由 | 已缓解 |
| P1 | Clerk placeholder — 真实用户 auth 未启用 | 待 Preview 前配置 |
| P1 | RBAC `canAccess()` 未全站强制 | 部分；Admin 路由已保护 |
| P2 | Audit 写入失败静默 | 可接受 Preview；Production 需监控 |
| P2 | dailyBudget 检查 stub | 待补齐 |

## 密钥与 Secret

- API Key：SHA-256 hash（`hashApiKey`），响应 mask prefix。
- Provider keys：仍 via env，不入 audit。
- 禁止 commit `.env*` 含真实 secret（`.gitignore` 已覆盖）。

## 租户隔离

- API Key / Audit 按 `organizationId` 过滤。
- V1 list/update 校验 userId + orgId。
- 跨 org 访问应 404（需 Preview 渗透验证）。

## Stripe

- Webhook 签名验证保留。
- `stripeEventId` 重复事件 skip（幂等）。
- 不修改 checkout 核心 recharge 链。

## Preview 验证方法

1. Secret 扫描：`git grep -i sk_live` / trufflehog（如有）。
2. 跨 org API Key PATCH 负向测试。
3. 审计表抽样无 plaintext。
4. DRAFT 价格路由负向测试。

## Production 上线前条件

- [ ] Clerk 生产密钥
- [ ] 全 P0/P1 关闭
- [ ] incremental migration Preview PASS
- [ ] 渗透测试 sign-off
- [ ] **Production 部署：NO**（本阶段）
