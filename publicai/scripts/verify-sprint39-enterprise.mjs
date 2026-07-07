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
  console.log(`\n=== Sprint 39 Enterprise Verify — ${baseUrl} ===\n`);

  const login = await api("/api/user/login", "POST", { email: "admin@zwima-group.info", password: "admin123", remember: true });
  if (!login.ok || !login.json?.session?.access_token) {
    fail("Admin login", login.json?.error || `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("Admin login");
  const token = login.json.session.access_token;

  const wsPage = await api("/workspace.html");
  if (wsPage.ok && wsPage.text.includes("Enterprise Workspace") && wsPage.text.includes("Teams")) {
    pass("Workspace UI");
  } else fail("Workspace UI", `HTTP ${wsPage.status}`);

  const roles = await api("/api/roles", "GET", undefined, token);
  if (roles.ok && roles.json?.roles?.length >= 5) {
    pass("Roles", roles.json.roles.join(", "));
  } else fail("Roles", roles.json?.error || `HTTP ${roles.status}`);

  if (roles.ok && roles.json?.permissions?.some((p) => p.role === "developer")) {
    pass("Configurable permissions");
  } else fail("Configurable permissions");

  const createOrg = await api("/api/organizations", "POST", {
    action: "create",
    name: `ZWIMA Test Org ${Date.now()}`,
    vatNumber: "DE123456789",
    country: "DE",
    industry: "Technology",
  }, token);
  let orgId = createOrg.json?.organization?.id;
  if (createOrg.ok && orgId) {
    pass("Organizations", orgId);
  } else {
    const list = await api("/api/organizations", "GET", undefined, token);
    orgId = list.json?.organizations?.[0]?.id;
    if (orgId) pass("Organizations", `existing ${orgId}`);
    else fail("Organizations", createOrg.json?.error || `HTTP ${createOrg.status}`);
  }

  if (orgId) {
    const teams = await api(`/api/teams?organizationId=${orgId}`, "GET", undefined, token);
    if (teams.ok && (teams.json?.teams || []).length >= 5) {
      pass("Teams", `${teams.json.teams.length} teams`);
    } else fail("Teams", teams.json?.error || `HTTP ${teams.status}`);

    const members = await api(`/api/members?organizationId=${orgId}`, "GET", undefined, token);
    if (members.ok && Array.isArray(members.json?.members)) {
      pass("Members", `${members.json.members.length} members`);
    } else fail("Members", members.json?.error || `HTTP ${members.status}`);

    const invite = await api("/api/members", "POST", {
      action: "invite",
      organizationId: orgId,
      email: `dev${Date.now()}@zwima-group.info`,
      role: "developer",
    }, token);
    if (invite.ok) pass("Invite member");
    else fail("Invite member", invite.json?.error);

    const workspace = await api(`/api/workspace?organizationId=${orgId}`, "GET", undefined, token);
    if (workspace.ok && workspace.json?.workspace?.resources) {
      pass("Workspace", workspace.json.workspace.role);
    } else fail("Workspace", workspace.json?.error || `HTTP ${workspace.status}`);

    const entDash = await api(`/api/enterprise/dashboard?organizationId=${orgId}`, "GET", undefined, token);
    if (entDash.ok && entDash.json?.dashboard?.organizationUsage) {
      pass("Enterprise dashboard");
    } else fail("Enterprise dashboard", entDash.json?.error);
  }

  const adminEnt = await api("/api/admin/enterprise", "GET", undefined, token);
  if (adminEnt.ok && adminEnt.json?.organizations) {
    pass("Admin enterprise", `${adminEnt.json.organizations.length} orgs`);
  } else fail("Admin enterprise", adminEnt.json?.error);

  const commerce = await api("/api/admin/commerce", "GET", undefined, token);
  if (commerce.ok) pass("No commerce regression");
  else fail("No commerce regression");

  const gateway = await api("/api/gateway/models");
  if (gateway.ok) pass("No gateway regression");
  else fail("No gateway regression");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  if (!failed) console.log("SPRINT 39: PASS\n");
  else console.log("SPRINT 39: FAIL\n");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
