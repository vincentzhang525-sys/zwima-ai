#!/usr/bin/env node
/**
 * Probe Qwen DashScope endpoints — never prints API keys.
 * Run: npx vercel env run --environment production -- node zwima-v1/scripts/qwen-probe.mjs
 */
const ENDPOINTS = [
  { id: "cn", url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "intl", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" },
];

const MODELS = ["qwen-turbo", "qwen-plus", "qwen-max"];

function loadKey() {
  const candidates = [
    ["QWEN_API_KEY", process.env.QWEN_API_KEY],
    ["DASHSCOPE_API_KEY", process.env.DASHSCOPE_API_KEY],
    ["DASHCOPE_API_KEY", process.env.DASHCOPE_API_KEY],
  ];
  for (const [name, value] of candidates) {
    const v = value?.trim();
    if (v) return { via: name, present: true, prefix: v.slice(0, 6) + "…" };
  }
  return { via: null, present: false, prefix: null };
}

function classifyError(status, message) {
  const m = String(message || "").toLowerCase();
  if (status === 401 || m.includes("invalid") && m.includes("key")) return "invalid_api_key";
  if (m.includes("insufficient") || m.includes("balance") || m.includes("quota")) return "insufficient_balance";
  if (m.includes("region") || m.includes("access denied") || m.includes("not supported in")) return "region_mismatch";
  if (m.includes("model") && (m.includes("not found") || m.includes("does not exist"))) return "model_not_available";
  if (status === 429 || m.includes("rate")) return "rate_limited";
  if (m.includes("timeout") || m.includes("abort")) return "timeout";
  if (status >= 500) return "provider_unavailable";
  return "provider_unavailable";
}

async function probe(baseUrl, model, key) {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply only with: OK" }],
      max_tokens: 8,
      temperature: 0,
    }),
  });
  const latencyMs = Date.now() - start;
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  const text = data?.choices?.[0]?.message?.content ?? "";
  const errMsg = data?.error?.message ?? "";
  return {
    httpStatus: res.status,
    ok: res.status < 400 && String(text).trim().length > 0,
    text: String(text).trim().slice(0, 40),
    promptTokens: data?.usage?.prompt_tokens ?? 0,
    completionTokens: data?.usage?.completion_tokens ?? 0,
    latencyMs,
    error: errMsg ? errMsg.slice(0, 120) : null,
    errorClass: res.status < 400 ? null : classifyError(res.status, errMsg),
    billed: res.status < 400 && (data?.usage?.total_tokens ?? 0) > 0,
  };
}

async function main() {
  const keyInfo = loadKey();
  console.log("=== Qwen Endpoint Probe ===");
  console.log("Key configured:", keyInfo.present ? `yes (${keyInfo.via}, ${keyInfo.prefix})` : "NO");
  if (process.env.QWEN_BASE_URL) console.log("QWEN_BASE_URL:", process.env.QWEN_BASE_URL);

  const key =
    process.env.QWEN_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    process.env.DASHCOPE_API_KEY?.trim();
  if (!key) {
    console.error("Set QWEN_API_KEY or DASHSCOPE_API_KEY on Vercel Production.");
    process.exit(1);
  }

  const bases = process.env.QWEN_BASE_URL
    ? [{ id: "custom", url: process.env.QWEN_BASE_URL.replace(/\/$/, "") }]
    : ENDPOINTS;

  let anyOk = false;
  for (const ep of bases) {
    console.log(`\n--- Endpoint: ${ep.id} (${ep.url}) ---`);
    for (const model of MODELS) {
      const r = await probe(ep.url, model, key);
      console.log(
        `${model} | HTTP ${r.httpStatus} | ok=${r.ok} | ${r.latencyMs}ms | tokens ${r.promptTokens}/${r.completionTokens} | billed=${r.billed}${r.errorClass ? " | " + r.errorClass + ": " + r.error : ""}${r.ok ? " | text=" + r.text : ""}`
      );
      if (r.ok) anyOk = true;
    }
  }

  process.exit(anyOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
