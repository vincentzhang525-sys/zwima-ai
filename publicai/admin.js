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
      <td><span class="status-pill ${pill(p.enabled ? "active" : "disabled")}">${p.enabled ? "Enabled" : "Disabled"}</span></td>
      <td>${Number(p.priority || 0)}</td>
      <td>${esc(p.defaultModel || "—")}</td>
      <td><span class="status-pill ${pill(p.healthStatus === "online" ? "healthy" : p.healthStatus)}">${esc(p.healthLabel || p.healthStatus || p.status)}</span></td>
      <td>${p.latency || 0} ms</td>
      <td class="muted">${p.lastRequest ? new Date(p.lastRequest).toLocaleString("en-GB") : "—"}</td>
      <td>${Number(p.totalRequests || 0).toLocaleString()}</td>
      <td>${esc(p.apiKeyStatus)}</td>
      <td class="admin-actions">
        <button class="button button-secondary button-sm" data-action="toggle-provider">${p.enabled ? "Disable" : "Enable"}</button>
      </td>
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
    const orders = data?.orders || data?.payments || [];
    payBody.innerHTML = orders
      .map((p) => `<tr><td class="muted">${(p.createdAt || "").slice(0, 10)}</td><td>${esc(p.orderNumber || p.sessionId || "—")}</td><td>€${Number(p.amountEur || 0).toFixed(2)}</td><td><span class="status-pill ${pill(p.status)}">${esc(p.status)}</span></td><td class="muted">${esc(p.provider || "—")}</td></tr>`)
      .join("");
  }
  if (invBody) {
    invBody.innerHTML = (data?.invoices || [])
      .map((i) => `<tr><td>${esc(i.invoiceNumber || i.id)}</td><td class="muted">${i.date || (i.createdAt || "").slice(0, 10)}</td><td>€${Number(i.amountEur || 0).toFixed(2)}</td><td><span class="status-pill ${pill(i.status)}">${esc(i.status)}</span></td></tr>`)
      .join("");
  }
}

function renderCommerce(data) {
  setText("commerceRevenue", `€${Number(data?.revenue?.totalRevenue || 0).toLocaleString()}`);
  setText("commerceSubs", Number(data?.revenue?.activeSubscriptions || 0).toLocaleString());
  setText("commerceOrders", Number(data?.revenue?.orderCount || 0).toLocaleString());
  setText("commerceInvoices", Number(data?.revenue?.invoiceCount || 0).toLocaleString());

  const plansBody = document.getElementById("commercePlansBody");
  if (plansBody) {
    plansBody.innerHTML = (data?.plans || [])
      .map((p) => `<tr><td>${esc(p.name)}</td><td>${Number(p.monthlyCredits).toLocaleString()}</td><td>€${p.monthlyPrice}</td><td>€${p.annualPrice}</td><td>${p.rateLimit}/min</td><td><span class="status-pill ${pill(p.status)}">${esc(p.status)}</span></td></tr>`)
      .join("");
  }
  const pkgBody = document.getElementById("commercePackagesBody");
  if (pkgBody) {
    pkgBody.innerHTML = (data?.creditPackages || [])
      .map((p) => `<tr><td>${esc(p.name)}</td><td>${Number(p.credits).toLocaleString()}</td><td>€${p.price}</td><td>${(p.taxRate * 100).toFixed(0)}%</td><td><span class="status-pill ${pill(p.status)}">${esc(p.status)}</span></td></tr>`)
      .join("");
  }
  const couponBody = document.getElementById("commerceCouponsBody");
  if (couponBody) {
    couponBody.innerHTML = (data?.coupons || [])
      .map((c) => `<tr><td>${esc(c.code)}</td><td>${esc(c.discountType)}</td><td>${c.discountValue}${c.discountType === "percentage" ? "%" : ""}</td><td>${c.usageCount}${c.usageLimit ? `/${c.usageLimit}` : ""}</td><td><span class="status-pill ${pill(c.status)}">${esc(c.status)}</span></td></tr>`)
      .join("");
  }
}

function renderEnterprise(data) {
  setText("entOrgCount", Number(data?.totals?.organizations || 0).toLocaleString());
  setText("entTeamCount", Number(data?.totals?.teams || 0).toLocaleString());
  setText("entMemberCount", Number(data?.totals?.members || 0).toLocaleString());
  setText("entTotalRevenue", `€${Number(data?.totals?.totalRevenue || 0).toLocaleString()}`);

  const revMap = new Map((data?.revenueByOrganization || []).map((r) => [r.organizationId, r]));
  const orgBody = document.getElementById("enterpriseOrgsBody");
  if (orgBody) {
    orgBody.innerHTML = (data?.organizations || [])
      .map((o) => {
        const rev = revMap.get(o.id) || {};
        return `<tr><td>${esc(o.name)}</td><td>${esc(o.country)}</td><td>${esc(o.subscriptionPlan)}</td><td>${Number(o.credits).toLocaleString()}</td><td>${rev.memberCount || 0}</td><td>${rev.teamCount || 0}</td><td>€${Number(rev.revenue || 0).toFixed(2)}</td></tr>`;
      })
      .join("");
  }
  const rolesBody = document.getElementById("enterpriseRolesBody");
  if (rolesBody) {
    rolesBody.innerHTML = (data?.permissions || [])
      .map((p) => `<tr><td>${esc(p.role)}</td><td class="muted">${(p.permissions || []).join(", ")}</td></tr>`)
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

function renderSuccess(data) {
  if (!data) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("successQueueCount", data.analytics?.openTickets ?? "—");
  set("successAvgResolution", data.averageResolutionHours ?? "—");
  set("successOpenBugs", data.openBugs ?? "—");
  set("successCriticalBugs", data.criticalBugs ?? "—");
  set("successTotalVotes", data.totalVotes ?? "—");
  set("successSatisfaction", data.customerSatisfaction != null ? `${data.customerSatisfaction}/5` : "—");
  set("successProviderComplaints", data.providerComplaints ?? "—");

  const ticketsBody = document.getElementById("successTicketsBody");
  if (ticketsBody) {
    ticketsBody.innerHTML = (data.ticketQueue || [])
      .map(
        (t) => `<tr data-ticket-id="${t.id}">
        <td>${esc(t.ticketNumber)}</td><td>${esc(t.title)}</td><td>${esc(t.category || "—")}</td>
        <td>${esc(t.priority)}</td><td>${esc(t.status)}</td>
        <td class="admin-actions">
          <button class="button button-sm button-secondary" data-action="assign-ticket">Assign</button>
          <button class="button button-sm button-secondary" data-action="resolve-ticket">Resolve</button>
          <button class="button button-sm button-secondary" data-action="close-ticket">Close</button>
        </td></tr>`
      )
      .join("") || '<tr><td colspan="6" class="muted">No open tickets.</td></tr>';
  }

  const featuresBody = document.getElementById("successFeaturesBody");
  if (featuresBody) {
    featuresBody.innerHTML = (data.topRequestedModels || [])
      .map(
        (f, i) => {
          const feat = (data.featureVotes || [])[i];
          const id = feat?.id || "";
          return `<tr data-feature-id="${id}">
          <td>${esc(f.title)}</td><td>${f.votes}</td><td>${esc(f.status || "pending")}</td>
          <td class="admin-actions">
            <button class="button button-sm button-secondary" data-action="approve-feature">Approve</button>
            <button class="button button-sm button-secondary" data-action="release-feature">Released</button>
          </td></tr>`;
        }
      )
      .join("") || '<tr><td colspan="4" class="muted">No feature requests.</td></tr>';
  }

  const incBody = document.getElementById("successIncidentsBody");
  if (incBody) {
    incBody.innerHTML = (data.incidents || [])
      .map(
        (i) => `<tr data-incident-id="${i.id}">
        <td>${esc(i.component)}</td><td>${esc(i.title)}</td><td>${esc(i.impact)}</td><td>${esc(i.incidentStatus)}</td>
        <td>${i.incidentStatus !== "resolved" ? `<button class="button button-sm button-secondary" data-action="resolve-incident">Resolve</button>` : "—"}</td>
      </tr>`
      )
      .join("") || '<tr><td colspan="5" class="muted">No incidents.</td></tr>';
  }
}

function renderCommercialHealth(payload) {
  if (!payload) return;
  setText("commHealthPlatform", payload.platformHealth || "—");
  setText("commHealthEmailMode", payload.email?.modeLabel || "—");
  setText("commHealthSmtp", payload.email?.connection?.ok ? "OK" : payload.email?.connection?.error || "Not configured");
  setText("commHealthStripeMode", payload.stripe?.mode || "—");
  setText("commHealthWebhooks", String(payload.stripe?.webhookEvents7d ?? "—"));
  setText("commHealthGateway", payload.gateway?.status || "—");
  setText("commHealthRevenue", payload.payments?.revenue30d != null ? `€${payload.payments.revenue30d}` : "—");
  setText("commHealthUsers", payload.users ? `${payload.users.total} (+${payload.users.registrations24h}/24h)` : "—");
  setText("commHealthUsage", String(payload.usage?.requests24h ?? "—"));
  setText("commHealthErrors", String(payload.errors?.gatewayErrors24h ?? "—"));
  setText("commHealthLedger", String(payload.reconciliation?.mismatches ?? "—"));
  setText("commHealthPending", String(payload.payments?.pendingOrders ?? "—"));
  const blockers = payload.blockers || [];
  setText("commHealthBlockers", String(blockers.length));
  const providersEl = document.getElementById("commHealthProviders");
  if (providersEl) {
    providersEl.innerHTML = (payload.providers || [])
      .map((p) => `<span class="status-pill ${p.enabled && p.configured ? "active" : "planned"}" style="margin-right:6px;">${esc(p.name)}: ${p.enabled && p.configured ? "live" : p.configured ? "ready" : "no key"}</span>`)
      .join("") || '<span class="muted">No providers configured.</span>';
  }
  const list = document.getElementById("commHealthBlockerList");
  if (list) {
    list.innerHTML = blockers.length
      ? blockers.map((b) => `<p><span class="status-pill ${b.severity === "critical" ? "failed" : "planned"}">${esc(b.severity)}</span> ${esc(b.message)}</p>`).join("")
      : '<p class="muted">No commercial launch blockers detected.</p>';
  }
  const legal = document.getElementById("commHealthLegalMissing");
  if (legal) {
    legal.innerHTML = (payload.legal?.missingFields || [])
      .map((f) => `<li>${esc(f.label)} — founder input required</li>`)
      .join("") || '<li class="muted">No tracked missing legal fields.</li>';
  }
}

function renderCommercial(data) {
  if (!data) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("commProviderCount", data.providers?.count ?? "—");
  set("commModelCount", data.models?.count ?? "—");
  set("commPricingCount", (data.pricingRules || []).length);
  set("commAuditCount", data.metrics?.requestCount ?? 0);
  set("commRevenue", data.metrics ? `€${data.metrics.totalRevenue}` : "—");
  set("commCost", data.metrics ? `€${data.metrics.totalProviderCost}` : "—");
  set("commProfit", data.metrics ? `€${data.metrics.totalProfit}` : "—");
  set("commMargin", data.metrics ? `${data.metrics.avgMarginPct}%` : "—");

  const pb = document.getElementById("commProvidersBody");
  if (pb) {
    pb.innerHTML = (data.providers?.items || [])
      .map(
        (p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.providerType || "llm")}</td><td>${esc(p.status)}</td>
        <td>${esc(p.region)}</td><td>${esc(p.healthStatus)}</td><td>${p.avgLatencyMs || 0}ms</td><td>${p.profitMarginPct || 0}%</td></tr>`
      )
      .join("") || '<tr><td colspan="7" class="muted">No providers (DB migration pending).</td></tr>';
  }

  const mb = document.getElementById("commModelsBody");
  if (mb) {
    mb.innerHTML = (data.models?.items || [])
      .slice(0, 20)
      .map(
        (m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.providerId)}</td><td>$${m.inputPricePer1m}</td><td>$${m.outputPricePer1m}</td>
        <td>${m.euAvailable ? "Yes" : "No"}</td><td>${m.gdprCompatible ? "Yes" : "No"}</td><td>${esc(m.availability)}</td></tr>`
      )
      .join("") || '<tr><td colspan="7" class="muted">No models.</td></tr>';
  }

  const ab = document.getElementById("commAuditsBody");
  if (ab) {
    ab.innerHTML = (data.recentAudits || [])
      .map(
        (a) => `<tr><td class="muted">${esc((a.traceId || "").slice(0, 12))}…</td><td>${esc(a.providerId)}</td><td>${esc(a.modelId)}</td>
        <td>${a.totalTokens}</td><td>€${a.providerCost}</td><td>€${a.customerCharge}</td><td>€${a.grossMargin}</td><td>${a.latencyMs}ms</td></tr>`
      )
      .join("") || '<tr><td colspan="8" class="muted">No API audits yet.</td></tr>';
  }
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
  const [exec, users, providers, revenue, health, security, logs, audit, billing, commerce, enterprise, apikeys, success, commercial, commercialHealth] = await Promise.all([
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
    admin().getCommerce(),
    admin().getEnterprise(),
    admin().getApiKeys(),
    admin().getSuccess(),
    admin().getCommercial("overview").catch(() => null),
    admin().getCommercialHealth().catch(() => null),
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
  renderCommerce(commerce);
  renderEnterprise(enterprise);
  renderApiKeys(apikeys);
  renderSuccess(success);
  renderCommercialHealth(commercialHealth);
  renderCommercial(commercial);
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
    const enable = btn.textContent.trim().toLowerCase() === "enable";
    await admin().updateProvider(row.dataset.providerId, { enabled: enable });
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

  document.getElementById("incidentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await admin().publishIncident({
      title: document.getElementById("incidentTitle")?.value,
      component: document.getElementById("incidentComponent")?.value,
      impact: document.getElementById("incidentImpact")?.value,
      description: document.getElementById("incidentTitle")?.value,
    });
    e.target.reset();
    await loadAll();
  });

  document.getElementById("successTicketsBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-ticket-id]");
    const btn = e.target.closest("[data-action]");
    if (!row || !btn) return;
    const ticketId = row.dataset.ticketId;
    const status =
      btn.dataset.action === "assign-ticket"
        ? "assigned"
        : btn.dataset.action === "resolve-ticket"
          ? "resolved"
          : btn.dataset.action === "close-ticket"
            ? "closed"
            : null;
    if (status) await admin().updateTicket(ticketId, { status });
    await loadAll();
  });

  document.getElementById("successFeaturesBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-feature-id]");
    const btn = e.target.closest("[data-action]");
    if (!row || !btn || !row.dataset.featureId) return;
    const roadmapStatus = btn.dataset.action === "release-feature" ? "released" : "approved";
    await admin().updateFeature(row.dataset.featureId, { roadmapStatus });
    await loadAll();
  });

  document.getElementById("successIncidentsBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-incident-id]");
    const btn = e.target.closest('[data-action="resolve-incident"]');
    if (!row || !btn) return;
    await admin().resolveIncident(row.dataset.incidentId);
    await loadAll();
  });

  document.querySelectorAll(".admin-nav [data-section]").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav [data-section]").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
});
