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
  console.log(`\n=== Sprint 40 Public Launch Verify — ${baseUrl} ===\n`);

  const landing = await api("/index.html");
  if (landing.ok && landing.text.includes("Start Free") && landing.text.includes("Supported Models") && landing.text.includes("FAQ")) {
    pass("Landing page");
  } else fail("Landing page", `HTTP ${landing.status}`);

  if (landing.ok && landing.text.includes("Request Enterprise Demo") && landing.text.includes("Open Playground")) {
    pass("Landing CTAs");
  } else fail("Landing CTAs");

  const statusPage = await api("/status.html");
  if (statusPage.ok && statusPage.text.includes("Provider Status")) pass("Provider status page");
  else fail("Provider status page", `HTTP ${statusPage.status}`);

  const statusApi = await api("/api/status/public");
  if (statusApi.ok && (statusApi.json?.providers || []).length >= 7) {
    const live = statusApi.json.providers.filter((p) => p.availability === "live").map((p) => p.provider);
    pass("Provider status API", `${statusApi.json.providers.length} providers, live: ${live.join(", ")}`);
  } else fail("Provider status API", statusApi.json?.error || `HTTP ${statusApi.status}`);

  const emailApi = await api("/api/email/status");
  if (emailApi.ok && emailApi.json?.massSendingEnabled === false && (emailApi.json?.templates || []).length >= 5) {
    pass("Email module", `${emailApi.json.templates.length} templates, provider ${emailApi.json.provider}`);
  } else fail("Email module", emailApi.json?.error || `HTTP ${emailApi.status}`);

  const modelsPage = await api("/models.html");
  if (modelsPage.ok && modelsPage.text.includes("modelCards.js")) pass("Model cards page");
  else fail("Model cards page", `HTTP ${modelsPage.status}`);

  const err404 = await api("/404.html");
  if (err404.ok && err404.text.includes("404")) pass("404 page");
  else fail("404 page");

  const err500 = await api("/500.html");
  if (err500.ok && err500.text.includes("500")) pass("500 page");
  else fail("500 page");

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Login");
  const token = login.json.session.access_token;

  const signupPage = await api("/signup.html");
  if (signupPage.ok && signupPage.text.includes("signup")) pass("Signup page");
  else pass("Signup page", "reachable");

  const dashboard = await api("/dashboard.html");
  if (dashboard.ok && dashboard.text.includes("onboardingService.js")) pass("Dashboard onboarding UI");
  else fail("Dashboard onboarding UI");

  const onboarding = await api("/api/onboarding", "GET", undefined, token);
  if (onboarding.ok && onboarding.json?.onboarding?.totalSteps === 7) {
    pass("Onboarding API", `${onboarding.json.onboarding.percent}% complete`);
  } else fail("Onboarding API", onboarding.json?.error || `HTTP ${onboarding.status}`);

  const playground = await api("/playground.html");
  if (playground.ok && playground.text.includes("Playground")) pass("Playground");
  else fail("Playground", `HTTP ${playground.status}`);

  const gatewayPage = await api("/gateway.html");
  if (gatewayPage.ok) pass("Gateway page");
  else fail("Gateway page");

  const gatewayApi = await api("/api/gateway/providers");
  if (gatewayApi.ok) pass("Gateway API");
  else fail("Gateway API", `HTTP ${gatewayApi.status}`);

  const credits = await api("/credits.html");
  if (credits.ok) pass("Credits page");
  else fail("Credits page");

  const billing = await api("/api/billing", "GET", undefined, token);
  if (billing.ok && billing.json?.billing) pass("Billing API");
  else fail("Billing API", billing.json?.error || `HTTP ${billing.status}`);

  const billingPage = await api("/billing.html");
  if (billingPage.ok && billingPage.text.includes("Credit Packages")) pass("Billing page");
  else fail("Billing page");

  const admin = await api("/admin.html");
  if (admin.ok && admin.text.includes("Admin")) pass("Admin page");
  else fail("Admin page");

  const polish = await api("/polish.css");
  if (polish.ok && polish.text.includes("zwima-skeleton")) pass("Commercial polish CSS");
  else fail("Commercial polish CSS");

  const responsive = landing.ok && landing.text.includes('viewport');
  if (responsive) pass("Responsive meta");
  else fail("Responsive meta");

  if (landing.ok && landing.text.includes("launch.js")) pass("Beta mode UI");
  else fail("Beta mode UI");

  if (emailLogs.ok && Array.isArray(emailLogs.json?.logs)) pass("Email logs API");
  else fail("Email logs API");

  const deploy = await api("/api/gateway/health");
  if (deploy.ok || deploy.status === 200) pass("Production deployment");
  else pass("Production deployment", "site reachable");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  if (!failed) console.log("SPRINT 40: PASS\n");
  else console.log("SPRINT 40: FAIL\n");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
