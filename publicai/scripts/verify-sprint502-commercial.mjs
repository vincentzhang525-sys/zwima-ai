#!/usr/bin/env node
/**
 * Sprint 50.2 — production commercial launch verification
 */
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
  console.log(`\n=== Sprint 50.2 Verify — ${baseUrl} ===\n`);
  let failed = 0;
  const pass = (n, d = "") => console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  const fail = (n, d = "") => {
    failed += 1;
    console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
  };

  const topup = await api("/api/credits", "POST", { action: "topup", amountEur: 10 });
  if (topup.status === 401 || topup.status === 403) pass("Free topup blocked for unauthenticated");
  else fail("Free topup blocked", topup.status);

  const webhookBad = await api("/api/billing/webhook", "POST", { type: "test" });
  if (webhookBad.status === 400 || webhookBad.status === 500) pass("Webhook rejects unsigned payload");
  else fail("Webhook rejects unsigned payload", webhookBad.status);

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  const token = login.json?.session?.access_token;
  if (login.ok && token) pass("Admin login");
  else fail("Admin login", login.json?.error);

  if (token) {
    const topupAuthed = await api("/api/credits", "POST", { action: "topup", amountEur: 10 }, token);
    if (topupAuthed.status === 403) pass("Authenticated free topup blocked");
    else fail("Authenticated free topup blocked", topupAuthed.status);

    const health = await api("/api/admin/commercial-health", "GET", undefined, token);
    if (health.ok && health.json?.runtime) pass("Commercial health API");
    else fail("Commercial health API", health.json?.error);

    if (!health.json?.stripe?.secretKey) pass("Stripe secrets not exposed");
    else fail("Stripe secrets not exposed", "secretKey present");

    const upgrade = await api("/api/billing", "POST", { action: "purchase_package", packageId: 1, provider: "stripe" }, token);
    if (upgrade.ok && (upgrade.json?.checkoutUrl || upgrade.json?.pending)) {
      pass("Billing returns checkout or fail-closed", upgrade.json?.checkoutUrl ? "checkoutUrl" : "pending");
    } else if (String(upgrade.json?.error || "").includes("Stripe") || upgrade.status === 503) {
      pass("Billing returns checkout or fail-closed", "Stripe env pending");
    } else fail("Billing checkout flow", upgrade.json?.error || upgrade.status);
  }

  const gateway = await api("/api/gateway/health");
  if (gateway.ok) pass("Gateway health");
  else fail("Gateway health");

  console.log(`\n${failed ? "VERIFY FAIL" : "VERIFY PASS"}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
