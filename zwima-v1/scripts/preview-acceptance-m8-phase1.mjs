#!/usr/bin/env node
/**
 * M8 Agent Platform Phase 1 — Preview acceptance probes (read-only HTTP checks).
 * Never enables live providers, never sends real email, never creates a
 * Stripe checkout session, never mutates the database intentionally.
 */
const base = process.argv[2];
if (!base) {
  console.error("Usage: node preview-acceptance-m8-phase1.mjs <preview-base-url>");
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

// --- Dashboard guards (auth middleware should redirect/deny, never render freely) ---
await check("agents_dashboard_guard", "/dashboard/agents", { expectStatus: [307, 308, 401, 403] });
await check("agents_new_dashboard_guard", "/dashboard/agents/new", { expectStatus: [307, 308, 401, 403] });
await check("agent_runs_dashboard_guard", "/dashboard/agents/nonexistent/runs", {
  expectStatus: [307, 308, 401, 403, 404],
});
await check("agent_run_detail_dashboard_guard", "/dashboard/agent-runs/nonexistent", {
  expectStatus: [307, 308, 401, 403, 404],
});

// --- API auth guards ---
await check("agents_api_auth", "/api/v1/agents", { expectStatus: [401, 403, 307, 308] });
await check("agents_api_create_auth", "/api/v1/agents", {
  method: "POST",
  body: JSON.stringify({ name: "probe", systemPrompt: "probe" }),
  expectStatus: [401, 403, 307, 308],
  bodyExcludes: ["sk_live_", "sk_test_", "whsec_"],
});
await check("agent_by_id_api_auth", "/api/v1/agents/agt_nonexistent", { expectStatus: [401, 403, 307, 308] });
await check("agent_runs_list_api_auth", "/api/v1/agents/agt_nonexistent/runs", {
  expectStatus: [401, 403, 307, 308],
});
await check("agent_runs_api_auth", "/api/v1/agent-runs", { expectStatus: [401, 403, 307, 308] });
await check("agent_run_by_id_api_auth", "/api/v1/agent-runs/nonexistent", {
  expectStatus: [401, 403, 404, 307, 308],
});
await check("agent_run_cancel_api_auth", "/api/v1/agent-runs/nonexistent/cancel", {
  method: "POST",
  body: "{}",
  expectStatus: [401, 403, 404, 307, 308],
});
await check("agents_seed_blocked", "/api/v1/agents/seed", {
  method: "POST",
  body: "{}",
  expectStatus: [401, 403],
});

// --- Fail-closed provider/health checks (shared with other M-phase acceptance scripts) ---
await check("providers_route_fail_closed", "/api/v1/providers", {
  expectStatus: [200],
  bodyIncludes: ["providers", "PROVIDER_LIVE_CALLS_DISABLED"],
  bodyExcludes: ['"online":true'],
});
await check("health_fail_closed", "/api/v1/health", {
  expectStatus: [200],
  bodyIncludes: ["blocked"],
  bodyExcludes: ['"online":true'],
});

// --- No Stripe/payment surface reachable from agent endpoints ---
await check("no_stripe_checkout_from_agents", "/api/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ packageId: "probe-no-pay" }),
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
  DATABASE_MIGRATION_EXECUTED: "NO",
  DATABASE_MUTATION_FROM_PROBES: "NO_INTENTIONAL",
  M8_PHASE1_ACCEPTANCE: failed.length === 0 ? "PASS" : "FAIL",
};
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
