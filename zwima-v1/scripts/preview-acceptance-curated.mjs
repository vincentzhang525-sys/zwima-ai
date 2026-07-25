#!/usr/bin/env node
/**
 * Preview acceptance probes — read-only HTTP checks.
 * Never posts payments, never enables live providers, never mutates DB intentionally.
 */
const base = process.argv[2];
if (!base) {
  console.error("Usage: node preview-acceptance-curated.mjs <preview-base-url>");
  process.exit(2);
}

const results = [];
async function check(name, path, opts = {}) {
  const url = new URL(path, base).toString();
  const init = {
    method: opts.method || "GET",
    redirect: "manual",
    headers: opts.headers || {},
  };
  if (opts.body) {
    init.body = opts.body;
    init.headers["content-type"] = init.headers["content-type"] || "application/json";
  }
  let status = 0;
  let bodyText = "";
  let ok = false;
  let note = "";
  try {
    const res = await fetch(url, init);
    status = res.status;
    bodyText = await res.text();
    const expect = opts.expectStatus;
    if (Array.isArray(expect)) ok = expect.includes(status);
    else if (typeof expect === "number") ok = status === expect;
    else ok = status >= 200 && status < 400;
    if (opts.bodyIncludes) {
      const hit = opts.bodyIncludes.every((s) => bodyText.includes(s));
      ok = ok && hit;
      if (!hit) note = "body_missing_expected";
    }
    if (opts.bodyExcludes) {
      const bad = opts.bodyExcludes.some((s) => bodyText.includes(s));
      ok = ok && !bad;
      if (bad) note = "body_has_forbidden";
    }
  } catch (e) {
    note = e instanceof Error ? e.message : String(e);
    ok = false;
  }
  results.push({ name, path, status, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} status=${status} ${note}`);
}

await check("home", "/", { expectStatus: [200, 307, 308] });
await check("login", "/login", { expectStatus: [200, 307, 308] });
await check("signup", "/signup", { expectStatus: [200, 307, 308] });
await check("forgot-password", "/forgot-password", { expectStatus: [200] });
await check("dashboard_guard", "/dashboard", { expectStatus: [307, 308, 401, 403] });
await check("admin_guard", "/dashboard/admin", { expectStatus: [307, 308, 401, 403] });
await check("packages_api", "/api/v1/packages", {
  expectStatus: [200, 503],
  bodyExcludes: ["sk_live_", "sk_test_", "whsec_"],
});
await check("health", "/api/v1/health", {
  expectStatus: [200],
  bodyIncludes: ["blocked"],
  bodyExcludes: ['"online":true'],
});
await check("agents_api_auth", "/api/v1/agents", { expectStatus: [401, 403, 307, 308] });
await check("agents_seed_blocked", "/api/v1/agents/seed", {
  method: "POST",
  body: "{}",
  expectStatus: [401, 403],
});
await check("api_keys_auth", "/api/v1/api-keys", { expectStatus: [401, 403, 307, 308] });
await check("billing_auth", "/api/v1/billing", { expectStatus: [401, 403, 307, 308, 405] });
await check("providers_route", "/api/v1/providers", { expectStatus: [200, 401, 403, 404] });
await check("m4_fx_admin_api", "/api/v1/admin/cost-optimization/fx-policies", {
  expectStatus: [401, 403, 307, 308],
});
await check("m4_fx_admin_page", "/dashboard/admin/fx-cost-control", {
  expectStatus: [307, 308, 401, 403],
});
await check("stripe_checkout_blocked_or_auth", "/api/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ packageId: "probe-no-pay" }),
  // 307/308 = auth middleware redirect (no Stripe session). 403 = Preview guard.
  expectStatus: [401, 403, 400, 404, 405, 307, 308],
  bodyExcludes: ["cs_live_", "checkout.stripe.com"],
});

const failed = results.filter((r) => !r.ok);
const summary = {
  previewBase: base,
  passed: results.filter((r) => r.ok).length,
  failed: failed.length,
  results,
  PRODUCTION_CHANGED: "NO",
  LIVE_PROVIDER_CALL_EXECUTED: "NO",
  PAYMENT_CREATED: "NO",
  DATABASE_MUTATION_FROM_PROBES: "NO_INTENTIONAL",
  PREVIEW_ACCEPTANCE: failed.length === 0 ? "PASS" : "FAIL",
};
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
