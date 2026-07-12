# Phase 6 Pre-Check: Provider Production Smoke Test Report

**Generated:** 2026-07-12  
**Scope:** zwima-v1 real provider integration (no new features)  
**Vercel project:** `zwima-ai` (current root: `publicai`)  
**Production URL (legacy):** https://zwima-group.info  
**zwima-v1 production:** NOT deployed (`/api/v1/health` → 404)

---

## 一、环境变量检查

| Variable | Vercel 变量名 | zwima-v1 代码读取 | 本地 decrypt 检测 | 说明 |
|----------|---------------|-------------------|-------------------|------|
| OpenAI | `OPENAI_API_KEY` | `OPENAI_API_KEY` | 缺失 | 名称一致；Vercel CLI decrypt 未返回明文（可能为加密 Secret） |
| Gemini | `GEMINI_API_KEY` | `GEMINI_API_KEY` | 缺失 | 名称一致 |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_API_KEY` | 缺失 | 名称一致 |
| Qwen | `QWEN_API_KEY` | `QWEN_API_KEY` | 缺失 | 名称一致 |
| Claude | `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | 缺失 | 名称一致 |

**旧变量名 / 别名（publicai 支持，zwima-v1 不支持）：**

| Provider | publicai 别名 | zwima-v1 是否读取 |
|----------|---------------|-------------------|
| Gemini | `GOOGLE_API_KEY` | ❌ 不读取 |
| Claude | `CLAUDE_API_KEY` | ❌ 不读取 |
| Qwen | `DASHSCOPE_API_KEY` | ❌ 不读取 |

**结论：** 变量名与 `.env.example` / adapter 代码完全一致。若 Vercel 仅配置了别名而未配置 canonical 名称，zwima-v1 将无法读取 Key（publicai 可以）。

**Vercel Runtime 侧证（publicai gateway，同项目 env）：**

| Provider | configured | healthStatus | latency |
|----------|------------|--------------|---------|
| openai | true | online | ~367ms |
| google (gemini) | true | online | ~102ms |
| anthropic | true | offline | ~343ms |
| deepseek | true | offline | ~242ms |
| qwen | true | offline | ~335ms |

---

## 二、逐家 Direct API 测试（zwima-v1 本地）

本地无法 decrypt Provider Key，**直连测试全部 SKIP**。  
测试脚本：`zwima-v1/scripts/provider-smoke-test.mjs`（使用真实 API 模型 ID，不打印 Key）。

---

## 三、平台统一接口测试 `POST /api/v1/chat`

| 检查项 | 结果 | 说明 |
|--------|------|------|
| zwima-v1 已部署 | **FAIL** | `https://zwima-group.info/api/v1/chat` 不存在（404） |
| 五家 Provider 统一调用 | **BLOCKED** | 需 zwima-v1 部署到 Vercel 或本地可用 Key |
| UsageLog 写入 | **未测** | 依赖统一部署 |
| Credits 扣减 | **未测** | 依赖统一部署 |
| Transaction 生成 | **未测** | 依赖统一部署 |
| Provider latency/status 更新 | **未测** | 依赖统一部署 |

**代码静态验证（故障保护）：**

| 检查 | 结果 |
|------|------|
| Provider 失败在 `chargeForUsage` 之前 throw | ✅ PASS |
| 无 retry 循环（避免重复计费） | ✅ PASS |
| HTTP 60s 超时 + AbortController | ✅ PASS |
| 无效 API Key → 401，不泄露 Key | ✅ PASS（代码审查） |

---

## 四、健康检查

| Endpoint | zwima-v1 生产 | 说明 |
|----------|---------------|------|
| `GET /api/v1/health` | 404 | zwima-v1 未部署 |
| `GET /api/v1/models` | 404 | zwima-v1 未部署 |

**publicai 代理：** `GET /api/gateway/health` 可用，见上表。

**模型 ID 问题（已修复）：**

- OpenAI adapter 原先直接使用 `gpt-5` 等虚构 ID 调用 API → 必然失败  
- **修复：** 增加 `API_MODEL_MAP`（`gpt-5-nano` → `gpt-4o-mini` 等），health check 使用 `gpt-4o-mini`

---

## 五、故障保护

| 场景 | 结果 |
|------|------|
| 单 Provider 失败泄露 Key | ✅ 错误消息经 adapter 抛出，不含 Authorization |
| 余额不足 | ✅ 402 before provider call |
| 无效 Key | ✅ 401 |
| 失败后仍扣 Credits | ✅ `chargeForUsage` 仅在成功 response 后 |
| 重复 UsageLog/Transaction | ✅ 单次 transaction，无 retry |

---

## 六、构建与部署

| 步骤 | 结果 |
|------|------|
| `npm run build` | ✅ PASS |
| `npm run lint` | ✅ PASS（smoke script 2 warnings only） |
| DB migration | 无需新 migration（schema 已在 Phase 5） |
| Vercel Production 部署 zwima-v1 | ❌ **未执行**（当前项目 root=`publicai`；需单独配置 `zwima-v1` root 或新项目） |
| 部署后生产 Smoke | ❌ **BLOCKED** |

---

## 验收表

| Provider | Model (smoke) | Direct API | Unified API | Usage Log | Credits | Latency | Result |
|----------|---------------|------------|-------------|-----------|---------|---------|--------|
| OpenAI | gpt-4o-mini | SKIP | N/A | N/A | N/A | ~367ms (gw) | **PARTIAL** — gateway online |
| Gemini | gemini-2.5-flash-lite | SKIP | N/A | N/A | N/A | ~102ms (gw) | **PARTIAL** — gateway online |
| DeepSeek | deepseek-chat | SKIP | N/A | N/A | N/A | offline (gw) | **FAIL** — gateway offline |
| Qwen | qwen-plus | SKIP | N/A | N/A | N/A | offline (gw) | **FAIL** — gateway offline |
| Claude | claude-sonnet-4 | SKIP | N/A | N/A | N/A | offline (gw) | **FAIL** — gateway offline |

---

## PASS 项目

- 环境变量命名与 zwima-v1 代码一致（5/5 canonical names）
- 故障保护逻辑（失败不扣费、无 retry、超时）
- `npm run build` / `npm run lint`
- OpenAI 模型 ID 映射修复
- Smoke test 脚本可重复执行

## FAIL 项目

- zwima-v1 **未部署**到 Production（无法测 `/api/v1/*`）
- 本地无法 decrypt Provider Key（无法跑 zwima-v1 Direct API）
- publicai gateway：**anthropic / deepseek / qwen offline**
- 五家 Unified API 端到端：**全部未测**

## 已修复问题

| 问题 | 原因 | 修复 |
|------|------|------|
| OpenAI 调用 `gpt-5` 等非 API 模型 ID | 产品 ID 未映射到 OpenAI API 名 | `src/lib/providers/openai.ts` 增加 `API_MODEL_MAP` |

## 未解决阻塞项

1. **Vercel 项目 root 仍为 `publicai`** — zwima-v1 需独立部署（改 root 或新项目）才能 Production Smoke  
2. **Provider Key 本地 decrypt 为空** — 需在 Vercel Dashboard 确认 5 个 canonical 变量均有值（非仅别名）  
3. **Anthropic / DeepSeek / Qwen 生产 gateway offline** — 需检查 Key 有效性、余额、模型权限  
4. **Unified API 全链路** — 依赖 zwima-v1 部署 + DB + 测试 API Key

## 是否允许进入 Stripe 全链路联调

**否 — 暂不建议。**

理由：
- zwima-v1 尚未 Production 部署，`/api/v1/chat` 计费链路未在生产验证  
- 5 家 Provider 中 3 家在同项目 gateway 上已 offline  
- Unified API 的 UsageLog / Credits / Transaction 未做生产实测  

**建议下一步：**
1. Vercel 配置 `zwima-v1` 为 root directory（或新建项目）并部署 Production  
2. 确认 5 个 canonical env 均有值；如有仅别名，补填 canonical 或给 zwima-v1 增加别名读取  
3. 修复 offline 的 3 家 Provider Key/余额  
4. 部署后重跑 `node scripts/provider-smoke-test.mjs` + Unified API 测试

---

*Raw JSON: `docs/PHASE6_PROVIDER_SMOKE_REPORT.json`*
