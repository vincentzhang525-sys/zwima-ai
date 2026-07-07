#!/usr/bin/env node
/**
 * Sprint 45 — Customer Success Center verification.
 * Usage: node scripts/verify-sprint45-success.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] || "https://zwima-group.info").replace(/\/$/, "");
const checks = [];
let token = null;
let adminToken = null;
let ticketId = null;
let featureId = null;
let incidentId = null;

function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(path, method = "GET", body, t) {
  const headers = { "Content-Type": "application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;
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

async function setup() {
  const ts = Date.now();
  const email = `s45-${ts}@zwima-group.info`;
  const reg = await api("/api/user/register", "POST", {
    email,
    password: `S45Test${String(ts).slice(-6)}!`,
    company: `Sprint45 ${ts}`,
    country: "Germany",
  });
  if (reg.json?.session?.access_token) {
    token = reg.json.session.access_token;
    return;
  }
  const login = await api("/api/user/login", "POST", { email, password: `S45Test${String(ts).slice(-6)}!` });
  token = login.json?.session?.access_token;
}

async function run() {
  console.log(`\n=== Sprint 45 Customer Success Center — ${baseUrl} ===\n`);

  await setup();
  if (!token) {
    fail("Customer auth setup");
    return printReport();
  }
  pass("Customer auth setup");

  const adminLogin = await api("/api/user/login", "POST", {
    email: "admin@zwima-group.info",
    password: "admin123",
    remember: true,
  });
  adminToken = adminLogin.json?.session?.access_token;
  adminToken ? pass("Admin auth") : fail("Admin auth", adminLogin.json?.error);

  const ticket = await api(
    "/api/support",
    "POST",
    { action: "create_ticket", category: "API", priority: "medium", title: "S45 test ticket", description: "Automated verification" },
    token
  );
  if (ticket.ok && ticket.json?.ticket?.ticketNumber?.startsWith("ZW-")) {
    ticketId = ticket.json.ticket.id;
    pass("Support ticket", ticket.json.ticket.ticketNumber);
  } else fail("Support ticket", ticket.json?.error);

  const bug = await api(
    "/api/support",
    "POST",
    {
      action: "create_bug",
      title: "S45 bug",
      description: "Test bug",
      stepsToReproduce: "1. Run verify",
      browser: "Chrome",
      operatingSystem: "Windows",
      severity: "low",
    },
    token
  );
  bug.ok ? pass("Bug report") : fail("Bug report", bug.json?.error);

  const feature = await api(
    "/api/support",
    "POST",
    { action: "create_feature", title: "Support Claude", description: "Sprint 45 verify" },
    token
  );
  if (feature.ok && feature.json?.feature?.id) {
    featureId = feature.json.feature.id;
    pass("Feature request", feature.json.feature.title);
  } else fail("Feature request", feature.json?.error);

  if (featureId) {
    const vote = await api("/api/support", "POST", { action: "vote_feature", featureId }, token);
    vote.ok && vote.json?.voted ? pass("Feature voting") : fail("Feature voting", vote.json?.error);
  }

  const board = await api("/api/support/board");
  board.ok && (board.json?.topRequested || []).length >= 0 ? pass("Feature board", `${(board.json.topRequested || []).length} items`) : fail("Feature board");

  const kb = await api("/api/knowledge");
  kb.ok && (kb.json?.articles || []).length >= 5 ? pass("Knowledge base", `${kb.json.articles.length} articles`) : fail("Knowledge base", kb.json?.error);

  const changelog = await api("/api/changelog");
  changelog.ok && (changelog.json?.entries || []).length >= 1 ? pass("Changelog API", `${changelog.json.entries.length} entries`) : fail("Changelog API");

  const status = await api("/api/status/public");
  const hasProviders = (status.json?.providers || []).length >= 7;
  const hasComponents = (status.json?.components || []).length >= 5;
  hasProviders && hasComponents ? pass("System status", `${status.json.components.length} components`) : fail("System status");

  const incidents = await api("/api/incidents");
  incidents.ok ? pass("Incidents API") : fail("Incidents API", incidents.json?.error);

  if (adminToken) {
    const pub = await api(
      "/api/admin/success",
      "POST",
      {
        action: "publish_incident",
        title: "S45 verify incident",
        description: "Automated test",
        component: "gateway",
        impact: "maintenance",
        published: true,
      },
      adminToken
    );
    if (pub.ok && pub.json?.incident?.id) {
      incidentId = pub.json.incident.id;
      pass("Admin publish incident", pub.json.incident.title);
    } else fail("Admin publish incident", pub.json?.error);

    if (ticketId) {
      const upd = await api("/api/admin/success", "POST", { action: "update_ticket", ticketId, status: "assigned" }, adminToken);
      upd.ok ? pass("Admin ticket assign") : fail("Admin ticket assign", upd.json?.error);
    }

    if (featureId) {
      const feat = await api("/api/admin/success", "POST", { action: "update_feature", featureId, roadmapStatus: "planned" }, adminToken);
      feat.ok ? pass("Admin feature roadmap") : fail("Admin feature roadmap", feat.json?.error);
    }

    const analytics = await api("/api/admin/success", "GET", undefined, adminToken);
    analytics.ok && analytics.json?.analytics ? pass("Admin success analytics", `queue=${analytics.json.analytics.openTickets}`) : fail("Admin success analytics");
  }

  const overview = await api("/api/success/overview", "GET", undefined, token);
  overview.ok ? pass("Customer success overview") : fail("Customer success overview", overview.json?.error);

  const pages = [
    ["/support.html", "Support page"],
    ["/help.html", "Help Center"],
    ["/incidents.html", "Incidents page"],
    ["/changelog.html", "Changelog page"],
    ["/status.html", "Status page"],
    ["/dashboard.html", "Dashboard"],
  ];
  for (const [path, label] of pages) {
    const p = await api(path);
    p.ok ? pass(label) : fail(label, `HTTP ${p.status}`);
  }

  const gateway = await api("/api/gateway/health");
  gateway.ok ? pass("Regression gateway") : fail("Regression gateway");

  const billing = await api("/api/billing", "GET", undefined, token);
  billing.ok ? pass("Regression billing") : fail("Regression billing");

  const credits = await api("/api/credits", "GET", undefined, token);
  credits.ok ? pass("Regression credits") : fail("Regression credits");

  const email = await api("/api/email/status");
  email.ok ? pass("Regression email") : fail("Regression email");

  const workspace = await api("/api/workspace", "GET", undefined, token);
  workspace.ok || workspace.status === 404 ? pass("Regression enterprise workspace") : fail("Regression enterprise");

  if (adminToken && incidentId) {
    await api("/api/admin/success", "POST", { action: "resolve_incident", incidentId }, adminToken);
  }

  printReport();
}

function printReport() {
  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const allOk = passed === total;
  console.log("\n========================================");
  console.log(`${passed}/${total} — SPRINT 45: ${allOk ? "PASS" : "FAIL"}`);
  console.log("========================================\n");
  process.exit(allOk ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
