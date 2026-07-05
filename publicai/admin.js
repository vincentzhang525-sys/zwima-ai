const admin = () => window.ZwimaAdminService;

function pill(status) {
  const map = { active: "active", disabled: "failed", succeeded: "active", paid: "active", healthy: "active", unhealthy: "failed" };
  return map[String(status).toLowerCase()] || "planned";
}

function renderUsers(rows) {
  const body = document.getElementById("usersTableBody");
  if (!body) return;
  body.innerHTML = rows
    .map(
      (u) => `
    <tr data-user-id="${u.id}">
      <td>${window.ZwimaFormat.escapeHtml(u.name)}</td>
      <td>${window.ZwimaFormat.escapeHtml(u.email)}</td>
      <td>${u.role}</td>
      <td><span class="status-pill ${pill(u.status)}">${u.status}</span></td>
      <td>${Number(u.credits).toLocaleString()}</td>
      <td class="admin-actions">
        <button class="button button-secondary button-sm" type="button" data-action="toggle-user">${u.status === "active" ? "Disable" : "Enable"}</button>
        <button class="button button-secondary button-sm" type="button" data-action="credits-user">+500</button>
      </td>
    </tr>`
    )
    .join("");
}

function renderProviders(rows) {
  const body = document.getElementById("providersTableBody");
  if (!body) return;
  body.innerHTML = rows
    .map(
      (p) => `
    <tr data-provider-id="${p.id}">
      <td>${p.name}</td>
      <td><span class="status-pill ${p.enabled ? "active" : "failed"}">${p.enabled ? "Yes" : "No"}</span></td>
      <td>${p.priority}</td>
      <td>${p.weight}</td>
      <td><span class="status-pill ${pill(p.health)}">${p.health}</span></td>
      <td>${p.latency || "—"} ms</td>
      <td class="admin-actions">
        <button class="button button-secondary button-sm" type="button" data-action="toggle-provider">${p.enabled ? "Disable" : "Enable"}</button>
      </td>
    </tr>`
    )
    .join("");
}

function renderPricing(rows) {
  const body = document.getElementById("pricingTableBody");
  if (!body) return;
  body.innerHTML = rows
    .map(
      (p) => `
    <tr data-price-id="${p.id}">
      <td>${p.provider}</td>
      <td>${p.model}</td>
      <td>€${p.tokenCost}</td>
      <td>€${p.sellPrice}</td>
      <td>${p.margin}%</td>
      <td><button class="button button-secondary button-sm" type="button" data-action="edit-price">Edit</button></td>
    </tr>`
    )
    .join("");
}

function renderBilling(data) {
  const payBody = document.getElementById("billingPaymentsBody");
  const invBody = document.getElementById("billingInvoicesBody");
  if (payBody) {
    payBody.innerHTML = (data.payments || [])
      .map(
        (p) => `
      <tr>
        <td class="muted">${(p.createdAt || "").slice(0, 10)}</td>
        <td>€${Number(p.amountEur || 0).toFixed(2)}</td>
        <td>${p.credits}</td>
        <td><span class="status-pill ${pill(p.status)}">${p.status}</span></td>
        <td class="muted">${p.sessionId || "—"}</td>
      </tr>`
      )
      .join("");
  }
  if (invBody) {
    invBody.innerHTML = (data.invoices || [])
      .map(
        (i) => `
      <tr>
        <td>${i.id}</td>
        <td class="muted">${i.date}</td>
        <td>€${Number(i.amountEur || 0).toFixed(2)}</td>
        <td>${i.credits}</td>
        <td><span class="status-pill ${pill(i.status)}">${i.status}</span></td>
      </tr>`
      )
      .join("");
  }
}

function renderApiKeys(rows) {
  const body = document.getElementById("apikeysTableBody");
  if (!body) return;
  body.innerHTML = rows
    .map(
      (k) => `
    <tr data-key-id="${k.id}">
      <td>${window.ZwimaFormat.escapeHtml(k.name)}</td>
      <td class="muted">${k.prefix}</td>
      <td><span class="status-pill ${pill(k.status)}">${k.status}</span></td>
      <td>${k.quota}</td>
      <td>${k.usage}</td>
      <td class="admin-actions">
        <button class="button button-secondary button-sm" type="button" data-action="toggle-key">${k.status === "Active" ? "Disable" : "Enable"}</button>
        <button class="button button-secondary button-sm" type="button" data-action="quota-key">Quota</button>
        <button class="button button-secondary button-sm" type="button" data-action="delete-key">Delete</button>
      </td>
    </tr>`
    )
    .join("");
}

function renderStats(stats) {
  const grid = document.getElementById("statsGrid");
  if (!grid) return;
  const cards = [
    ["Today Revenue", `€${Number(stats.todayRevenue || 0).toLocaleString()}`],
    ["Total Revenue", `€${Number(stats.totalRevenue || 0).toLocaleString()}`],
    ["Token Usage", `${Number(stats.tokenUsage || 0).toLocaleString()}`],
    ["API Calls", `${Number(stats.apiCalls || 0).toLocaleString()}`],
    ["Profit", `€${Number(stats.profit || 0).toLocaleString()}`],
  ];
  grid.innerHTML = cards
    .map(([label, value]) => `<article class="admin-stat-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");

  const topBody = document.getElementById("topCustomersBody");
  if (topBody) {
    topBody.innerHTML = (stats.topCustomers || [])
      .map((c) => `<tr><td>${c.name}</td><td>€${c.revenue.toLocaleString()}</td><td>${c.credits.toLocaleString()}</td></tr>`)
      .join("");
  }
}

function renderAudit(rows) {
  const body = document.getElementById("auditTableBody");
  if (!body) return;
  body.innerHTML = rows
    .map((a) => `<tr><td class="muted">${a.time}</td><td>${a.actor}</td><td>${a.action}</td><td>${a.target}</td><td>${a.detail}</td></tr>`)
    .join("");
}

async function loadAll(q) {
  const [users, providers, pricing, billing, apikeys, statistics, audit] = await Promise.all([
    admin().getUsers(q),
    admin().getProviders(),
    admin().getPricing(),
    admin().getBilling(),
    admin().getApiKeys(),
    admin().getStatistics(),
    admin().getAuditLog(),
  ]);
  renderUsers(users);
  renderProviders(providers);
  renderPricing(pricing);
  renderBilling(billing);
  renderApiKeys(apikeys);
  renderStats(statistics);
  renderAudit(audit);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ZwimaAdminGuard?.requireAdmin()) return;
  await loadAll();

  document.getElementById("userSearchBtn")?.addEventListener("click", () => {
    loadAll(document.getElementById("userSearch")?.value || "");
  });

  document.getElementById("usersTableBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-user-id]");
    const btn = e.target.closest("[data-action]");
    if (!row || !btn) return;
    const userId = row.dataset.userId;
    if (btn.dataset.action === "toggle-user") {
      const status = row.querySelector(".status-pill")?.textContent;
      await admin().toggleUser(userId, status !== "active");
    }
    if (btn.dataset.action === "credits-user") await admin().adjustCredits(userId, 500);
    await loadAll(document.getElementById("userSearch")?.value || "");
  });

  document.getElementById("providersTableBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-provider-id]");
    const btn = e.target.closest('[data-action="toggle-provider"]');
    if (!row || !btn) return;
    const enabled = btn.textContent.trim() === "Enable";
    await admin().updateProvider(row.dataset.providerId, { enabled });
    await loadAll();
  });

  document.getElementById("pricingTableBody")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-price-id]");
    const btn = e.target.closest('[data-action="edit-price"]');
    if (!row || !btn) return;
    const sell = window.prompt("New sell price (EUR per token):", "0.000004");
    if (!sell) return;
    await admin().updatePricing(row.dataset.priceId, { sellPrice: Number(sell) });
    await loadAll();
  });

  document.getElementById("createKeyBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("newKeyName")?.value || "Admin Key";
    await admin().createApiKey({ name });
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
    }
    if (btn.dataset.action === "quota-key") {
      const quota = window.prompt("New quota:", "100,000 / mo");
      if (quota) await admin().setApiKeyQuota(keyId, quota);
    }
    if (btn.dataset.action === "delete-key") {
      if (window.confirm("Delete this API key?")) await admin().deleteApiKey(keyId);
    }
    await loadAll();
  });

  document.querySelectorAll(".admin-nav [data-section]").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav [data-section]").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
});
