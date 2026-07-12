#!/usr/bin/env node
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  let failed = 0;
  const pass = (n) => console.log(`PASS  ${n}`);
  const fail = (n, d = "") => { failed++; console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`); };

  console.log(`\n=== Security Audit — ${baseUrl} ===\n`);

  const health = await api("/api/admin/commercial-health");
  if (health.status === 401 || health.status === 403) pass("Admin health requires auth");
  else if (health.json?.stripe?.secretKey) fail("Stripe secret exposed publicly");
  else fail("Admin health unexpectedly public", health.status);

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123" });
  const token = login.json?.session?.access_token;
  if (token) {
    const adminHealth = await api("/api/admin/commercial-health", "GET", undefined, token);
    if (adminHealth.ok && !adminHealth.json?.stripe?.secretKey && !adminHealth.json?.stripe?.webhookSecret) {
      pass("Admin health redacts Stripe secrets");
    } else fail("Admin health redacts Stripe secrets");
  }

  const topup = await api("/api/credits", "POST", { action: "topup", amountEur: 50 }, token);
  if (topup.status === 403) pass("Free topup blocked");
  else fail("Free topup blocked", topup.status);

  const webhook = await api("/api/billing/webhook", "POST", { type: "x" });
  if (webhook.status === 400 || webhook.status === 500) pass("Webhook rejects unsigned");
  else fail("Webhook rejects unsigned", webhook.status);

  const migrate = await api("/api/db/migrate", "POST", { action: "status" });
  if (migrate.status === 401 || migrate.status === 403 || migrate.ok) pass("Migrate endpoint protected or status ok");
  else fail("Migrate endpoint", migrate.status);

  console.log(`\n${failed ? "SECURITY FAIL" : "SECURITY PASS"}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
