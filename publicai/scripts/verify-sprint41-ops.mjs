#!/usr/bin/env node
/**
 * Sprint 41 — Production Operations & Legal Readiness verification.
 * Usage: node scripts/verify-sprint41-ops.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const results = [];
const pass = (n, d = "") => { results.push({ ok: true, name: n }); console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`); };
const fail = (n, d = "") => { results.push({ ok: false, name: n }); console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`); };

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  console.log(`\n=== Sprint 41 Ops & Legal Verify — ${baseUrl} ===\n`);

  const email = await api("/api/email/status");
  const templates = (email.json?.templates || []).map((t) => t.name);
  const requiredTemplates = ["welcome", "passwordReset", "billingReceipt", "creditPurchase", "apiKeyCreated"];
  if (email.ok && email.json?.massSendingEnabled === false) pass("Email module");
  else fail("Email module");
  if (email.ok && email.json?.supabaseEmailDisabled === true) pass("Supabase email disabled");
  else fail("Supabase email disabled");
  if (email.ok && email.json?.smtpFallback !== undefined) pass("SMTP fallback flag", String(email.json.smtpFallback));
  else fail("SMTP fallback flag");
  for (const t of requiredTemplates) {
    if (templates.includes(t)) pass(`Email template: ${t}`);
    else fail(`Email template: ${t}`);
  }

  const logs = await api("/api/email/logs");
  if (logs.ok && Array.isArray(logs.json?.logs)) pass("Email logs API");
  else fail("Email logs API");

  const legalPages = [
    "impressum.html", "privacy.html", "cookie-policy.html", "terms.html",
    "dpa.html", "gdpr-export.html", "delete-account.html",
    "api-terms.html", "rate-limit-policy.html", "refund-policy.html",
  ];
  for (const p of legalPages) {
    const r = await api(`/${p}`);
    if (r.ok && r.text.length > 200) pass(`Legal: ${p}`);
    else fail(`Legal: ${p}`, `HTTP ${r.status}`);
  }

  const contact = await api("/contact.html");
  if (contact.ok && contact.text.includes("contactForm") && contact.text.includes("website")) pass("Contact page");
  else fail("Contact page");

  const contactApi = await api("/api/contact", "POST", { name: "Test", company: "Test Co", email: "not-an-email", message: "short" });
  if (contactApi.status === 400) pass("Contact validation");
  else fail("Contact validation", `HTTP ${contactApi.status}`);

  const honeypot = await api("/api/contact", "POST", {
    name: "Bot", company: "Bot Inc", email: "bot@example.com", message: "spam message here", website: "http://spam.com",
  });
  if (honeypot.ok && honeypot.json?.ok) pass("Contact anti-spam honeypot");
  else fail("Contact anti-spam honeypot");

  const docs = await api("/documentation.html");
  if (docs.ok && docs.text.includes("Getting Started") && docs.text.includes("python-sdk") && docs.text.includes("node-sdk")) pass("Documentation");
  else fail("Documentation");

  const status = await api("/api/status/public");
  if (status.ok && (status.json?.providers || []).length >= 5) {
    const names = status.json.providers.map((p) => p.provider).join(", ");
    pass("Status API", names);
    const hasLatency = status.json.providers.every((p) => p.latencyMs != null && p.healthLabel);
    if (hasLatency) pass("Status health/latency");
    else fail("Status health/latency");
  } else fail("Status API");

  const statusPage = await api("/status.html");
  if (statusPage.ok && statusPage.text.includes("Provider Status")) pass("Status page");
  else fail("Status page");

  const landing = await api("/index.html");
  if (landing.ok && landing.text.includes("api-terms.html") && landing.text.includes("refund-policy.html")) pass("Footer legal links");
  else fail("Footer legal links");

  if (landing.ok && landing.text.includes("viewport")) pass("Responsive");
  else fail("Responsive");

  for (const f of ["CHANGELOG.md", "RELEASE_NOTES.md", "ROADMAP.md", "KNOWN_LIMITATIONS.md"]) {
    const r = await api(`/${f}`);
    if (r.ok) pass(`Release doc: ${f}`);
    else fail(`Release doc: ${f}`);
  }

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123" });
  if (login.ok) pass("Regression login");
  else fail("Regression login");

  const gw = await api("/api/gateway/health");
  if (gw.ok) pass("Regression gateway");
  else fail("Regression gateway");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  console.log(failed ? "SPRINT 41: FAIL\n" : "SPRINT 41: PASS\n");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
