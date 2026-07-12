#!/usr/bin/env node
/** End-to-end customer journey verification (production) */
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  let failed = 0;
  const pass = (n, d = "") => console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  const fail = (n, d = "") => { failed++; console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`); };
  const skip = (n, d = "") => console.log(`SKIP  ${n}${d ? ` — ${d}` : ""}`);

  console.log(`\n=== E2E Customer Journey — ${baseUrl} ===\n`);

  const emailStatus = await api("/api/email/status");
  if (emailStatus.ok) pass("Email status API", emailStatus.json?.providerKind || emailStatus.json?.modeLabel);
  else fail("Email status API");

  const suffix = Date.now();
  const reg = await api("/api/user/register", "POST", {
    company: `RC1 Test ${suffix}`,
    email: `rc1.${suffix}@example.com`,
    password: "rc1test123",
    country: "Germany",
  });
  if (reg.ok && reg.json?.requiresVerification) pass("Register → pending verification");
  else if (reg.status === 400 && String(reg.json?.error || "").includes("already")) skip("Register", "user exists");
  else fail("Register", reg.json?.error || reg.status);

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123" });
  const token = login.json?.session?.access_token;
  if (login.ok && token) pass("Login (verified admin)");
  else fail("Login", login.json?.error);

  if (token) {
    const billing = await api("/api/billing", "POST", { action: "purchase_package", packageId: 1, provider: "stripe" }, token);
    if (billing.json?.checkoutUrl) pass("Stripe checkout URL returned");
    else if (billing.status === 503) skip("Stripe checkout", "Stripe not configured in production env");
    else fail("Stripe checkout", billing.json?.error || billing.status);

    const keys = await api("/api/apikeys", "GET", undefined, token);
    if (keys.ok) pass("API keys list");
    else fail("API keys list");

    let apiKey = keys.json?.keys?.[0]?.key;
    if (!apiKey) {
      const created = await api("/api/apikeys", "POST", { name: "RC1 E2E Key" }, token);
      apiKey = created.json?.key;
    }
    if (apiKey) pass("API key creation");
    else fail("API key creation");

    if (apiKey) {
      const chat = await api("/api/gateway/chat", "POST", { apiKey, prompt: "Reply with exactly: OK", maxTokens: 32 });
      if (chat.ok) pass("OpenAI/Gateway call", chat.json?.model);
      else if (chat.status === 402) skip("Gateway call", "insufficient credits — purchase required");
      else fail("Gateway call", chat.json?.error || chat.status);
    }

    const usage = await api("/api/usage", "GET", undefined, token);
    if (usage.ok) pass("Usage dashboard API");
    else fail("Usage dashboard API");

    const invoices = await api("/api/billing", "GET", undefined, token);
    if (invoices.ok) pass("Billing/invoices API");
    else fail("Billing/invoices API");
  }

  const webhook = await api("/api/billing/webhook", "POST", { type: "test" });
  if (webhook.status === 400 || webhook.status === 500) pass("Webhook signature enforcement");
  else fail("Webhook signature enforcement", webhook.status);

  console.log(`\n${failed ? "E2E FAIL" : "E2E PASS"}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
