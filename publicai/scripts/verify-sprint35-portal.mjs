#!/usr/bin/env node
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const results = [];
const pass = (n, d = "") => {
  results.push({ ok: true, n, d });
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
};
const fail = (n, d = "") => {
  results.push({ ok: false, n, d });
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
};

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  console.log(`\n=== Sprint 35 Verify — ${baseUrl} ===\n`);
  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Login");
  const token = login.json.session.access_token;

  const overview = await api("/api/dashboard/overview", "GET", undefined, token);
  if (overview.ok && overview.json?.currentPlan != null && overview.json?.recentActivity) pass("Dashboard overview live");
  else fail("Dashboard overview live", overview.json?.error || `HTTP ${overview.status}`);

  const key = await api("/api/apikeys", "POST", { name: "sprint35-key", expiresAt: "2030-01-01" }, token);
  if (key.ok && key.json?.key?.key?.startsWith("zw_live_")) pass("API key create + one-time full display");
  else fail("API key create + one-time full display", key.json?.error || `HTTP ${key.status}`);

  const usage = await api("/api/usage?status=Success&page=1&pageSize=20", "GET", undefined, token);
  if (usage.ok && Array.isArray(usage.json?.records)) pass("Usage analytics query");
  else fail("Usage analytics query", usage.json?.error || `HTTP ${usage.status}`);

  const billing = await api("/api/billing", "GET", undefined, token);
  if (billing.ok && billing.json?.billing?.currentPlan != null) pass("Billing page data");
  else fail("Billing page data", billing.json?.error || `HTTP ${billing.status}`);

  const profile = await api("/api/profile", "GET", undefined, token);
  if (profile.ok && profile.json?.profile?.email) pass("Profile endpoint");
  else fail("Profile endpoint", profile.json?.error || `HTTP ${profile.status}`);

  const notifications = await api("/api/notifications", "GET", undefined, token);
  if (notifications.ok && notifications.json?.notifications) pass("Notifications endpoint");
  else fail("Notifications endpoint", notifications.json?.error || `HTTP ${notifications.status}`);

  const playground = await api("/api/openai-chat", "POST", { model: "gpt-4o", prompt: "reply ok" });
  if (playground.ok && String(playground.json?.content || "").trim()) pass("Playground OpenAI no regression");
  else fail("Playground OpenAI no regression", playground.json?.error || `HTTP ${playground.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
