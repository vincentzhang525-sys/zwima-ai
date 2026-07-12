# zwima-v1 Production 部署验收报告

**生成时间:** 2026-07-12  
**Production URL:** https://zwima-group.info  
**Vercel 项目:** `zwima-ai` (`prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B`)  
**最新 Production 部署:** `dpl_5bh4Db761vBVr29LVcXtecHzrrRq`  
**Root Directory:** `zwima-v1`  
**总体结论:** 部署成功，端点可访问；**五家 Provider Smoke Test 未全部 PASS（Qwen FAIL）**，Phase 6 验收 **未完成**。

---

## 一、Vercel 部署配置

| 项 | 值 | 状态 |
|----|-----|------|
| Project Root | `zwima-v1` | ✅ |
| Framework | Next.js 15 | ✅ |
| Build Command | `npm run vercel-build` | ✅ |
| Install Command | `npm install --legacy-peer-deps` | ✅ |
| Production 域名 | https://zwima-group.info | ✅ |
| Node.js | 24.x | ✅ |

### 数据库连接（部署修复）

- 运行时与构建时从 `SUPABASE_DB_PASSWORD` + `SUPABASE_URL` 解析 Session Pooler URL（`:5432`）
- 首次部署通过 `prisma migrate diff` + `db execute` 初始化 schema（避开 legacy `auth` schema 冲突）
- 后续部署检测 `Provider` 表存在则跳过 schema 应用
- Seed 在每次 Production 构建时执行（providers / pricing / packages）

### Production 环境变量（已配置）

| 变量 | 状态 |
|------|------|
| `DATABASE_URL` | ✅（运行时由 `SUPABASE_DB_PASSWORD` 覆盖解析） |
| `SUPABASE_DB_PASSWORD` | ✅ |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `OPENAI_API_KEY` | ✅ |
| `GEMINI_API_KEY` | ✅ |
| `DEEPSEEK_API_KEY` | ✅ |
| `ANTHROPIC_API_KEY` | ✅ |
| `QWEN_API_KEY` | ⚠️ 已配置但 **API 调用失败** |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | ⚠️ placeholder（Dashboard 重定向 /login） |
| `NEXT_PUBLIC_APP_URL` | ✅ `https://zwima-group.info` |

---

## 二、端点可访问性验证

| 端点 | HTTP | 结果 | 说明 |
|------|------|------|------|
| `GET /api/v1/health` | 200 | ✅ PASS | 返回五家 Provider 健康状态 JSON |
| `GET /api/v1/models` | 200 | ✅ PASS | 返回模型列表 |
| `POST /api/v1/chat` | 401 | ✅ PASS（可访问） | 无 API Key 时正确返回 `Invalid API key` |
| `GET /dashboard` | 307 → `/login` | ✅ PASS（可访问） | Clerk placeholder，未登录重定向预期行为 |

---

## 三、五家 Provider Production Smoke Test

**测试方式:** `node zwima-v1/scripts/production-smoke-test.mjs`（Production HTTP，`/api/v1/health` 实时探测）

| Provider | Health 状态 | 结果 |
|----------|-------------|------|
| OpenAI | `ok` | ✅ PASS |
| Gemini | `ok` | ✅ PASS |
| DeepSeek | `ok` | ✅ PASS |
| Claude (Anthropic) | `ok` | ✅ PASS |
| **Qwen** | **`error`** | ❌ **FAIL** |

**Qwen 失败分析（部署侧已尝试的修复）:**

1. 添加 `DASHSCOPE_API_KEY` 别名读取 — 仍 FAIL
2. 添加国际端点 `dashscope-intl.aliyuncs.com` 回退 — 仍 FAIL
3. 结论：**Vercel 上的 `QWEN_API_KEY` 无效、过期，或与中国/国际 DashScope 区域不匹配**（publicai 时代 gateway 亦显示 qwen offline）

**解除阻塞所需操作（需人工）:**

在 Vercel Production 更新有效的 Qwen/DashScope API Key：

```
QWEN_API_KEY=sk-...   # 或 DASHSCOPE_API_KEY=sk-...
```

更新后重新部署或触发 redeploy，再运行：

```bash
node zwima-v1/scripts/production-smoke-test.mjs
```

---

## 四、统一 Chat API（/api/v1/chat）

| 检查项 | 结果 |
|--------|------|
| 端点存在且响应 | ✅ PASS（401 无 Key） |
| 五家 Provider 经统一接口实测 | ⏸ BLOCKED（需有效 API Key + 用户 Credits；Qwen Provider 本身 FAIL） |
| UsageLog / Credits / Transaction | ⏸ 未测（依赖有效用户 API Key） |

---

## 五、验收结论

| 任务 | 状态 |
|------|------|
| 1. Vercel Root → zwima-v1 | ✅ 完成 |
| 2. Production 环境变量 | ✅ 完成（Clerk 为 placeholder；Qwen Key 无效） |
| 3. Production 部署 | ✅ 完成 |
| 4. `/api/v1/health` `/api/v1/chat` `/dashboard` 可访问 | ✅ 完成 |
| 5. 五家 Provider Smoke Test 全部 PASS | ❌ **4/5 PASS，Qwen FAIL** |
| 6. 提交 Phase 6 验收报告（全部 PASS 后） | ❌ **未满足条件，本报告为部署状态报告** |

### 下一步（阻塞 Phase 6 验收）

1. **更新 Vercel `QWEN_API_KEY`** 为有效 DashScope Key（确认中国/国际区域与端点一致）
2. **（可选）配置真实 Clerk Keys** 以启用 Dashboard 登录
3. Redeploy Production
4. 重跑 `production-smoke-test.mjs`，五家全部 PASS 后再提交最终验收报告

---

## 六、部署相关代码变更（本地，未 commit）

- `scripts/vercel-build.mjs` — 构建时 DB 初始化 + idempotent schema
- `src/lib/database-url.ts` — 从 Supabase 密码解析 pooler URL
- `src/lib/prisma.ts` — 运行时 DATABASE_URL 解析
- `src/lib/providers/qwen.ts` — DASHSCOPE 别名 + 国际端点回退
- `scripts/production-smoke-test.mjs` — Production HTTP smoke test

**按用户要求：五家未全部 PASS，不进行 git commit。**
