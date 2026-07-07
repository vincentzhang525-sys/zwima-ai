#!/usr/bin/env node
/**
 * Sprint 41.1 — Email Provider Cleanup verification.
 * Usage: node scripts/verify-sprint41-1-email.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const results = [];
const pass = (n, d = "") => {
  results.push({ ok: true, name: n });
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
};
const fail = (n, d = "") => {
  results.push({ ok: false, name: n });
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
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
    json = {};
  }
  return { ok: res.ok, status: res.status, json, text };
}

function logsFor(logs, template, to) {
  return (logs || []).filter(
    (l) =>
      l.template === template &&
      (!to || String(l.to || "").toLowerCase() === to.toLowerCase()) &&
      l.provider !== "supabase"
  );
}

async function main() {
  console.log(`\n=== Sprint 41.1 Email Provider Cleanup — ${baseUrl} ===\n`);

  const ts = Date.now();
  const testEmail = `email-s411-${ts}@zwima-group.info`;
  const testPassword = `EmailTest${String(ts).slice(-6)}!`;

  const status = await api("/api/email/status");
  if (status.ok && status.json?.supabaseEmailDisabled === true) {
    pass("Supabase email disabled");
  } else {
    fail("Supabase email disabled", status.json?.error || "flag missing");
  }

  if (status.ok && status.json?.massSendingEnabled === false) pass("Mass sending disabled");
  else fail("Mass sending disabled");

  const kind = status.json?.providerKind;
  if (status.ok && (kind === "smtp" || kind === "mock" || kind === "mock-fallback")) {
    pass("Email provider policy", `${status.json.emailMode} (${kind})`);
  } else {
    fail("Email provider policy", kind || "unknown");
  }

  if (status.ok && status.json?.smtpFallback !== undefined) pass("SMTP mock fallback", String(status.json.smtpFallback));
  else fail("SMTP mock fallback");

  const supported = status.json?.supportedSmtpProviders || [];
  if (supported.includes("ionos") && supported.includes("resend") && supported.includes("postmark")) {
    pass("Future SMTP providers listed", supported.join(", "));
  } else {
    fail("Future SMTP providers listed");
  }

  const logsBefore = await api("/api/email/logs?limit=100");
  const beforeCount = (logsBefore.json?.logs || []).length;

  // Register — verifyEmail + welcome via app provider
  const reg = await api("/api/user/register", "POST", {
    email: testEmail,
    password: testPassword,
    company: `Email Test ${ts}`,
    country: "Germany",
  });
  if (reg.ok && reg.json?.session?.access_token && reg.json?.appEmail !== false) {
    pass("Register (app email)", reg.json?.appEmail ? "appEmail" : "session ok");
  } else {
    fail("Register (app email)", reg.json?.error || `HTTP ${reg.status}`);
    process.exit(1);
  }
  const token = reg.json.session.access_token;

  await new Promise((r) => setTimeout(r, 600));
  const logsAfterReg = await api("/api/email/logs?limit=100");
  const regLogs = logsAfterReg.json?.logs || [];
  if (logsFor(regLogs, "verifyEmail", testEmail).length) pass("Verify email (app provider)");
  else fail("Verify email (app provider)");
  if (logsFor(regLogs, "welcome", testEmail).length) pass("Welcome email (app provider)");
  else fail("Welcome email (app provider)");

  // Password reset
  const forgot = await api("/api/user/forgot-password", "POST", { email: testEmail });
  if (forgot.ok && forgot.json?.appEmail) pass("Password reset request (app email)");
  else fail("Password reset request", forgot.json?.error || `HTTP ${forgot.status}`);

  await new Promise((r) => setTimeout(r, 400));
  const logsAfterForgot = await api("/api/email/logs?limit=100");
  if (logsFor(logsAfterForgot.json?.logs, "passwordReset", testEmail).length) {
    pass("Password reset email (app provider)");
  } else {
    fail("Password reset email (app provider)");
  }

  // API key email
  const key = await api("/api/apikeys", "POST", { name: `email-test-${ts}` }, token);
  if (key.ok && key.json?.key?.key) pass("API key created");
  else fail("API key created", key.json?.error);

  await new Promise((r) => setTimeout(r, 400));
  const logsAfterKey = await api("/api/email/logs?limit=100");
  if (logsFor(logsAfterKey.json?.logs, "apiKeyCreated", testEmail).length) {
    pass("API key email (app provider)");
  } else {
    fail("API key email (app provider)");
  }

  // Billing + credits email
  const billing = await api("/api/billing", "GET", undefined, token);
  const pkg = billing.json?.billing?.creditPackages?.[0];
  if (pkg?.id) {
    const purchase = await api(
      "/api/billing",
      "POST",
      { action: "purchase_package", packageId: pkg.id, provider: "stripe" },
      token
    );
    if (purchase.ok) pass("Credit purchase (triggers email)");
    else fail("Credit purchase", purchase.json?.error);

    await new Promise((r) => setTimeout(r, 500));
    const logsAfterPurchase = await api("/api/email/logs?limit=100");
    if (logsFor(logsAfterPurchase.json?.logs, "creditPurchase", testEmail).length) {
      pass("Credits email (app provider)");
    } else {
      fail("Credits email (app provider)");
    }
  } else {
    fail("Credit purchase", "no package");
    fail("Credits email (app provider)", "skipped");
  }

  const upgrade = await api("/api/billing", "POST", { action: "upgrade", plan: "starter", provider: "stripe" }, token);
  if (upgrade.ok) pass("Billing upgrade (triggers receipt)");
  else fail("Billing upgrade", upgrade.json?.error);

  await new Promise((r) => setTimeout(r, 500));
  const logsFinal = await api("/api/email/logs?limit=100");
  const billingLogs = logsFor(logsFinal.json?.logs, "billingReceipt", testEmail);
  if (billingLogs.length) pass("Billing email (app provider)");
  else fail("Billing email (app provider)");

  const allLogs = logsFinal.json?.logs || [];
  const newLogs = allLogs.slice(0, Math.max(0, allLogs.length - beforeCount + 20));
  const supabaseLogs = newLogs.filter((l) => String(l.provider || "").toLowerCase() === "supabase");
  if (!supabaseLogs.length) pass("No Supabase email provider in logs");
  else fail("No Supabase email provider in logs", `${supabaseLogs.length} found`);

  const validProviders = new Set(["mock", "smtp", "ionos", "resend", "postmark", "disabled"]);
  const badProvider = newLogs.find((l) => l.provider && !validProviders.has(l.provider) && !String(l.provider).startsWith("mock"));
  if (!badProvider) pass("All emails via app providers");
  else fail("All emails via app providers", badProvider.provider);

  // Cleanup test account
  const adminLogin = await api("/api/user/login", "POST", {
    email: "admin@zwima-group.info",
    password: "admin123",
  });
  if (adminLogin.ok && reg.json?.user?.id) {
    await api("/api/admin/users-toggle", "POST", { userId: reg.json.user.id, enabled: false }, adminLogin.json.session.access_token);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  console.log(failed ? "SPRINT 41.1: FAIL\n" : "SPRINT 41.1: PASS\n");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
