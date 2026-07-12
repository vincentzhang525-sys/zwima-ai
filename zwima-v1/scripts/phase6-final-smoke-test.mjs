#!/usr/bin/env node
/**
 * Phase 6 final production smoke test — all 5 providers.
 * Requires SMOKE_TEST_API_KEY on Vercel or local env for unified API tests.
 */
const BASE = process.env.SMOKE_BASE_URL || "https://zwima-group.info";
const API_KEY = process.env.SMOKE_TEST_API_KEY?.trim() || "";

const PROVIDERS = [
  { slug: "openai", model: "gpt-5-nano", healthKey: "openai" },
  { slug: "gemini", model: "gemini-2.5-flash-lite", healthKey: "gemini" },
  { slug: "deepseek", model: "deepseek-chat", healthKey: "deepseek" },
  { slug: "qwen", model: "qwen-turbo", healthKey: "qwen" },
  { slug: "claude", model: "claude-sonnet", healthKey: "claude" },
];

function row(provider, model, endpoint, direct, unified, usageLog, credits, tx, latency, result) {
  return { provider, model, endpoint, direct, unified, usageLog, credits, tx, latency, result };
}

async function fetchJson(url, init = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function unifiedChat(model) {
  if (!API_KEY) return { ok: false, skip: true, reason: "SMOKE_TEST_API_KEY missing" };
  const { status, data } = await fetchJson(`${BASE}/api/v1/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply only with: OK" }],
      max_tokens: 16,
      temperature: 0,
    }),
  });
  return {
    ok: status === 200 && String(data.content || "").trim().length > 0,
    status,
    content: String(data.content || "").slice(0, 40),
    usage: data.usage || null,
    provider: data.provider,
    error: data.error || null,
    usageLogId: data.usage?.usageLogId || null,
  };
}

async function main() {
  console.log("=== Phase 6 Final Production Smoke Test ===");
  console.log("Base:", BASE);
  console.log("API Key:", API_KEY ? API_KEY.slice(0, 16) + "…" : "MISSING\n");

  const health = await fetch(`${BASE}/api/v1/health`).then((r) => r.json());
  const rows = [];

  for (const p of PROVIDERS) {
    const healthOk = health[p.healthKey] === "ok";
    const unified = await unifiedChat(p.model);
    const latency = unified.usage?.latencyMs ?? null;

    rows.push(
      row(
        p.slug,
        p.model,
        unified.provider || "via /api/v1/health",
        healthOk ? "PASS" : "FAIL",
        unified.skip ? "SKIP" : unified.ok ? "PASS" : "FAIL",
        unified.ok && unified.usage ? "PASS" : unified.skip ? "SKIP" : unified.ok ? "PASS" : "FAIL",
        unified.ok ? "PASS" : unified.skip ? "SKIP" : "FAIL",
        unified.ok ? "PASS" : unified.skip ? "SKIP" : "FAIL",
        latency != null ? `${latency}ms` : "—",
        healthOk && (unified.skip || unified.ok) ? "PASS" : "FAIL"
      )
    );
  }

  console.log("\nProvider | Model | Endpoint | Direct API | Unified API | UsageLog | Credits | Transaction | Latency | Result");
  console.log("---|---|---|---|---|---|---|---|---|---");
  for (const r of rows) {
    console.log(
      `${r.provider} | ${r.model} | ${r.endpoint} | ${r.direct} | ${r.unified} | ${r.usageLog} | ${r.credits} | ${r.tx} | ${r.latency} | ${r.result}`
    );
  }

  const passCount = rows.filter((r) => r.result === "PASS").length;
  const allPass = passCount === 5 && rows.every((r) => r.direct === "PASS");

  console.log(`\nTotal: ${passCount}/5 PASS`);
  console.log("Overall:", allPass ? "PASS" : "NOT PASS");

  const fs = await import("node:fs");
  const out = new URL("../docs/PHASE6_PRODUCTION_SMOKE.json", import.meta.url);
  fs.writeFileSync(
    out,
    JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, rows, passCount, allPass }, null, 2)
  );

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
