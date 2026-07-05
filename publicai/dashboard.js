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

async function loadDashboardData() {
  const billing = window.ZwimaBillingService;
  const user = window.ZwimaUserService.getSessionSync();
  const [overview, usage, keys, activity] = await Promise.all([
    billing.getCreditsOverview(),
    billing.getUsageStatistics(),
    billing.getApiKeys(),
    billing.getApiKeyActivity(),
  ]);

  const overviewValues = document.querySelectorAll("#overview .overview-card strong");
  if (overviewValues.length >= 5) {
    overviewValues[0].textContent = overview.balanceLabel;
    overviewValues[1].textContent = overview.monthlyUsage;
    overviewValues[2].textContent = `${user.apiKeyCount} business keys`;
    overviewValues[3].textContent = `${usage.estimatedCost} this period`;
    overviewValues[4].textContent = "Invoice ready";
  }

  const activityList = document.querySelector("#overview .activity-list");
  if (activityList) {
    activityList.innerHTML = activity
      .slice(0, 4)
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

  const apiKeysBody = document.querySelector("#api-keys tbody");
  if (apiKeysBody) {
    apiKeysBody.innerHTML = keys
      .map(
        (key) => `
        <tr>
          <td>${window.ZwimaFormat.escapeHtml(key.name)}</td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(key.prefix)}...</td>
          <td><span class="status-pill ${statusClass(key.status)}">${window.ZwimaFormat.escapeHtml(key.status)}</span></td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(key.created)}</td>
          <td class="muted">${window.ZwimaFormat.escapeHtml(key.lastUsed)}</td>
        </tr>
      `
      )
      .join("");
  }

  const creditsPanel = document.querySelector("#credits .placeholder-panel strong");
  if (creditsPanel) creditsPanel.textContent = overview.balanceLabel;

  const usagePanel = document.querySelector("#usage .placeholder-panel strong");
  if (usagePanel) usagePanel.textContent = overview.monthlyUsage;

  const planRow = document.querySelector("#billing .billing-row:first-child strong");
  if (planRow) planRow.textContent = user.plan;
}

document.addEventListener("DOMContentLoaded", loadDashboardData);
