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
  console.log(`\n=== Sprint 36 Verify — ${baseUrl} ===\n`);
  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Admin login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Admin login");
  const token = login.json.session.access_token;

  const adminHtml = await api("/admin.html");
  if (
    adminHtml.ok &&
    adminHtml.text.includes("Executive Overview") &&
    adminHtml.text.includes("Provider Status") &&
    adminHtml.text.includes("Revenue Dashboard") &&
    adminHtml.text.includes("System Health") &&
    adminHtml.text.includes("Security Dashboard") &&
    adminHtml.text.includes("Live Logs")
  ) {
    pass("Admin operations UI sections");
  } else fail("Admin operations UI sections", `HTTP ${adminHtml.status}`);

  const executive = await api("/api/admin/executive", "GET", undefined, token);
  if (executive.ok && executive.json?.totalUsers != null && executive.json?.systemHealth) pass("Executive dashboard");
  else fail("Executive dashboard", executive.json?.error || `HTTP ${executive.status}`);

  const users = await api("/api/admin/users?page=1&pageSize=10", "GET", undefined, token);
  if (users.ok && Array.isArray(users.json?.users)) pass("User management");
  else fail("User management", users.json?.error || `HTTP ${users.status}`);

  const providers = await api("/api/admin/providers", "GET", undefined, token);
  if (providers.ok && Array.isArray(providers.json) && providers.json.length >= 5) pass("Provider monitor");
  else fail("Provider monitor", providers.json?.error || `HTTP ${providers.status}`);

  const revenue = await api("/api/admin/revenue", "GET", undefined, token);
  if (revenue.ok && revenue.json?.revenueByDay && revenue.json?.subscriptionDistribution) pass("Revenue dashboard");
  else fail("Revenue dashboard", revenue.json?.error || `HTTP ${revenue.status}`);

  const health = await api("/api/admin/health", "GET", undefined, token);
  if (health.ok && Array.isArray(health.json) && health.json.length >= 8) pass("System health");
  else fail("System health", health.json?.error || `HTTP ${health.status}`);

  const security = await api("/api/admin/security", "GET", undefined, token);
  if (security.ok && security.json?.failedLogins != null && security.json?.blockedIps) pass("Security center");
  else fail("Security center", security.json?.error || `HTTP ${security.status}`);

  const logs = await api("/api/admin/logs?page=1&pageSize=20", "GET", undefined, token);
  if (logs.ok && Array.isArray(logs.json?.rows)) pass("Logs viewer");
  else fail("Logs viewer", logs.json?.error || `HTTP ${logs.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
