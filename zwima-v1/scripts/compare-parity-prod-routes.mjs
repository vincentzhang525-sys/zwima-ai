#!/usr/bin/env node
/** Read-only Preview vs Production route comparison. No secrets printed. */
const preview = process.argv[2];
const prod = process.argv[3] || "https://zwima-group.info";
if (!preview) {
  console.error("Usage: node compare-preview-prod-routes.mjs <preview> [prod]");
  process.exit(2);
}

const paths = [
  ["GET", "/"],
  ["GET", "/login"],
  ["GET", "/signup"],
  ["GET", "/forgot-password"],
  ["GET", "/dashboard"],
  ["GET", "/dashboard/admin"],
  ["GET", "/dashboard/admin/fx-cost-control"],
  ["GET", "/api/v1/packages"],
  ["GET", "/api/v1/health"],
  ["GET", "/api/v1/providers"],
  ["GET", "/api/v1/models"],
  ["GET", "/api/v1/agents"],
  ["GET", "/api/v1/api-keys"],
  ["GET", "/api/v1/billing"],
  ["GET", "/api/v1/chat"],
  ["GET", "/api/admin/providers"],
  ["GET", "/api/v1/admin/cost-optimization/fx-policies"],
  ["POST", "/api/billing/checkout"],
];

async function probe(base, method, path) {
  try {
    const init = { method, redirect: "manual" };
    if (method === "POST") {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify({ packageId: "probe-no-pay" });
    }
    const res = await fetch(new URL(path, base), init);
    const text = await res.text();
    return {
      status: res.status,
      onlineTrue: /"online"\s*:\s*true/.test(text),
      blocked: text.includes("blocked") || text.includes("PROVIDER_LIVE_CALLS_DISABLED"),
      hasProvidersArray: text.includes('"providers"'),
      hasStripeSession: text.includes("cs_live_") || text.includes("checkout.stripe.com"),
    };
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const rows = [];
for (const [method, path] of paths) {
  const a = await probe(preview, method, path);
  const b = await probe(prod, method, path);
  rows.push({
    method,
    path,
    preview: a,
    production: b,
    statusParity: a.status === b.status,
  });
}
console.log(JSON.stringify({ preview, prod, rows }, null, 2));
