const sidebar = document.getElementById("dashboardSidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const inPageLinks = document.querySelectorAll(".sidebar-link[data-section]");

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

inPageLinks.forEach((link) => {
  link.addEventListener("click", () => {
    inPageLinks.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");

    if (sidebar && sidebar.classList.contains("is-open")) {
      sidebar.classList.remove("is-open");
      if (sidebarToggle) {
        sidebarToggle.setAttribute("aria-expanded", "false");
      }
    }
  });
});

const sections = document.querySelectorAll(".dash-section");

if (sections.length && inPageLinks.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const id = entry.target.getAttribute("id");
        inPageLinks.forEach((link) => {
          link.classList.toggle("active", link.dataset.section === id);
        });
      });
    },
    {
      rootMargin: "-30% 0px -55% 0px",
      threshold: 0,
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function statusClass(status) {
  return status === "Active" ? "active" : "disabled";
}

function formatEstimatedCost(totalEur) {
  const value = Number(totalEur) || 0;
  return `€${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this period`;
}

function sumUsageCost(records) {
  return (records || []).reduce((sum, row) => sum + (Number(row.estimatedCost) || 0), 0);
}

function sumMonthlyTokens(records) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return (records || [])
    .filter((row) => String(row.dateTime || "").slice(0, 7) === currentMonth)
    .reduce((sum, row) => sum + (Number(row.totalTokens) || 0), 0);
}

function summarizeProviderUsage(records) {
  const counts = {};
  for (const row of records || []) {
    const name = row.provider || "Unknown";
    counts[name] = (counts[name] || 0) + (Number(row.totalTokens) || 0);
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([provider, tokens]) => `${provider}: ${Number(tokens).toLocaleString()} tokens`);
}

function isSupabaseMode() {
  return window.ZwimaDbMode?.isSupabaseMode?.();
}

async function refreshLiveData() {
  await Promise.all([
    window.ZwimaCreditsService?.refreshWallet?.(),
    window.ZwimaUsageService?.refreshRecords?.(),
    window.ZwimaApiKeyService?.refreshKeys?.(),
  ]);
}

function renderDashboardFromLive(user) {
  const wallet = window.ZwimaCreditsService?.getWallet?.();
  const usageRecords = window.ZwimaUsageService?.getRecords?.() || [];
  const dashboardKeys = window.ZwimaApiKeyService?.getKeys?.() || [];
  const activeKeyCount = window.ZwimaApiKeyService?.getActiveCount?.() ?? 0;

  const balanceLabel = wallet
    ? `${wallet.balance.toLocaleString()} API credits`
    : "0 API credits";
  const monthlyUsageLabel = wallet
    ? `${sumMonthlyTokens(usageRecords).toLocaleString()} model tokens this month`
    : "0 credits this month";
  const estimatedCostLabel = formatEstimatedCost(sumUsageCost(usageRecords));

  const overviewValues = document.querySelectorAll("#overview .overview-card strong");
  if (overviewValues.length >= 5) {
    overviewValues[0].textContent = balanceLabel;
    overviewValues[1].textContent = monthlyUsageLabel;
    overviewValues[2].textContent = `${activeKeyCount} business keys`;
    overviewValues[3].textContent = estimatedCostLabel;
    overviewValues[4].textContent = user.status || "active";
  }
  const statusBadge = document.getElementById("overviewAccountStatus");
  if (statusBadge) statusBadge.textContent = user.status || "active";

  const activityList = document.querySelector("#recentActivityList") || document.querySelector("#overview .activity-list");
  if (activityList) {
    const usageActivity = window.ZwimaUsageService?.getRecentActivity?.(4) || [];
    if (!usageActivity.length) {
      activityList.innerHTML = `
        <article class="activity-item">
          <span class="activity-type">No activity yet</span>
          <p>Send a prompt in Playground to see recent API calls here.</p>
          <time class="activity-time">—</time>
        </article>
      `;
    } else {
      activityList.innerHTML = usageActivity
        .map(
          (item) => `
        <article class="activity-item">
          <span class="activity-type">${window.ZwimaFormat.escapeHtml(item.type)}</span>
          <p>${window.ZwimaFormat.escapeHtml(item.detail)}</p>
          <time class="activity-time">${window.ZwimaFormat.escapeHtml(item.time)}</time>
        </article>
      `
        )
        .join("");
    }
  }

  const apiKeysBody = document.querySelector("#api-keys tbody");
  if (apiKeysBody) {
    apiKeysBody.innerHTML = dashboardKeys.length
      ? dashboardKeys
          .map((key) => {
            const prefix = key.prefix || (key.key ? `${key.key.slice(0, 12)}...` : "—");
            const created = key.created || key.createdAt || "—";
            return `
        <tr>
          <td>${window.ZwimaFormat.escapeHtml(key.name)}</td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(prefix)}</td>
          <td><span class="status-pill ${statusClass(key.status)}">${window.ZwimaFormat.escapeHtml(key.status)}</span></td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(created)}</td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(key.lastUsed)}</td>
        </tr>
      `;
          })
          .join("")
      : '<tr><td colspan="5" class="muted">No API keys yet.</td></tr>';
  }

  const creditsPanel = document.querySelector("#credits .placeholder-panel strong");
  if (creditsPanel) creditsPanel.textContent = balanceLabel;

  const usagePanel = document.querySelector("#usage .placeholder-panel strong");
  if (usagePanel) usagePanel.textContent = monthlyUsageLabel;
  const usagePanelText = document.querySelector("#usage .placeholder-panel p");
  if (usagePanelText) {
    const topProviders = summarizeProviderUsage(usageRecords);
    usagePanelText.textContent = topProviders.length
      ? `Recent provider usage: ${topProviders.join(" · ")}.`
      : "No provider usage yet. Run Playground or Gateway requests to populate this section.";
  }

  const planRow = document.querySelector("#billing .billing-row:first-child strong");
  if (planRow) planRow.textContent = user.plan;

  const acctCompany = document.getElementById("acctCompany");
  const acctEmail = document.getElementById("acctEmail");
  const acctCountry = document.getElementById("acctCountry");
  const acctRole = document.getElementById("acctRole");
  const acctStatus = document.getElementById("acctStatus");
  const acctPlan = document.getElementById("acctPlan");
  const acctCredits = document.getElementById("acctCredits");
  const welcomeName = document.getElementById("dashboardWelcomeName");
  const sessionUser = window.ZwimaAuthService?.getCurrentUser?.() || user;
  if (welcomeName) welcomeName.textContent = sessionUser.company || sessionUser.name || sessionUser.email || "ZWIMA customer";
  if (acctCompany) acctCompany.textContent = sessionUser.company || "—";
  if (acctEmail) acctEmail.textContent = sessionUser.email || "—";
  if (acctCountry) acctCountry.textContent = sessionUser.country || "—";
  if (acctRole) acctRole.textContent = sessionUser.role || "—";
  if (acctStatus) acctStatus.textContent = sessionUser.status || "active";
  if (acctPlan) acctPlan.textContent = sessionUser.plan || "Starter";
  if (acctCredits) {
    acctCredits.textContent = wallet ? String(wallet.balance) : "0";
  }
}

async function renderDashboardFromMock(user) {
  const billing = window.ZwimaBillingService;
  const [overview, usage, keys, activity] = await Promise.all([
    billing.getCreditsOverview(),
    billing.getUsageStatistics(),
    billing.getApiKeys(),
    billing.getApiKeyActivity(),
  ]);

  const wallet = window.ZwimaCreditsService?.getWallet?.();
  const balanceLabel = wallet
    ? `${wallet.balance.toLocaleString()} API credits`
    : overview.balanceLabel;
  const monthlyUsageLabel = wallet
    ? `${sumMonthlyTokens(window.ZwimaUsageService?.getRecords?.() || []).toLocaleString()} model tokens this month`
    : overview.monthlyUsage;
  const apiKeyService = window.ZwimaApiKeyService;
  const localKeys = apiKeyService?.getKeys?.() ?? null;
  const activeKeyCount = apiKeyService?.getActiveCount?.() ?? user.apiKeyCount;
  const dashboardKeys = localKeys ?? keys;

  const overviewValues = document.querySelectorAll("#overview .overview-card strong");
  if (overviewValues.length >= 5) {
    overviewValues[0].textContent = balanceLabel;
    overviewValues[1].textContent = monthlyUsageLabel;
    overviewValues[2].textContent = `${activeKeyCount} business keys`;
    overviewValues[3].textContent = `${usage.estimatedCost} this period`;
    overviewValues[4].textContent = user.status || "active";
  }
  const statusBadge = document.getElementById("overviewAccountStatus");
  if (statusBadge) statusBadge.textContent = user.status || "active";

  const activityList = document.querySelector("#recentActivityList") || document.querySelector("#overview .activity-list");
  if (activityList) {
    const usageActivity = window.ZwimaUsageService?.getRecentActivity?.(4) || [];
    const rows = usageActivity.length ? usageActivity : activity.slice(0, 4);
    if (!rows.length) {
      activityList.innerHTML = `
        <article class="activity-item">
          <span class="activity-type">No activity yet</span>
          <p>Send a prompt in Playground to see recent API calls here.</p>
          <time class="activity-time">—</time>
        </article>
      `;
    } else {
      activityList.innerHTML = rows
        .map(
          (item) => `
        <article class="activity-item">
          <span class="activity-type">${window.ZwimaFormat.escapeHtml(item.type)}</span>
          <p>${window.ZwimaFormat.escapeHtml(item.detail)}</p>
          <time class="activity-time">${window.ZwimaFormat.escapeHtml(item.time)}</time>
        </article>
      `
        )
        .join("");
    }
  }

  const apiKeysBody = document.querySelector("#api-keys tbody");
  if (apiKeysBody) {
    apiKeysBody.innerHTML = dashboardKeys.length
      ? dashboardKeys
          .map((key) => {
            const prefix = key.prefix || (key.key ? `${key.key.slice(0, 12)}...` : "—");
            const created = key.created || key.createdAt || "—";
            return `
        <tr>
          <td>${window.ZwimaFormat.escapeHtml(key.name)}</td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(prefix)}</td>
          <td><span class="status-pill ${statusClass(key.status)}">${window.ZwimaFormat.escapeHtml(key.status)}</span></td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(created)}</td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(key.lastUsed)}</td>
        </tr>
      `;
          })
          .join("")
      : '<tr><td colspan="5" class="muted">No API keys yet.</td></tr>';
  }

  const creditsPanel = document.querySelector("#credits .placeholder-panel strong");
  if (creditsPanel) creditsPanel.textContent = balanceLabel;

  const usagePanel = document.querySelector("#usage .placeholder-panel strong");
  if (usagePanel) usagePanel.textContent = monthlyUsageLabel;
  const usagePanelText = document.querySelector("#usage .placeholder-panel p");
  if (usagePanelText) {
    const topProviders = summarizeProviderUsage(window.ZwimaUsageService?.getRecords?.() || []);
    usagePanelText.textContent = topProviders.length
      ? `Recent provider usage: ${topProviders.join(" · ")}.`
      : "No provider usage yet. Run Playground or Gateway requests to populate this section.";
  }

  const planRow = document.querySelector("#billing .billing-row:first-child strong");
  if (planRow) planRow.textContent = user.plan;

  const acctCompany = document.getElementById("acctCompany");
  const acctEmail = document.getElementById("acctEmail");
  const acctCountry = document.getElementById("acctCountry");
  const acctRole = document.getElementById("acctRole");
  const acctStatus = document.getElementById("acctStatus");
  const acctPlan = document.getElementById("acctPlan");
  const acctCredits = document.getElementById("acctCredits");
  const welcomeName = document.getElementById("dashboardWelcomeName");
  const sessionUser = window.ZwimaAuthService?.getCurrentUser?.() || user;
  if (welcomeName) welcomeName.textContent = sessionUser.company || sessionUser.name || sessionUser.email || "ZWIMA customer";
  if (acctCompany) acctCompany.textContent = sessionUser.company || "—";
  if (acctEmail) acctEmail.textContent = sessionUser.email || "—";
  if (acctCountry) acctCountry.textContent = sessionUser.country || "—";
  if (acctRole) acctRole.textContent = sessionUser.role || "—";
  if (acctStatus) acctStatus.textContent = sessionUser.status || "active";
  if (acctPlan) acctPlan.textContent = sessionUser.plan || "Starter";
  if (acctCredits) {
    acctCredits.textContent = wallet
      ? String(wallet.balance)
      : String(sessionUser.credits ?? sessionUser.creditsBalance ?? 12450);
  }
}

async function loadDashboardData() {
  const user = window.ZwimaUserService.getSessionSync();

  if (isSupabaseMode()) {
    try {
      await refreshLiveData();
      renderDashboardFromLive(user);
    } catch (err) {
      console.warn("[Dashboard] Supabase refresh failed:", err);
    }
    return;
  }

  await renderDashboardFromMock(user);
}

document.addEventListener("DOMContentLoaded", loadDashboardData);

window.ZwimaAppEvents?.onUpdated?.(() => {
  if (!isSupabaseMode()) return;
  loadDashboardData();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !isSupabaseMode()) return;
  loadDashboardData();
});
