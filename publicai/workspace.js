let currentOrgId = null;

async function wsFetch(path, options = {}) {
  return window.ZwimaSupabaseApi.apiFetch(path, options);
}

function showMsg(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

async function loadOrganizations() {
  const data = await wsFetch("/api/organizations");
  const orgs = data.organizations || [];
  const select = document.getElementById("orgSelect");
  if (!select) return orgs;

  if (!orgs.length) {
    select.innerHTML = '<option value="">No organization</option>';
    currentOrgId = null;
    return orgs;
  }

  const saved = window.ZwimaStorage?.get("WORKSPACE_ORG_ID");
  currentOrgId = saved && orgs.find((o) => o.id === saved) ? saved : orgs[0].id;
  select.innerHTML = orgs.map((o) => `<option value="${o.id}"${o.id === currentOrgId ? " selected" : ""}>${o.name}</option>`).join("");
  return orgs;
}

async function loadOrgDetail() {
  if (!currentOrgId) return;
  const [detail, teams, members, workspace, enterprise] = await Promise.all([
    wsFetch(`/api/organizations?organizationId=${encodeURIComponent(currentOrgId)}`),
    wsFetch(`/api/teams?organizationId=${encodeURIComponent(currentOrgId)}`),
    wsFetch(`/api/members?organizationId=${encodeURIComponent(currentOrgId)}`),
    wsFetch(`/api/workspace?organizationId=${encodeURIComponent(currentOrgId)}`),
    wsFetch(`/api/enterprise/dashboard?organizationId=${encodeURIComponent(currentOrgId)}`),
  ]);

  const org = detail.organization || {};
  set("wsOrgName", org.name);
  set("wsVat", org.vatNumber || "—");
  set("wsCountry", org.country);
  set("wsIndustry", org.industry || "—");
  set("wsPlan", String(org.subscriptionPlan || "free").toUpperCase());
  set("wsCredits", Number(org.credits || 0).toLocaleString());
  set("wsMembers", org.memberCount);

  const ws = workspace.workspace || {};
  set("wsRole", String(ws.role || "—").toUpperCase());
  set("wsApiKeys", ws.resources?.apiKeys?.count ?? 0);
  set("wsUsage", ws.resources?.usage?.totalRequests ?? 0);
  set("wsPrompts", (ws.resources?.sharedPrompts || []).length);
  set("wsAudit", (ws.resources?.logs?.entries || []).length);

  const ent = enterprise.dashboard || {};
  set("entRequests", Number(ent.organizationUsage?.totalRequests || 0).toLocaleString());
  set("entCredits", Number(ent.organizationUsage?.totalCredits || 0).toLocaleString());
  set("entRevenue", `€${Number(ent.revenueByOrganization || 0).toFixed(2)}`);
  set("entTeams", ent.teamCount);

  const teamsBody = document.getElementById("teamsBody");
  if (teamsBody) {
    const rows = teams.teams || [];
    teamsBody.innerHTML = rows.length
      ? rows.map((t) => `<tr><td>${t.name}</td><td>${t.memberCount}</td><td>${Number(t.creditsAllocated).toLocaleString()}</td><td>${t.status}</td></tr>`).join("")
      : '<tr><td colspan="4" class="muted">No teams yet.</td></tr>';
  }

  const q = String(document.getElementById("memberSearch")?.value || "").trim().toLowerCase();
  const memberRows = (members.members || []).filter((m) => !q || String(m.email || "").toLowerCase().includes(q) || String(m.role).includes(q));
  const membersBody = document.getElementById("membersBody");
  if (membersBody) {
    membersBody.innerHTML = memberRows.length
      ? memberRows
          .map(
            (m) => `<tr data-user-id="${m.userId || ""}">
          <td>${m.email || m.userId || "—"}</td>
          <td>${m.role}</td>
          <td>${m.status}</td>
          <td>${m.isOwner ? "—" : `<button class="button button-secondary button-sm" data-action="suspend">Suspend</button> <button class="button button-secondary button-sm" data-action="remove">Remove</button>`}</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="muted">No members yet.</td></tr>';
  }

  const auditBody = document.getElementById("auditBody");
  const auditEntries = ws.resources?.logs?.entries || [];
  const activity = members.activity || [];
  const combined = [
    ...auditEntries.map((a) => ({ time: a.createdAt, action: a.action, detail: a.detail })),
    ...activity.map((a) => ({ time: a.created_at, action: a.action, detail: a.detail })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20);

  if (auditBody) {
    auditBody.innerHTML = combined.length
      ? combined.map((a) => `<tr><td class="muted">${new Date(a.time).toLocaleString("en-GB")}</td><td>${a.action}</td><td>${a.detail || "—"}</td></tr>`).join("")
      : '<tr><td colspan="3" class="muted">No audit entries.</td></tr>';
  }
}

async function createOrganization() {
  const name = window.prompt("Company name:");
  if (!name) return;
  showMsg("wsError", "");
  try {
    const result = await wsFetch("/api/organizations", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        name,
        vatNumber: window.prompt("VAT number (optional):") || "",
        country: "DE",
        industry: window.prompt("Industry (optional):") || "",
      }),
    });
    currentOrgId = result.organization?.id;
    if (currentOrgId) window.ZwimaStorage?.set("WORKSPACE_ORG_ID", currentOrgId);
    showMsg("wsSuccess", `Organization ${name} created.`);
    await loadOrganizations();
    await loadOrgDetail();
  } catch (err) {
    showMsg("wsError", err.message || "Failed to create organization.");
  }
}

async function inviteMember() {
  const email = document.getElementById("inviteEmail")?.value?.trim();
  const role = document.getElementById("inviteRole")?.value || "developer";
  if (!email || !currentOrgId) return;
  showMsg("wsError", "");
  try {
    await wsFetch("/api/members", {
      method: "POST",
      body: JSON.stringify({ action: "invite", organizationId: currentOrgId, email, role }),
    });
    showMsg("wsSuccess", `Invitation sent to ${email}.`);
    await loadOrgDetail();
  } catch (err) {
    showMsg("wsError", err.message || "Invite failed.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadOrganizations();
  if (currentOrgId) await loadOrgDetail();

  document.getElementById("orgSelect")?.addEventListener("change", async (e) => {
    currentOrgId = e.target.value;
    window.ZwimaStorage?.set("WORKSPACE_ORG_ID", currentOrgId);
    await loadOrgDetail();
  });
  document.getElementById("createOrgBtn")?.addEventListener("click", createOrganization);
  document.getElementById("inviteMemberBtn")?.addEventListener("click", inviteMember);
  document.getElementById("memberSearch")?.addEventListener("input", loadOrgDetail);

  document.getElementById("membersBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    const row = e.target.closest("tr[data-user-id]");
    if (!btn || !row || !currentOrgId) return;
    const userId = row.dataset.userId;
    if (!userId) return;
    const action = btn.dataset.action;
    try {
      await wsFetch("/api/members", {
        method: "POST",
        body: JSON.stringify({ action, organizationId: currentOrgId, userId }),
      });
      showMsg("wsSuccess", `Member ${action} completed.`);
      await loadOrgDetail();
    } catch (err) {
      showMsg("wsError", err.message);
    }
  });
});
