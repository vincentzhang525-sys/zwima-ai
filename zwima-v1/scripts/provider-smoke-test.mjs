#!/usr/bin/env node
/**
 * Phase 6: Real provider smoke test (HTTP-only, no secret logging).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..");

const CANONICAL = ["OPENAI_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY", "QWEN_API_KEY", "ANTHROPIC_API_KEY"];
const ALIASES = {
  GEMINI_API_KEY: ["GOOGLE_API_KEY"],
  ANTHROPIC_API_KEY: ["CLAUDE_API_KEY"],
  QWEN_API_KEY: ["DASHSCOPE_API_KEY"],
};

const TESTS = [
  {
    provider: "openai",
    env: "OPENAI_API_KEY",
    model: "gpt-4o-mini",
    run: openAiChat,
  },
  {
    provider: "gemini",
    env: "GEMINI_API_KEY",
    model: "gemini-2.5-flash-lite",
    run: geminiChat,
  },
  {
    provider: "deepseek",
    env: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    run: (key, model) => openAiChat(key, model, "https://api.deepseek.com/v1"),
  },
  {
    provider: "qwen",
    env: "QWEN_API_KEY",
    model: "qwen-plus",
    run: (key, model) => openAiChat(key, model, "https://dashscope.aliyuncs.com/compatible-mode/v1"),
  },
  {
    provider: "claude",
    env: "ANTHROPIC_API_KEY",
    model: "claude-sonnet-4-20250514",
    run: claudeChat,
  },
];

const REDACT = /sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|x-api-key['":\s]+\S+/gi;
function redact(s) {
  return String(s || "").replace(REDACT, "[REDACTED]");
}

async function loadVercelEnv() {
  const fetchScript = path.join(repoRoot, "publicai", "scripts", "fetch-vercel-env.mjs");
  if (fs.existsSync(fetchScript)) await import(pathToFileURLSafe(fetchScript));
}

function pathToFileURLSafe(p) {
  const u = new URL("file:///");
  u.pathname = p.replace(/\\/g, "/");
  return u.href;
}

function envPresence() {
  return CANONICAL.map((key) => {
    const present = !!process.env[key]?.trim();
    const aliasHit = (ALIASES[key] || []).find((a) => !!process.env[a]?.trim());
    return { key, status: present ? "存在" : aliasHit ? "缺失(别名存在)" : "缺失", alias: aliasHit || null };
  });
}

async function fetchJson(url, init = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const latencyMs = Date.now() - start;
    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { status: res.status, data, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

async function openAiChat(key, model, base = "https://api.openai.com/v1") {
  return fetchJson(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 16,
      temperature: 0,
    }),
  });
}

async function geminiChat(key, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
      generationConfig: { maxOutputTokens: 16, temperature: 0 },
    }),
  });
}

async function claudeChat(key, model) {
  return fetchJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
    }),
  });
}

function parseResult(provider, model, { status, data, latencyMs }) {
  if (provider === "openai" || provider === "deepseek" || provider === "qwen") {
    const text = data?.choices?.[0]?.message?.content ?? "";
    const err = data?.error?.message;
    return {
      provider,
      model,
      httpStatus: status,
      success: status < 400 && String(text).trim().length > 0,
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      latencyMs,
      error: status >= 400 ? redact(err || `HTTP ${status}`) : null,
      text: redact(String(text).slice(0, 80)),
    };
  }
  if (provider === "gemini") {
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    return {
      provider,
      model,
      httpStatus: status,
      success: status < 400 && text.trim().length > 0,
      promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs,
      error: status >= 400 ? redact(data?.error?.message || `HTTP ${status}`) : null,
      text: redact(text.slice(0, 80)),
    };
  }
  if (provider === "claude") {
    const text = (data?.content || []).map((b) => b.text).join("");
    return {
      provider,
      model,
      httpStatus: status,
      success: status < 400 && text.trim().length > 0,
      promptTokens: data?.usage?.input_tokens ?? 0,
      completionTokens: data?.usage?.output_tokens ?? 0,
      latencyMs,
      error: status >= 400 ? redact(data?.error?.message || `HTTP ${status}`) : null,
      text: redact(text.slice(0, 80)),
    };
  }
  return { provider, model, httpStatus: status, success: false, error: "unknown provider" };
}

async function testPublicGateway() {
  try {
    const res = await fetch("https://zwima-group.info/api/gateway/health");
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const five = ["openai", "google", "anthropic", "deepseek", "qwen"];
    const rows = (data.providers || [])
      .filter((p) => five.includes(p.providerId))
      .map((p) => ({
        providerId: p.providerId,
        configured: p.configured,
        healthStatus: p.healthStatus,
        latencyMs: p.latencyMs,
      }));
    return { ok: true, rows, checkedAt: data.checkedAt };
  } catch (err) {
    return { ok: false, error: redact(err instanceof Error ? err.message : String(err)) };
  }
}

async function main() {
  await loadVercelEnv();

  console.log("=== Phase 6 Provider Smoke Test ===\n");
  console.log("--- 1. Env vars (存在/缺失) ---");
  const env = envPresence();
  for (const e of env) {
    console.log(`${e.key}: ${e.status}${e.alias ? ` (alias ${e.alias} has value but zwima-v1 ignores)` : ""}`);
  }

  console.log("\n--- 2. zwima-v1 code env names ---");
  console.log("Canonical only: OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, QWEN_API_KEY, ANTHROPIC_API_KEY");
  console.log("Legacy aliases NOT read: GOOGLE_API_KEY, CLAUDE_API_KEY, DASHSCOPE_API_KEY");

  console.log("\n--- 3. Direct API (local env) ---");
  const direct = [];
  for (const t of TESTS) {
    const key = process.env[t.env]?.trim();
    if (!key) {
      direct.push({ ...t, skipped: true, success: false, error: "key missing locally" });
      console.log(`${t.provider}: SKIPPED (no local decrypted key)`);
      continue;
    }
    const raw = await t.run(key, t.model);
    const parsed = parseResult(t.provider, t.model, raw);
    direct.push(parsed);
    console.log(
      `${parsed.provider} | ${parsed.model} | HTTP ${parsed.httpStatus} | success=${parsed.success} | ${parsed.latencyMs}ms | tokens ${parsed.promptTokens}/${parsed.completionTokens}${parsed.error ? " | " + parsed.error : ""}`
    );
  }

  console.log("\n--- 4. publicai production gateway (Vercel runtime proxy) ---");
  const gw = await testPublicGateway();
  if (gw.ok) {
    for (const r of gw.rows) console.log(`${r.providerId}: configured=${r.configured} status=${r.healthStatus} ${r.latencyMs}ms`);
  } else {
    console.log("gateway health failed:", gw.error);
  }

  console.log("\n--- 5. zwima-v1 deployment ---");
  try {
    const r = await fetch("https://zwima-group.info/api/v1/health");
    console.log(`/api/v1/health on zwima-group.info: HTTP ${r.status} (zwima-v1 ${r.status === 404 ? "NOT deployed" : "present"})`);
  } catch {
    console.log("zwima-v1 production endpoint unreachable");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    env,
    direct,
    publicGateway: gw,
    zwimaV1Deployed: false,
  };

  const out = path.join(root, "docs", "PHASE6_PROVIDER_SMOKE_REPORT.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("\nWrote", out);
}

main().catch((e) => {
  console.error(redact(e.message));
  process.exit(1);
});
