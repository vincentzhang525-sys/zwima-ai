#!/usr/bin/env node
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");

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
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log(`\n=== Phase 3A Commercial Verify — ${baseUrl} ===\n`);
  let failed = 0;
  const pass = (n, d = "") => console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  const fail = (n, d = "") => {
    failed += 1;
    console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
  };

  const email = await api("/api/email/status");
  if (email.ok && email.json?.supabaseEmailDisabled) pass("Email status API");
  else fail("Email status API", email.json?.error || email.status);

  if (email.json?.templates?.some((t) => t.name === "supportTicketUpdate")) pass("Support ticket email template listed");
  else fail("Support ticket email template listed");

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  const token = login.json?.session?.access_token;
  if (login.ok && token) pass("Admin login");
  else fail("Admin login");

  if (token) {
    const health = await api("/api/admin/commercial-health", "GET", undefined, token);
    if (health.ok && health.json?.runtime) pass("Commercial health admin API", health.json.runtime.stripeMode);
    else fail("Commercial health admin API", health.json?.error || health.status);

    if (health.json?.stripe?.keys?.secretKeyConfigured === false || health.json?.stripe?.keys?.secretKeyPreview) {
      pass("Stripe secrets redacted in admin health");
    } else fail("Stripe secrets redacted in admin health");

    const upgrade = await api("/api/billing", "POST", { action: "upgrade", plan: "starter", provider: "stripe" }, token);
    if (upgrade.ok && (upgrade.json?.creditsAdded || upgrade.json?.pending)) pass("Billing upgrade flow");
    else fail("Billing upgrade flow", upgrade.json?.error);
  }

  const webhookBad = await api("/api/billing/webhook", "POST", { type: "test" });
  if (webhookBad.status === 400 || webhookBad.status === 500) pass("Webhook rejects unsigned payload");
  else fail("Webhook rejects unsigned payload", webhookBad.status);

  const gateway = await api("/api/gateway/health");
  if (gateway.ok) pass("Gateway health regression");
  else fail("Gateway health regression");

  console.log(`\n${failed ? "VERIFY FAIL" : "VERIFY PASS"}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
