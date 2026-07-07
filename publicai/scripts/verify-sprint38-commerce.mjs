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
  console.log(`\n=== Sprint 38 Commerce Verify — ${baseUrl} ===\n`);

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Admin login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Admin login");
  const token = login.json.session.access_token;

  const billingPage = await api("/billing.html");
  if (billingPage.ok && billingPage.text.includes("Credit Packages") && billingPage.text.includes("Referral Program")) {
    pass("Billing center UI");
  } else fail("Billing center UI", `HTTP ${billingPage.status}`);

  const billing = await api("/api/billing", "GET", undefined, token);
  if (billing.ok && billing.json?.billing?.plans?.length >= 5 && billing.json?.billing?.creditPackages?.length >= 4) {
    pass("Subscription plans", `${billing.json.billing.plans.length} plans`);
    pass("Credit packages", `${billing.json.billing.creditPackages.length} packages`);
  } else {
    fail("Subscription plans", billing.json?.error || `HTTP ${billing.status}`);
    fail("Credit packages", billing.json?.error || "Missing packages");
  }

  if (billing.ok && billing.json?.billing?.referral?.code) {
    pass("Referral system", `code ${billing.json.billing.referral.code}`);
  } else fail("Referral system", "No referral code");

  const coupon = await api("/api/billing", "POST", { action: "apply_coupon", code: "WELCOME10" }, token);
  if (coupon.ok && coupon.json?.coupon?.code === "WELCOME10") pass("Coupon system");
  else fail("Coupon system", coupon.json?.error || `HTTP ${coupon.status}`);

  const upgrade = await api("/api/billing", "POST", { action: "upgrade", plan: "starter", provider: "stripe" }, token);
  if (upgrade.ok && upgrade.json?.creditsAdded) {
    pass("Subscription upgrade", `+${upgrade.json.creditsAdded} credits`);
  } else fail("Subscription upgrade", upgrade.json?.error || `HTTP ${upgrade.status}`);

  const billing2 = await api("/api/billing", "GET", undefined, token);
  const hasOrders = (billing2.json?.billing?.orders || []).length > 0;
  const hasInvoices = (billing2.json?.billing?.invoices || []).length > 0;
  const hasTransactions = (billing2.json?.billing?.transactions || []).length > 0;
  if (hasOrders) pass("Orders");
  else fail("Orders", "No orders after upgrade");
  if (hasInvoices) pass("Invoices");
  else fail("Invoices", "No invoices after upgrade");
  if (hasTransactions) pass("Transactions");
  else fail("Transactions", "No transactions after upgrade");

  const commerce = await api("/api/admin/commerce", "GET", undefined, token);
  if (commerce.ok && commerce.json?.plans?.length >= 5) {
    pass("Admin commerce plans", `${commerce.json.plans.length} plans`);
  } else fail("Admin commerce plans", commerce.json?.error || `HTTP ${commerce.status}`);

  if (commerce.ok && commerce.json?.creditPackages?.length >= 4) {
    pass("Admin credit packages");
  } else fail("Admin credit packages");

  if (commerce.ok && commerce.json?.coupons?.length >= 1) {
    pass("Admin coupons");
  } else fail("Admin coupons");

  if (commerce.ok && commerce.json?.revenue?.totalRevenue != null) {
    pass("Admin revenue", `€${commerce.json.revenue.totalRevenue}`);
  } else fail("Admin revenue");

  if (commerce.ok && Array.isArray(commerce.json?.paymentProviders) && commerce.json.paymentProviders.length >= 4) {
    pass("Payment providers", commerce.json.paymentProviders.map((p) => p.id).join(", "));
  } else fail("Payment providers");

  const adminHtml = await api("/admin.html");
  if (adminHtml.ok && adminHtml.text.includes("Commerce Center")) pass("Admin commerce UI");
  else fail("Admin commerce UI");

  const gateway = await api("/api/gateway/providers");
  if (gateway.ok) pass("No gateway regression");
  else fail("No gateway regression", `HTTP ${gateway.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  if (!failed) console.log("SPRINT 38: PASS\n");
  else console.log("SPRINT 38: FAIL\n");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
