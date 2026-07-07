#!/usr/bin/env node
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const results = [];
const pass = (name, detail = "") => {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
};
const fail = (name, detail = "") => {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  console.log(`\n=== Sprint 37 Gateway Verify — ${baseUrl} ===\n`);

  const providers = await api("/api/gateway/providers");
  if (providers.ok && Array.isArray(providers.json?.providers) && providers.json.providers.length >= 9) {
    const openai = providers.json.providers.find((p) => p.providerId === "openai");
    const gemini = providers.json.providers.find((p) => p.providerId === "google");
    if (openai?.providerName && gemini?.providerName) {
      pass("Provider Registry", `${providers.json.count} providers`);
    } else fail("Provider Registry", "Missing OpenAI or Gemini");
  } else fail("Provider Registry", providers.json?.error || `HTTP ${providers.status}`);

  const models = await api("/api/gateway/models");
  if (models.ok && Array.isArray(models.json?.models) && models.json.models.length >= 10) {
    const hasOpenAI = models.json.models.some((m) => m.provider === "openai");
    const hasGemini = models.json.models.some((m) => m.provider === "google");
    if (hasOpenAI && hasGemini) pass("Model Registry", `${models.json.count} models`);
    else fail("Model Registry", "Missing OpenAI or Gemini models");
  } else fail("Model Registry", models.json?.error || `HTTP ${models.status}`);

  const health = await api("/api/gateway/health");
  if (health.ok && Array.isArray(health.json?.providers) && health.json.providers.length >= 9) {
    const labels = new Set(health.json.providers.map((p) => p.healthStatus));
    pass("Health Monitor", `${labels.size} status types — ${[...labels].join(", ")}`);
  } else fail("Health Monitor", health.json?.error || `HTTP ${health.status}`);

  const playground = await api("/playground.html");
  if (playground.ok && playground.text.includes("modelRegistry.js") && playground.text.includes("modelSelect")) {
    pass("Playground model selector");
  } else if (playground.ok && playground.text.includes("modelSelect")) {
    pass("Playground model selector");
  } else fail("Playground model selector", `HTTP ${playground.status}`);

  const openaiChat = await api("/api/openai-chat", "POST", { prompt: "Reply with exactly: OK", model: "gpt-4o", maxTokens: 16 });
  if (openaiChat.ok && String(openaiChat.json?.content || "").trim()) {
    pass("OpenAI provider", `latency ${openaiChat.json.latencyMs || "?"}ms`);
  } else fail("OpenAI provider", openaiChat.json?.error || `HTTP ${openaiChat.status}`);

  const geminiChat = await api("/api/gemini-chat", "POST", { prompt: "Reply with exactly: OK", model: "gemini-2-flash", maxTokens: 16 });
  if (geminiChat.ok && String(geminiChat.json?.content || "").trim()) {
    pass("Gemini provider", `latency ${geminiChat.json.latencyMs || "?"}ms`);
  } else fail("Gemini provider", geminiChat.json?.error || `HTTP ${geminiChat.status}`);

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  let token = null;
  if (login.ok && login.json?.session?.access_token) {
    token = login.json.session.access_token;
    pass("Admin login");
  } else fail("Admin login", login.json?.error || `HTTP ${login.status}`);

  if (token) {
    const adminProviders = await api("/api/admin/providers", "GET", undefined, token);
    if (adminProviders.ok && Array.isArray(adminProviders.json) && adminProviders.json.length >= 9) {
      const hasFields = adminProviders.json.every(
        (p) => p.priority != null && p.defaultModel && p.healthStatus && p.totalRequests != null
      );
      if (hasFields) pass("Admin Provider Manager", `${adminProviders.json.length} providers`);
      else fail("Admin Provider Manager", "Missing required fields");
    } else fail("Admin Provider Manager", adminProviders.json?.error || `HTTP ${adminProviders.status}`);
  }

  const gatewayNoKey = await api("/api/gateway/chat", "POST", { prompt: "test" });
  if (gatewayNoKey.status === 400 || gatewayNoKey.status === 401) {
    pass("Gateway routing auth", `HTTP ${gatewayNoKey.status}`);
  } else fail("Gateway routing auth", `Expected 400/401 got ${gatewayNoKey.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  if (!failed) {
    console.log("SPRINT 37: PASS\n");
  } else {
    console.log("SPRINT 37: FAIL\n");
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
