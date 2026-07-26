#!/usr/bin/env node
/**
 * Preview public-surface acceptance — read-only HTTP probes.
 * No payments, no Live Provider calls, no DB mutations, no secret printing.
 */
const base = process.argv[2];
if (!base) {
  console.error("Usage: node preview-acceptance-public-surface.mjs <preview-base-url>");
  process.exit(2);
}

const DEV_WARNING = "LEGAL REVIEW REQUIRED BEFORE PRODUCTION";
const results = [];

async function check(name, pathName, opts = {}) {
  const url = new URL(pathName, base).toString();
  const init = {
    method: opts.method || "GET",
    redirect: "manual",
    headers: opts.headers || {},
  };
  if (opts.body) {
    init.body = opts.body;
    init.headers["content-type"] = "application/json";
  }
  let status = 0;
  let body = "";
  let ok = false;
  let note = "";
  try {
    const res = await fetch(url, init);
    status = res.status;
    body = await res.text();
    const expect = opts.expectStatus;
    if (Array.isArray(expect)) ok = expect.includes(status);
    else if (typeof expect === "number") ok = status === expect;
    else ok = status >= 200 && status < 400;
    if (opts.bodyIncludes) {
      const hit = opts.bodyIncludes.every((s) => body.includes(s));
      ok = ok && hit;
      if (!hit) note = "body_missing";
    }
    if (opts.bodyExcludes) {
      const bad = opts.bodyExcludes.some((s) => body.includes(s));
      ok = ok && !bad;
      if (bad) note = "dev_warning_or_forbidden";
    }
    if (opts.hrefIncludes) {
      const hit = opts.hrefIncludes.every((h) => body.includes(`href="${h}"`) || body.includes(`href='${h}'`));
      ok = ok && hit;
      if (!hit) note = note || "footer_href_missing";
    }
  } catch (e) {
    note = e instanceof Error ? e.message : String(e);
    ok = false;
  }
  results.push({ name, path: pathName, status, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} status=${status} ${note}`);
}

const publicPages = [
  ["HOME", "/"],
  ["LOGIN", "/login"],
  ["SIGNUP", "/signup"],
  ["FORGOT_PASSWORD", "/forgot-password"],
  ["IMPRINT", "/imprint"],
  ["PRIVACY", "/privacy"],
  ["TERMS", "/terms"],
  ["COOKIES", "/cookies"],
  ["DPA", "/legal/dpa"],
  ["SUBPROCESSORS", "/legal/sub-processors"],
];

for (const [name, p] of publicPages) {
  await check(name, p, {
    expectStatus: 200,
    bodyExcludes: [DEV_WARNING],
  });
}

await check("FOOTER_LINKS", "/", {
  expectStatus: 200,
  hrefIncludes: [
    "/privacy",
    "/terms",
    "/imprint",
    "/cookies",
    "/legal/dpa",
    "/legal/sub-processors",
  ],
  bodyExcludes: [DEV_WARNING],
});

await check("AUTH_GUARD_DASHBOARD", "/dashboard", { expectStatus: [307, 308, 401, 403] });
await check("AUTH_GUARD_ADMIN", "/dashboard/admin", { expectStatus: [307, 308, 401, 403] });

await check("HEALTH_READ_ONLY", "/api/v1/health", {
  expectStatus: 200,
  bodyExcludes: ["prisma migrate", "seeded"],
});

await check("PROVIDERS_API", "/api/v1/providers", {
  expectStatus: 200,
  bodyIncludes: ["providers", "PROVIDER_LIVE_CALLS_DISABLED"],
  bodyExcludes: ['"online":true'],
});

await check("STRIPE_CHECKOUT_BLOCKED", "/api/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ packageId: "probe-no-pay" }),
  expectStatus: [401, 403, 400, 404, 405, 307, 308],
  bodyExcludes: ["cs_live_", "checkout.stripe.com"],
});

const map = Object.fromEntries(results.map((r) => [r.name, r]));
const failed = results.filter((r) => !r.ok);
const summary = {
  previewBase: base,
  HOME: map.HOME?.ok ? "PASS" : "FAIL",
  LOGIN: map.LOGIN?.ok ? "PASS" : "FAIL",
  SIGNUP: map.SIGNUP?.ok ? "PASS" : "FAIL",
  FORGOT_PASSWORD: map.FORGOT_PASSWORD?.ok ? "PASS" : "FAIL",
  IMPRINT: map.IMPRINT?.ok ? "PASS" : "FAIL",
  PRIVACY: map.PRIVACY?.ok ? "PASS" : "FAIL",
  TERMS: map.TERMS?.ok ? "PASS" : "FAIL",
  COOKIES: map.COOKIES?.ok ? "PASS" : "FAIL",
  DPA: map.DPA?.ok ? "PASS" : "FAIL",
  SUBPROCESSORS: map.SUBPROCESSORS?.ok ? "PASS" : "FAIL",
  FOOTER_LINKS: map.FOOTER_LINKS?.ok ? "PASS" : "FAIL",
  DEV_WARNINGS_REMOVED: results
    .filter((r) => publicPages.some(([n]) => n === r.name) || r.name === "FOOTER_LINKS")
    .every((r) => r.ok && r.note !== "dev_warning_or_forbidden")
    ? "PASS"
    : "FAIL",
  AUTH_GUARDS: map.AUTH_GUARD_DASHBOARD?.ok && map.AUTH_GUARD_ADMIN?.ok ? "PASS" : "FAIL",
  HEALTH_READ_ONLY: map.HEALTH_READ_ONLY?.ok ? "PASS" : "FAIL",
  PROVIDERS_API: map.PROVIDERS_API?.ok ? "PASS" : "FAIL",
  LIVE_PROVIDER_CALL_EXECUTED: "NO",
  STRIPE_CHECKOUT_EXECUTED: "NO",
  DATABASE_CHANGED: "NO",
  PRODUCTION_CHANGED: "NO",
  PREVIEW_ACCEPTANCE: failed.length === 0 ? "PASS" : "FAIL",
  passed: results.filter((r) => r.ok).length,
  failed: failed.length,
  results,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
