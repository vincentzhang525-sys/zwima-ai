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
  console.log(`\n=== Sprint 40 Final Launch Readiness — ${baseUrl} ===\n`);

  // Public launch pages
  const landing = await api("/index.html");
  if (landing.ok && landing.text.includes("Start Free") && landing.text.includes("launch.js")) pass("Homepage");
  else fail("Homepage", `HTTP ${landing.status}`);

  if (landing.ok && landing.text.includes("Waiting API Key") && landing.text.includes("Coming Soon")) pass("Supported models labels");
  else fail("Supported models labels");

  const pricing = await api("/pricing.html");
  if (pricing.ok && pricing.text.includes("STARTER")) pass("Pricing page");
  else fail("Pricing page");

  for (const page of ["cookie-policy.html", "dpa.html", "gdpr-export.html", "delete-account.html"]) {
    const r = await api(`/${page}`);
    if (r.ok) pass(`Legal: ${page}`);
    else fail(`Legal: ${page}`, `HTTP ${r.status}`);
  }

  const docs = await api("/documentation.html");
  if (docs.ok && docs.text.includes("Getting Started") && docs.text.includes("API Keys")) pass("Documentation");
  else fail("Documentation");

  for (const f of ["CHANGELOG.md", "RELEASE_NOTES.md", "LAUNCH_CHECKLIST.md"]) {
    const r = await api(`/${f}`);
    if (r.ok) pass(`Release doc: ${f}`);
    else fail(`Release doc: ${f}`);
  }

  // Customer flow
  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Login");
  const token = login.json.session.access_token;

  if ((await api("/signup.html")).ok) pass("Signup page");
  else fail("Signup page");

  if ((await api("/dashboard.html")).ok) pass("Dashboard");
  else fail("Dashboard");

  if ((await api("/playground.html")).ok) pass("Playground");
  else fail("Playground");

  if ((await api("/api/gateway/providers")).ok) pass("API Gateway");
  else fail("API Gateway");

  const keys = await api("/api/apikeys", "GET", undefined, token);
  if (keys.ok && Array.isArray(keys.json?.keys)) pass("API Keys");
  else fail("API Keys", keys.json?.error);

  if ((await api("/credits.html")).ok) pass("Credits page");
  else fail("Credits page");

  const credits = await api("/api/credits", "GET", undefined, token);
  if (credits.ok && credits.json?.wallet) pass("Credits API");
  else fail("Credits API");

  if ((await api("/usage.html")).ok) pass("Usage page");
  else fail("Usage page");

  const usage = await api("/api/usage", "GET", undefined, token);
  if (usage.ok && Array.isArray(usage.json?.records)) pass("Usage API");
  else fail("Usage API");

  const billing = await api("/api/billing", "GET", undefined, token);
  if (billing.ok && billing.json?.billing) pass("Billing API");
  else fail("Billing API");

  // Admin flow
  if ((await api("/admin.html")).ok) pass("Admin dashboard");
  else fail("Admin dashboard");

  const users = await api("/api/admin/users?page=1&pageSize=5", "GET", undefined, token);
  if (users.ok) pass("Admin users");
  else fail("Admin users");

  const revenue = await api("/api/admin/revenue", "GET", undefined, token);
  if (revenue.ok) pass("Admin revenue");
  else fail("Admin revenue");

  const providers = await api("/api/admin/providers", "GET", undefined, token);
  if (providers.ok && Array.isArray(providers.json)) pass("Admin providers");
  else fail("Admin providers");

  const logs = await api("/api/admin/logs?page=1&pageSize=10", "GET", undefined, token);
  if (logs.ok) pass("Admin logs");
  else fail("Admin logs");

  const security = await api("/api/admin/security", "GET", undefined, token);
  if (security.ok) pass("Admin security");
  else fail("Admin security");

  const health = await api("/api/admin/health", "GET", undefined, token);
  if (health.ok) pass("Admin health");
  else fail("Admin health");

  // Provider readiness
  const status = await api("/api/status/public");
  if (status.ok && (status.json?.providers || []).length >= 7) {
    const labels = status.json.providers.map((p) => `${p.provider}: ${p.availabilityLabel}`).join("; ");
    pass("Provider registry public", labels);
  } else fail("Provider registry public");

  const models = await api("/api/gateway/models");
  if (models.ok && (models.json?.models || []).length >= 10) pass("Model registry");
  else fail("Model registry");

  // Email
  const email = await api("/api/email/status");
  if (email.ok && email.json?.massSendingEnabled === false) pass("Email module");
  else fail("Email module");

  const emailLogs = await api("/api/email/logs");
  if (emailLogs.ok && Array.isArray(emailLogs.json?.logs)) pass("Email logs");
  else fail("Email logs");

  // Mobile
  if (landing.ok && landing.text.includes('viewport') && landing.text.includes('polish.css')) pass("Mobile responsive");
  else fail("Mobile responsive");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  if (!failed) console.log("SPRINT 40 FINAL: PASS\n");
  else console.log("SPRINT 40 FINAL: FAIL\n");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
