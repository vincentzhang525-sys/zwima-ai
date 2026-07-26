#!/usr/bin/env node
/**
 * M8 Agent Platform Phase 2A — Preview acceptance probes (read-only HTTP checks).
 * Never enables live providers, never sends real email, never creates a
 * Stripe checkout session, never runs a database migration/seed/push.
 */
const base = process.argv[2];
if (!base) {
  console.error("Usage: node preview-acceptance-m8-phase2a.mjs <preview-base-url>");
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

// --- Dashboard guards ---
await check("templates_dashboard_guard", "/dashboard/agents/templates", { expectStatus: [307, 308, 401, 403] });
await check("template_detail_dashboard_guard", "/dashboard/agents/templates/tpl_nonexistent", {
  expectStatus: [307, 308, 401, 403, 404],
});
await check("agent_detail_dashboard_guard", "/dashboard/agents/agt_nonexistent", {
  expectStatus: [307, 308, 401, 403, 404],
});

// --- Template API auth guards ---
await check("agent_templates_api_auth", "/api/v1/agent-templates", { expectStatus: [401, 403, 307, 308] });
await check("agent_templates_create_auth", "/api/v1/agent-templates", {
  method: "POST",
  body: JSON.stringify({ name: "probe", slug: "probe", category: "custom", systemPrompt: "probe" }),
  expectStatus: [401, 403, 307, 308],
});
await check("agent_template_by_id_api_auth", "/api/v1/agent-templates/tpl_nonexistent", {
  expectStatus: [401, 403, 307, 308],
});
await check("agent_from_template_api_auth", "/api/v1/agents/from-template", {
  method: "POST",
  body: JSON.stringify({ templateId: "tpl_system_api_integration_assistant" }),
  expectStatus: [401, 403, 307, 308],
});

// --- Memory API auth guards ---
await check("agent_memory_list_api_auth", "/api/v1/agents/agt_nonexistent/memory", {
  expectStatus: [401, 403, 307, 308],
});
await check("agent_memory_create_api_auth", "/api/v1/agents/agt_nonexistent/memory", {
  method: "POST",
  body: JSON.stringify({ memoryType: "USER", key: "probe", value: "probe" }),
  expectStatus: [401, 403, 307, 308],
  bodyExcludes: ["sk_live_", "sk_test_", "whsec_"],
});
await check("agent_memory_clear_api_auth", "/api/v1/agents/agt_nonexistent/memory", {
  method: "DELETE",
  expectStatus: [401, 403, 307, 308],
});
await check("agent_memory_delete_api_auth", "/api/v1/agents/agt_nonexistent/memory/mem_nonexistent", {
  method: "DELETE",
  expectStatus: [401, 403, 307, 308],
});
await check("agent_memory_policy_api_auth", "/api/v1/agents/agt_nonexistent/memory/policy", {
  expectStatus: [401, 403, 307, 308],
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

// --- No Stripe/payment surface reachable from the new agent-template/memory endpoints ---
await check("no_stripe_checkout_from_agent_templates", "/api/billing/checkout", {
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
  EMAIL_SENT: "NO",
  DATABASE_MIGRATION_EXECUTED: "NO",
  DATABASE_MUTATION_FROM_PROBES: "NO_INTENTIONAL",
  M8_PHASE2A_ACCEPTANCE: failed.length === 0 ? "PASS" : "FAIL",
};
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
