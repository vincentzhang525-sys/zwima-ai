const admin = () => window.ZwimaAdminService;
const esc = (v) => window.ZwimaFormat.escapeHtml(String(v ?? ""));
const pill = (s) => {
  const map = { healthy: "active", green: "active", active: "active", disabled: "failed", not_configured: "planned", degraded: "failed", red: "failed", yellow: "planned" };
  return map[String(s || "").toLowerCase()] || "planned";
};
const state = { usersPage: 1, usersPageSize: 20 };

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderExecutive(ex) {
  setText("execTotalUsers", Number(ex.totalUsers || 0).toLocaleString());
  setText("execNewUsersToday", Number(ex.newUsersToday || 0).toLocaleString());
  setText("execActiveUsers", Number(ex.activeUsers || 0).toLocaleString());
  setText("execTotalRequests", Number(ex.totalApiRequests || 0).toLocaleString());
  setText("execTodayRequests", Number(ex.todaysRequests || 0).toLocaleString());
  setText("execMonthRequests", Number(ex.monthlyRequests || 0).toLocaleString());
  setText("execCreditsSold", Number(ex.creditsSold || 0).toLocaleString());
  setText("execCreditsConsumed", Number(ex.creditsConsumed || 0).toLocaleString());
  setText("execMrr", `€${Number(ex.mrr || 0).toLocaleString()}`);
  setText("execRevenue", `€${Number(ex.estimatedRevenue || 0).toLocaleString()}`);
  setText("execProviderCost", `€${Number(ex.estimatedProviderCost || 0).toLocaleString()}`);
  setText("execGrossProfit", `€${Number(ex.estimatedGrossProfit || 0).toLocaleString()}`);
  setText("execSystemHealth", String(ex.systemHealth || "unknown").toUpperCase());
}

function renderUsers(payload) {
  const rows = payload?.users || [];
  const body = document.getElementById("usersTableBody");
  if (!body) return;
  body.innerHTML = rows
    .map(
      (u) => `<tr data-user-id="${u.id}">
      <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td>
      <td><span class="status-pill ${pill(u.status)}">${esc(u.status)}</span></td>
      <td>${Number(u.credits || 0).toLocaleString()}</td>
      <td>${Number(u.usageRequests || 0).toLocaleString()}</td>
      <td class="admin-actions">
        <button class="button button-secondary button-sm" data-action="view-user">View</button>
        <button class="button button-secondary button-sm" data-action="toggle-user">${String(u.status).toLowerCase() === "active" ? "Disable" : "Enable"}</button>
        <button class="button button-secondary button-sm" data-action="credits-user">Reset Credits</button>
      </td>
    </tr>`
    )
    .join("");
  setText("usersPageLabel", `Page ${state.usersPage}`);
}

function renderProviders(rows) {
  const body = document.getElementById("providersTableBody");
  if (!body) return;
  body.innerHTML = (rows || [])
    .map(
      (p) => `<tr data-provider-id="${p.id}">
      <td>${esc(p.name)}</td>
      <td><span class="status-pill ${pill(p.status)}">${esc(p.status === "not_configured" ? "Not Configured" : p.status)}</span></td>
      <td>${p.latency || 0} ms</td>
      <td class="muted">${p.lastRequest ? new Date(p.lastRequest).toLocaleString("en-GB") : "—"}</td>
      <td>${Number(p.creditsUsed || 0).toLocaleString()}</td>
      <td>${Number(p.errorCount || 0).toLocaleString()}</td>
      <td>${Number(p.dailyRequests || 0).toLocaleString()}</td>
      <td>${esc(p.apiKeyStatus)}</td>
      <td class="admin-actions"><button class="button button-secondary button-sm" data-action="toggle-provider">${p.status === "not_configured" ? "Not Configured" : "Refresh"}</button></td>
    </tr>`
    )
    .join("");
}

function renderRevenue(rev) {
  setText(
    "revenueSummaryText",
    `Revenue Day points: ${rev.revenueByDay?.length || 0} · Revenue Month points: ${rev.revenueByMonth?.length || 0} · Credits Sold: ${Number(
      rev.creditsSold || 0
    ).toLocaleString()} · Credits Used: ${Number(rev.creditsUsed || 0).toLocaleString()}`
  );
  const body = document.getElementById("revenueChartsBody");
  if (!body) return;
  const rows = [
    ["Revenue by Day", rev.revenueByDay?.at?.(-1)?.y ?? 0],
    ["Revenue by Month", rev.revenueByMonth?.at?.(-1)?.y ?? 0],
    ["Provider Cost", rev.providerCostByMonth?.at?.(-1)?.y ?? 0],
    ["Gross Profit", rev.grossProfitByMonth?.at?.(-1)?.y ?? 0],
    ["User Growth", rev.userGrowth?.at?.(-1)?.y ?? 0],
    ["Subscription Distribution", rev.subscriptionDistribution?.map((r) => `${r.label}:${r.value}`).join(" · ") || "—"],
  ];
  body.innerHTML = rows
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${typeof v === "number" ? Number(v).toLocaleString() : esc(v)}</td></tr>`)
    .join("");
}

function renderHealth(rows) {
  const body = document.getElementById("healthTableBody");
  if (!body) return;
  body.innerHTML = (rows || [])
    .map((r) => `<tr><td>${esc(r.name)}</td><td><span class="status-pill ${pill(r.status)}">${esc(String(r.status || "").toUpperCase())}</span></td></tr>`)
    .join("");
}

function renderSecurity(security) {
  setText("securityActiveSessions", Number(security?.activeSessions || 0).toLocaleString());
  setText("securityFailedLogins", Number(security?.failedLogins || 0).toLocaleString());
  setText("securityBlockedIps", Number(security?.blockedIps?.length || 0).toLocaleString());
  setText("securityRecentActivityCount", Number(security?.recentActivities?.length || 0).toLocaleString());
  const body = document.getElementById("securityActivitiesBody");
  if (!body) return;
  const rows = security?.recentActivities || [];
  body.innerHTML = rows.length
    ? rows
        .map((row) => `<tr><td class="muted">${new Date(row.createdAt).toLocaleString("en-GB")}</td><td>${esc(row.action)}</td><td>${esc(row.detail)}</td></tr>`)
        .join("")
    : '<tr><td colspan="3" class="muted">No recent activity.</td></tr>';
}

function renderLogs(payload) {
  const rows = payload?.rows || [];
  const body = document.getElementById("logsTableBody");
  if (!body) return;
  body.innerHTML = rows.length
    ? rows
        .map((r) => `<tr><td class="muted">${new Date(r.time).toLocaleString("en-GB")}</td><td>${esc(r.user || "—")}</td><td>${esc(r.provider || "—")}</td><td>${esc(r.action)}</td><td>${esc(r.detail)}</td><td>${esc(r.ip || "—")}</td></tr>`)
        .join("")
    : '<tr><td colspan="6" class="muted">No logs.</td></tr>';
}

function renderAudit(rows) {
  const body = document.getElementById("auditTableBody");
  if (!body) return;
  body.innerHTML = (rows || [])
    .map((a) => `<tr><td class="muted">${a.time}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td>${esc(a.detail)}</td></tr>`)
    .join("");
}

function renderBilling(data) {
  const payBody = document.getElementById("billingPaymentsBody");
  const invBody = document.getElementById("billingInvoicesBody");
  if (payBody) {
    payBody.innerHTML = (data?.payments || [])
      .map((p) => `<tr><td class="muted">${(p.createdAt || "").slice(0, 10)}</td><td>€${Number(p.amountEur || 0).toFixed(2)}</td><td>${p.credits}</td><td><span class="status-pill ${pill(p.status)}">${p.status}</span></td><td class="muted">${p.sessionId || "—"}</td></tr>`)
      .join("");
  }
  if (invBody) {
    invBody.innerHTML = (data?.invoices || [])
      .map((i) => `<tr><td>${i.id}</td><td class="muted">${i.date}</td><td>€${Number(i.amountEur || 0).toFixed(2)}</td><td>${i.credits}</td><td><span class="status-pill ${pill(i.status)}">${i.status}</span></td></tr>`)
      .join("");
  }
}

function renderApiKeys(rows) {
  const body = document.getElementById("apikeysTableBody");
  if (!body) return;
  body.innerHTML = (rows || [])
    .map(
      (k) => `<tr data-key-id="${k.id}">
      <td>${esc(k.name)}</td><td class="muted">${esc(k.prefix)}</td>
      <td><span class="status-pill ${pill(k.status)}">${esc(k.status)}</span></td><td>${esc(k.quota)}</td><td>${Number(k.usage || 0).toLocaleString()}</td>
      <td class="admin-actions"><button class="button button-secondary button-sm" data-action="toggle-key">${k.status === "Active" ? "Disable" : "Enable"}</button><button class="button button-secondary button-sm" data-action="delete-key">Delete</button></td>
    </tr>`
    )
    .join("");
}

async function loadAll() {
  const userParams = {
    page: state.usersPage,
    pageSize: state.usersPageSize,
    q: document.getElementById("userSearch")?.value || "",
    role: document.getElementById("userRoleFilter")?.value || "",
    status: document.getElementById("userStatusFilter")?.value || "",
    sort: document.getElementById("userSort")?.value || "created_at_desc",
  };
  const [exec, users, providers, revenue, health, security, logs, audit, billing, apikeys] = await Promise.all([
    admin().getExecutive(),
    admin().getUsers(userParams.q ? userParams.q : "").then(async () => {
      const qp = new URLSearchParams(userParams);
      return window.ZwimaDatabase.queryApi(`/api/admin/users?${qp}`, "GET", null).then((r) => r.data);
    }),
    admin().getProviders(),
    admin().getRevenue(),
    admin().getHealth(),
    admin().getSecurityDashboard(),
    admin().getLogs({
      q: document.getElementById("logsSearch")?.value || "",
      userId: document.getElementById("logsUserFilter")?.value || "",
      date: document.getElementById("logsDateFilter")?.value || "",
    }),
    admin().getAuditLog(),
    admin().getBilling(),
    admin().getApiKeys(),
  ]);
  renderExecutive(exec);
  renderUsers(users);
  renderProviders(providers);
  renderRevenue(revenue);
  renderHealth(health);
  renderSecurity(security);
  renderLogs(logs);
  renderAudit(audit);
  renderBilling(billing);
  renderApiKeys(apikeys);
}

function exportLogsCsv() {
  const body = document.getElementById("logsTableBody");
  if (!body) return;
  const lines = ['"time","user","provider","action","detail","ip"'];
  body.querySelectorAll("tr").forEach((tr) => {
    const cols = [...tr.querySelectorAll("td")].map((td) => `"${td.textContent.replace(/"/g, '""')}"`);
    if (cols.length === 6) lines.push(cols.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ZwimaAdminGuard?.requireAdmin()) return;
  await loadAll();

  document.getElementById("userSearchBtn")?.addEventListener("click", () => loadAll());
  document.getElementById("usersPrevPage")?.addEventListener("click", async () => {
    if (state.usersPage <= 1) return;
    state.usersPage -= 1;
    await loadAll();
  });
  document.getElementById("usersNextPage")?.addEventListener("click", async () => {
    state.usersPage += 1;
    await loadAll();
  });

  document.getElementById("usersTableBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-user-id]");
    const btn = e.target.closest("[data-action]");
    if (!row || !btn) return;
    const userId = row.dataset.userId;
    if (btn.dataset.action === "toggle-user") {
      const status = row.querySelector(".status-pill")?.textContent || "";
      await admin().toggleUser(userId, String(status).toLowerCase() !== "active");
    } else if (btn.dataset.action === "credits-user") {
      await admin().adjustCredits(userId, 500);
    } else if (btn.dataset.action === "view-user") {
      const data = await admin().getUserDetails(userId);
      alert(
        `API Keys: ${data.apiKeys.length}\nUsage: ${data.usage.length}\nBilling: ${data.billing.length}\nLogin History: ${data.loginHistory.length}\nActivity: ${data.activity.length}`
      );
    }
    await loadAll();
  });

  document.getElementById("providersTableBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-provider-id]");
    const btn = e.target.closest('[data-action="toggle-provider"]');
    if (!row || !btn) return;
    await admin().updateProvider(row.dataset.providerId, { enabled: true });
    await loadAll();
  });

  document.getElementById("createKeyBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("newKeyName")?.value || "Admin Key";
    const userId = prompt("User ID for new key:");
    if (!userId) return;
    await admin().createApiKey({ name, userId });
    await loadAll();
  });

  document.getElementById("apikeysTableBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-key-id]");
    const btn = e.target.closest("[data-action]");
    if (!row || !btn) return;
    const keyId = row.dataset.keyId;
    if (btn.dataset.action === "toggle-key") {
      const active = row.querySelector(".status-pill")?.textContent === "Active";
      await admin().toggleApiKey(keyId, !active);
    } else if (btn.dataset.action === "delete-key") {
      if (confirm("Delete this API key?")) await admin().deleteApiKey(keyId);
    }
    await loadAll();
  });

  document.getElementById("logsSearchBtn")?.addEventListener("click", () => loadAll());
  document.getElementById("logsExportBtn")?.addEventListener("click", exportLogsCsv);

  document.querySelectorAll(".admin-nav [data-section]").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav [data-section]").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
});
