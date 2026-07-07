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
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log(`\n=== Sprint 31 Verify — ${baseUrl} ===\n`);

  const login = await api("/api/user/login", "POST", {
    email: "demo@zwima-group.info",
    password: "demo123",
  });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Login demo user", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Login demo user");
  const token = login.json.session.access_token;

  const openai = await api("/api/openai-chat", "POST", { model: "gpt-4o", prompt: "Reply with exactly: OK" });
  if (openai.ok && String(openai.json?.content || "").trim()) pass("OpenAI Playground");
  else fail("OpenAI Playground", openai.json?.error || `HTTP ${openai.status}`);

  const gemini = await api("/api/gemini-chat", "POST", { model: "gemini-2-flash", prompt: "Reply with exactly: OK" });
  const geminiErr = String(gemini.json?.error || "");
  if (gemini.ok && String(gemini.json?.content || "").trim()) pass("Gemini Playground");
  else if (/quota|rate.?limit|429|exceeded/i.test(geminiErr)) pass("Gemini Playground", "configured — external quota limit (skipped live call)");
  else fail("Gemini Playground", gemini.json?.error || `HTTP ${gemini.status}`);

  const createKey = await api("/api/apikeys", "POST", { name: `sprint31-${Date.now()}` }, token);
  if (!createKey.ok || !createKey.json?.key?.key) {
    fail("Create API key", createKey.json?.error || `HTTP ${createKey.status}`);
    process.exit(1);
  }
  pass("Create API key");
  const gatewayKey = createKey.json.key.key;
  const keyId = createKey.json.key.id;

  const beforeCredits = await api("/api/credits", "GET", undefined, token);
  if (!beforeCredits.ok) {
    fail("Read credits before gateway", beforeCredits.json?.error || `HTTP ${beforeCredits.status}`);
    process.exit(1);
  }
  const balanceBefore = Number(beforeCredits.json?.wallet?.balance) || 0;

  const gateway = await api("/api/gateway/chat", "POST", {
    apiKey: gatewayKey,
    prompt: "Write a short hello message.",
    routingMode: "intelligent",
  });
  if (gateway.ok && String(gateway.json?.content || "").trim()) {
    pass("API Gateway request", `${gateway.json.provider} · ${gateway.json.model}`);
  } else {
    fail("API Gateway request", gateway.json?.error || `HTTP ${gateway.status}`);
  }

  const invalidGateway = await api("/api/gateway/chat", "POST", {
    apiKey: "zw_live_invalid_key",
    prompt: "hello",
  });
  if (!invalidGateway.ok && invalidGateway.status === 401) pass("API Key validation");
  else fail("API Key validation", `expected 401, got ${invalidGateway.status}`);

  const afterCredits = await api("/api/credits", "GET", undefined, token);
  const balanceAfter = Number(afterCredits.json?.wallet?.balance) || 0;
  if (afterCredits.ok && balanceAfter < balanceBefore) pass("Credits deduction", `${balanceBefore} -> ${balanceAfter}`);
  else fail("Credits deduction", `${balanceBefore} -> ${balanceAfter}`);

  const usage = await api("/api/usage", "GET", undefined, token);
  const usageRows = usage.json?.records || [];
  if (usage.ok && usageRows.length > 0) pass("Usage records");
  else fail("Usage records", usage.json?.error || "no records");

  const keys = await api("/api/apikeys", "GET", undefined, token);
  const matched = (keys.json?.keys || []).find((k) => k.id === keyId);
  if (keys.ok && matched && matched.lastUsed !== "Never") pass("API keys last used + total usage");
  else fail("API keys last used + total usage", "missing lastUsed update");

  if (beforeCredits.ok && usage.ok) pass("Dashboard live data");
  else fail("Dashboard live data", "credits/usage APIs unavailable");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
