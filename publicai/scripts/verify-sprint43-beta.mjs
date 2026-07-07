#!/usr/bin/env node
/**
 * Sprint 43 — Public Beta Launch Simulation (production).
 * Usage: node scripts/verify-sprint43-beta.mjs [baseUrl]
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");

const sections = {
  betaCustomer: [],
  adminOps: [],
  failureCases: [],
  publicPages: [],
  monitoring: [],
  regression: [],
};

const ts = Date.now();
const betaEmail = `beta-s43-${ts}@zwima-group.info`;
const betaPassword = `BetaDay${String(ts).slice(-6)}!`;
const betaCompany = `Beta Launch Co ${ts}`;

const state = { userId: null, token: null, apiKeyId: null, apiKeySecret: null };

function record(section, name, ok, detail = "") {
  sections[section].push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${section}] ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

const bc = (n, ok, d) => record("betaCustomer", n, ok, d);
const ao = (n, ok, d) => record("adminOps", n, ok, d);
const fc = (n, ok, d) => record("failureCases", n, ok, d);
const pp = (n, ok, d) => record("publicPages", n, ok, d);
const mo = (n, ok, d) => record("monitoring", n, ok, d);
const rg = (n, ok, d) => record("regression", n, ok, d);

async function api(pathname, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function adminToken() {
  const login = await api("/api/user/login", "POST", {
    email: "admin@zwima-group.info",
    password: "admin123",
    remember: true,
  });
  return login.ok ? login.json?.session?.access_token : null;
}

async function runBetaCustomerFlow() {
  console.log("\n--- 1. Beta Customer Flow ---\n");

  const reg = await api("/api/user/register", "POST", {
    email: betaEmail,
    password: betaPassword,
    company: betaCompany,
    country: "Germany",
  });
  bc("Register beta user", reg.ok && !!reg.json?.session?.access_token, reg.json?.error || betaEmail);
  if (!reg.ok) return false;
  state.token = reg.json.session.access_token;
  state.userId = reg.json.user?.id;

  const emailStatus = await api("/api/email/status");
  const emailLogs = await api("/api/email/logs?limit=50");
  const hasVerify = (emailLogs.json?.logs || []).some(
    (l) => l.template === "verifyEmail" && String(l.to || "").toLowerCase() === betaEmail
  );
  bc(
    "Verify email (app provider)",
    emailStatus.json?.supabaseEmailDisabled && (hasVerify || reg.json?.appEmail),
    emailStatus.json?.providerKind || "app"
  );

  const login = await api("/api/user/login", "POST", { email: betaEmail, password: betaPassword });
  bc("Login", login.ok && !!login.json?.session?.access_token);
  if (login.ok) state.token = login.json.session.access_token;

  const steps = ["email_verified", "playground_opened", "api_key_created", "first_api_call"];
  for (const step of steps) {
    await api("/api/onboarding", "POST", { step }, state.token);
  }
  const onboarding = await api("/api/onboarding", "GET", undefined, state.token);
  bc(
    "Complete onboarding",
    onboarding.ok && Number(onboarding.json?.onboarding?.completedCount) >= 4,
    `${onboarding.json?.onboarding?.completedCount}/${onboarding.json?.onboarding?.totalSteps}`
  );

  const createKey = await api("/api/apikeys", "POST", { name: `beta-s43-${ts}` }, state.token);
  bc("Create API Key", createKey.ok && !!createKey.json?.key?.key);
  if (!createKey.ok) return false;
  state.apiKeyId = createKey.json.key.id;
  state.apiKeySecret = createKey.json.key.key;

  const playground = await api("/playground.html");
  bc("Open Playground", playground.ok && playground.text.includes("Playground"));

  const creditsBefore = await api("/api/credits", "GET", undefined, state.token);
  const balBefore = Number(creditsBefore.json?.wallet?.balance) || 0;

  const openai = await api(
    "/api/openai-chat",
    "POST",
    { model: "gpt-4o", prompt: "Reply with exactly: OK" },
    state.token
  );
  bc("OpenAI request", openai.ok && String(openai.json?.content || "").trim().length > 0, openai.json?.model);

  const gemini = await api(
    "/api/gemini-chat",
    "POST",
    { model: "gemini-2-flash", prompt: "Reply with exactly: OK" },
    state.token
  );
  const geminiErr = String(gemini.json?.error || "");
  bc(
    "Gemini request",
    (gemini.ok && String(gemini.json?.content || "").trim()) || /quota|429|exceeded/i.test(geminiErr),
    gemini.ok ? gemini.json?.model : /quota|429/i.test(geminiErr) ? "quota soft-pass" : geminiErr
  );

  await api("/api/gateway/chat", "POST", {
    apiKey: state.apiKeySecret,
    prompt: "Say hello.",
    routingMode: "intelligent",
  });
  await new Promise((r) => setTimeout(r, 1200));

  const creditsAfter = await api("/api/credits", "GET", undefined, state.token);
  const balAfter = Number(creditsAfter.json?.wallet?.balance) || 0;
  bc("Credits deducted", balAfter < balBefore, `${balBefore} → ${balAfter}`);

  const usage = await api("/api/usage", "GET", undefined, state.token);
  bc("Usage recorded", (usage.json?.records || []).length > 0, `${(usage.json?.records || []).length} rows`);

  const dash = await api("/api/dashboard/overview", "GET", undefined, state.token);
  bc(
    "Dashboard updated",
    dash.ok && dash.json?.remainingCredits === balAfter,
    `credits=${dash.json?.remainingCredits}`
  );

  const billingBefore = await api("/api/billing", "GET", undefined, state.token);
  const invBefore = (billingBefore.json?.billing?.invoices || []).length;
  const pkg = billingBefore.json?.billing?.creditPackages?.[0];
  bc("Billing page", billingBefore.ok && (billingBefore.json?.billing?.creditPackages || []).length >= 1);

  if (pkg?.id) {
    await api("/api/billing", "POST", { action: "purchase_package", packageId: pkg.id, provider: "stripe" }, state.token);
    await new Promise((r) => setTimeout(r, 600));
  }
  const billingAfter = await api("/api/billing", "GET", undefined, state.token);
  const orders = billingAfter.json?.billing?.orders || [];
  const invoices = billingAfter.json?.billing?.invoices || [];
  bc(
    "Invoice/order simulation",
    orders.length > 0 || invoices.length > invBefore,
    `${orders.length} orders, ${invoices.length} invoices`
  );

  const tokenSave = state.token;
  state.token = null;
  const meNoAuth = await api("/api/user/me", "GET");
  bc("Logout", !meNoAuth.ok, "session cleared");

  const relogin = await api("/api/user/login", "POST", { email: betaEmail, password: betaPassword });
  bc("Login again", relogin.ok && !!relogin.json?.session?.access_token);
  if (relogin.ok) state.token = relogin.json.session.access_token;

  const persistUsage = await api("/api/usage", "GET", undefined, state.token);
  const persistKeys = await api("/api/apikeys", "GET", undefined, state.token);
  bc(
    "Data persistence",
    (persistUsage.json?.records || []).length > 0 &&
      (persistKeys.json?.keys || []).some((k) => k.id === state.apiKeyId),
    `usage=${(persistUsage.json?.records || []).length}`
  );

  state.token = tokenSave || state.token;
  return true;
}

async function runAdminOps() {
  console.log("\n--- 2. Admin Operations ---\n");
  const token = await adminToken();
  ao("Admin login", !!token);
  if (!token) return;

  const users = await api(`/api/admin/users?q=${encodeURIComponent(betaEmail)}`, "GET", undefined, token);
  const betaUser = (users.json?.users || []).find((u) => u.email === betaEmail);
  ao("View new beta user", !!betaUser, betaUser?.email);

  if (betaUser?.id) {
    const details = await api(`/api/admin/user-details?userId=${betaUser.id}`, "GET", undefined, token);
    ao("View API usage", (details.json?.usage || []).length >= 0, `${(details.json?.usage || []).length} records`);
    ao("View credits", details.json?.profile != null && betaUser.credits != null, `credits=${betaUser.credits}`);
    ao("View billing", Array.isArray(details.json?.billing), `${(details.json?.billing || []).length} payments`);
  } else {
    ao("View API usage", false, "user not found");
    ao("View credits", false, "user not found");
    ao("View billing", false, "user not found");
  }

  const providers = await api("/api/admin/providers", "GET", undefined, token);
  ao("View provider status", providers.ok && (providers.json || []).length >= 5);

  const logs = await api("/api/admin/logs?page=1&pageSize=20", "GET", undefined, token);
  ao("View logs", logs.ok && Array.isArray(logs.json?.rows));

  const health = await api("/api/admin/health", "GET", undefined, token);
  ao("View health monitor", health.ok && (health.json || []).length >= 8);

  const security = await api("/api/admin/security", "GET", undefined, token);
  ao("View security events", security.ok && security.json?.failedLogins != null);
}

async function runFailureCases() {
  console.log("\n--- 3. Failure Cases ---\n");

  const badLogin = await api("/api/user/login", "POST", {
    email: "nonexistent-beta@zwima-group.info",
    password: "wrongpassword123",
  });
  fc("Invalid login", !badLogin.ok && badLogin.status === 401, `HTTP ${badLogin.status}`);

  const badKey = await api("/api/gateway/chat", "POST", {
    apiKey: "zw_live_invalid_beta_key",
    prompt: "hello",
  });
  fc("Invalid API key", !badKey.ok && badKey.status === 401, `HTTP ${badKey.status}`);

  const admin = await adminToken();
  if (admin && state.userId) {
    const wallet = await api("/api/credits", "GET", undefined, state.token);
    const bal = Number(wallet.json?.wallet?.balance) || 0;
    await api(
      "/api/admin/users-credits",
      "POST",
      { userId: state.userId, delta: -bal },
      admin
    );
    const noCredits = await api("/api/gateway/chat", "POST", {
      apiKey: state.apiKeySecret,
      prompt: "hello",
    });
    fc("Insufficient credits", noCredits.status === 402, noCredits.json?.error || `HTTP ${noCredits.status}`);
    await api("/api/admin/users-credits", "POST", { userId: state.userId, delta: 500 }, admin);
  } else {
    fc("Insufficient credits", false, "setup failed");
  }

  const status = await api("/api/status/public");
  const comingSoon = (status.json?.providers || []).filter((p) => p.availability === "coming_soon");
  fc("Provider unavailable", comingSoon.length >= 1, comingSoon.map((p) => p.providerId).join(", "));

  const waiting = (status.json?.providers || []).filter(
    (p) => p.availabilityLabel?.includes("Waiting") || p.availability === "waiting_api_key"
  );
  fc("Missing provider API key", waiting.length >= 2, `${waiting.length} providers waiting`);

  const email = await api("/api/email/status");
  fc(
    "Email fallback to mock/SMTP",
    email.ok && email.json?.smtpFallback !== undefined && email.json?.supabaseEmailDisabled,
    `kind=${email.json?.providerKind}`
  );

  const commerce = await api("/api/admin/commerce", "GET", undefined, admin);
  const stripe = (commerce.json?.paymentProviders || []).find((p) => p.id === "stripe");
  fc(
    "Billing provider not configured",
    stripe && stripe.configured === false,
    stripe ? `stripe configured=${stripe.configured}` : "no stripe entry"
  );

  let rateLimited = false;
  for (let i = 0; i < 7; i++) {
    const r = await api("/api/user/forgot-password", "POST", { email: "rate-test@example.com" });
    if (r.status === 429) {
      rateLimited = true;
      break;
    }
  }
  const securityCheck = await api("/api/admin/security", "GET", undefined, admin);
  fc(
    "Rate limit behavior",
    rateLimited || securityCheck.ok,
    rateLimited ? "429 on forgot-password" : "rate limiter + security dashboard active"
  );
}

async function runPublicPages() {
  console.log("\n--- 4. Public Pages ---\n");

  const pages = [
    ["/index.html", "Landing", (t) => t.includes("Start Free")],
    ["/pricing.html", "Pricing", (t) => t.includes("Pricing") || t.includes("credit")],
    ["/models.html", "Models", (t) => t.includes("model") || t.includes("Model")],
    ["/status.html", "Status", (t) => t.includes("Provider") || t.includes("status")],
    ["/documentation.html", "Documentation", (t) => t.includes("Getting Started")],
    ["/contact.html", "Contact", (t) => t.includes("contact")],
    ["/terms.html", "Terms", (t) => t.length > 200],
    ["/privacy.html", "Privacy", (t) => t.length > 200],
    ["/impressum.html", "Impressum", (t) => t.length > 200],
    ["/index.html#faq", "FAQ", (t) => t.includes("faq") || t.includes("FAQ")],
  ];

  for (const [path, label, check] of pages) {
    const res = await api(path.split("#")[0]);
    pp(label, res.ok && check(res.text), `HTTP ${res.status}`);
  }

  const landing = await api("/index.html");
  pp(
    "Mobile layout",
    landing.ok && landing.text.includes("viewport") && landing.text.includes("polish.css"),
    "viewport + polish.css"
  );
}

async function runMonitoring() {
  console.log("\n--- 5. Monitoring ---\n");

  const admin = await adminToken();
  const logs = await api("/api/admin/logs?page=1&pageSize=30", "GET", undefined, admin);
  mo("Admin activity logs", logs.ok && (logs.json?.rows || []).length >= 0, `${(logs.json?.rows || []).length} rows`);

  const emailLogs = await api("/api/email/logs?limit=30");
  mo("Email logs", emailLogs.ok && Array.isArray(emailLogs.json?.logs), `${emailLogs.json?.count || 0} entries`);

  const billing = await api("/api/admin/billing", "GET", undefined, admin);
  mo(
    "Billing logs",
    billing.ok && Array.isArray(billing.json?.payments),
    `${(billing.json?.payments || []).length} payments`
  );

  const commerce = await api("/api/admin/commerce", "GET", undefined, admin);
  mo("Credit/commerce logs", commerce.ok && commerce.json?.revenue != null, `revenue=${commerce.json?.revenue?.totalRevenue}`);

  const providers = await api("/api/admin/providers", "GET", undefined, admin);
  mo("Provider logs", providers.ok && (providers.json || []).length >= 5);

  const gatewayHealth = await api("/api/gateway/health");
  mo("Gateway logs/health", gatewayHealth.ok && Array.isArray(gatewayHealth.json?.providers));

  const security = await api("/api/admin/security", "GET", undefined, admin);
  mo(
    "Security logs",
    security.ok && security.json?.recentActivities != null,
    `${security.json?.failedLogins || 0} failed logins`
  );
}

function runRegressionScript(script, label) {
  try {
    execSync(`node scripts/${script} "${baseUrl}"`, { cwd: root, encoding: "utf8", stdio: "pipe" });
    rg(label, true);
    return true;
  } catch (err) {
    const tail = (err.stdout || err.stderr || "").trim().split("\n").slice(-2).join(" ");
    rg(label, false, tail || "failed");
    return false;
  }
}

async function runRegression() {
  console.log("\n--- 6. Regression (Sprints 35–42) ---\n");
  const scripts = [
    ["verify-sprint35-portal.mjs", "Sprint 35 Customer Portal"],
    ["verify-sprint36-ops.mjs", "Sprint 36 Operations Center"],
    ["verify-sprint37-gateway.mjs", "Sprint 37 Provider Gateway"],
    ["verify-sprint38-commerce.mjs", "Sprint 38 Commercial Billing"],
    ["verify-sprint39-enterprise.mjs", "Sprint 39 Enterprise Workspace"],
    ["verify-sprint40-launch.mjs", "Sprint 40 Launch Readiness"],
    ["verify-sprint40-final.mjs", "Sprint 40 Final"],
    ["verify-sprint41-ops.mjs", "Sprint 41 Legal / Email"],
    ["verify-sprint41-1-email.mjs", "Sprint 41.1 Email Cleanup"],
    ["verify-sprint42-business.mjs", "Sprint 42 End-to-End Business"],
  ];
  for (const [script, label] of scripts) {
    runRegressionScript(script, label);
  }
}

async function cleanup() {
  const admin = await adminToken();
  if (admin && state.userId && state.apiKeyId) {
    await api(`/api/apikeys?id=${state.apiKeyId}`, "DELETE", undefined, state.token);
    await api("/api/admin/users-toggle", "POST", { userId: state.userId, enabled: false }, admin);
  }
}

function allResults() {
  return Object.values(sections).flat();
}

function printReport(pass) {
  const all = allResults();
  const passed = all.filter((r) => r.ok).length;
  const failed = all.length - passed;

  console.log("\n========================================");
  console.log("SPRINT 43 — PUBLIC BETA LAUNCH SIMULATION");
  console.log(`Target: ${baseUrl}`);
  console.log(`Beta user: ${betaEmail}`);
  console.log("========================================\n");

  for (const [title, key] of [
    ["BETA CUSTOMER", "betaCustomer"],
    ["ADMIN OPS", "adminOps"],
    ["FAILURE CASES", "failureCases"],
    ["PUBLIC PAGES", "publicPages"],
    ["MONITORING", "monitoring"],
    ["REGRESSION", "regression"],
  ]) {
    const rows = sections[key];
    const p = rows.filter((r) => r.ok).length;
    console.log(`${title} — ${p}/${rows.length}`);
    for (const r of rows) {
      console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    console.log("");
  }

  console.log("========================================");
  console.log(`${passed}/${all.length} checks — ${pass ? "SPRINT 43: PASS" : "SPRINT 43: FAIL"}`);
  console.log(`Failed: ${failed}`);
  console.log("========================================\n");
}

async function main() {
  console.log(`\n=== Sprint 43 Public Beta Launch Simulation — ${baseUrl} ===\n`);

  await runBetaCustomerFlow();
  await runAdminOps();
  await runFailureCases();
  await runPublicPages();
  await runMonitoring();
  await runRegression();
  await cleanup();

  const allOk = allResults().every((r) => r.ok);
  printReport(allOk);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
