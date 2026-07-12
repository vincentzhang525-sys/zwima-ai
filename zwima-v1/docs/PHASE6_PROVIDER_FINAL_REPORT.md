# Phase 6 Provider Final Report

**Generated:** 2026-07-12  
**Updated:** 2026-07-12 (post QWEN_API_KEY rotation)  
**Production URL:** https://zwima-group.info  
**Deployment:** `dpl_6mS7q5uYQBwXy5DUQj57BN16tvTn`  
**Overall Result:** **PASS (5/5)**

---

## Qwen 根因与修复

| 项 | 结论 |
|----|------|
| 原始问题 | Vercel `QWEN_API_KEY` 无效（401 invalid_api_key） |
| 用户操作 | 重新生成 Qwen Cloud 官方 Key 并更新 Vercel Production |
| Key 区域 | **国际站** — 中国大陆 Endpoint 401，国际 Endpoint 200 |
| 正确 Endpoint | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| 健康检查模型 | `qwen-turbo` |
| 代码修复 | `qwen-config.ts`：`QWEN_BASE_URL`、CN→INTL fallback、错误分类、别名读取 |

**建议（可选）：** 在 Vercel Production 设置 `QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1` 以避免每次 health 先探测 CN Endpoint。

---

## 五家 Provider 测试结果

**Script:** `node zwima-v1/scripts/phase6-final-smoke-test.mjs`  
**Result:** **5/5 PASS**

| Provider | Model | Direct API (health) | Result |
|----------|-------|-------------------|--------|
| OpenAI | gpt-5-nano | ok | **PASS** |
| Gemini | gemini-2.5-flash-lite | ok | **PASS** |
| DeepSeek | deepseek-chat | ok | **PASS** |
| Qwen | qwen-turbo | ok | **PASS** |
| Claude | claude-sonnet | ok | **PASS** |

Build-time Qwen probe (deploy `dpl_6mS7q5uYQBwXy5DUQj57BN16tvTn`):

```
intl / qwen-turbo | HTTP 200 | text=OK | tokens 17/1
```

---

## 端点验证

| 端点 | Status | Result |
|------|--------|--------|
| `/api/v1/health` | 200 | PASS |
| `/api/v1/chat` (无 Key) | 401 | PASS |
| `/dashboard` | 307 → /login | PASS |

---

## 是否允许进入 Stripe 全链路联调（Phase 7）

**是。** 五家 Provider Production Smoke Test 已全部 PASS。

---

## 未解决风险

1. **Clerk placeholder** — Dashboard 登录未启用
2. **`SMOKE_TEST_API_KEY`** — unified `/api/v1/chat` 全量计费验证待 bootstrap（health 已通过）
3. **Qwen CN Endpoint** — 国际 Key 不可用 CN Endpoint；建议配置 `QWEN_BASE_URL`
