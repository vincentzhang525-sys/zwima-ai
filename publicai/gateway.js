let activeTab = "Python";
let codeExamples = {};
let gatewayEndpoint = "";

function renderProviders(providers) {
  const list = document.getElementById("providerStatusList");
  if (!list) return;

  list.innerHTML = providers
    .map(
      (p) => `
      <li class="provider-status-item">
        <span class="provider-status-name">${p.name}</span>
        <span class="status-pill ${p.statusClass}">${p.status}</span>
      </li>
    `
    )
    .join("");
}

function renderHealth(items) {
  const list = document.getElementById("healthList");
  if (!list) return;

  list.innerHTML = items
    .map(
      (item) => `
      <li class="health-item">
        <span class="health-name">${item.name}</span>
        <span class="status-pill ${item.statusClass}">${item.status}</span>
      </li>
    `
    )
    .join("");
}

function renderRateLimits(rows) {
  const body = document.getElementById("rateLimitsBody");
  if (!body) return;

  body.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.plan}</td>
        <td>${row.rpm}</td>
        <td>${row.tpd}</td>
        <td>${row.concurrent}</td>
      </tr>
    `
    )
    .join("");
}

function renderRequestLogs(rows) {
  const body = document.getElementById("requestLogsBody");
  if (!body) return;

  body.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td class="muted">${row.time}</td>
        <td><code>${row.endpoint}</code></td>
        <td>${row.provider}</td>
        <td class="muted">${row.latency}</td>
        <td><span class="status-pill ${row.status === "200" ? "active" : "failed"}">${row.status}</span></td>
        <td class="muted">${row.tokens}</td>
      </tr>
    `
    )
    .join("");
}

function renderCodeTabs() {
  const tabs = document.getElementById("codeTabs");
  if (!tabs) return;

  tabs.innerHTML = Object.keys(codeExamples)
    .map(
      (lang) =>
        `<button class="code-tab${lang === activeTab ? " active" : ""}" type="button" data-lang="${lang}" role="tab">${lang}</button>`
    )
    .join("");
}

function renderCodeExample() {
  const block = document.getElementById("codeExample");
  if (block) block.textContent = codeExamples[activeTab] || "";
}

async function updateStats() {
  const stats = await window.ZwimaApiService.getGatewayStatistics();
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("statRequests", stats.todayRequests.toLocaleString());
  set("statLatency", `${stats.avgLatency} ms`);
  set("statSuccess", `${stats.successRate}%`);
  set("statTokens", stats.tokenUsage);
}

document.addEventListener("DOMContentLoaded", async () => {
  const api = window.ZwimaApiService;
  const [endpoint, providers, health, rateLimits, logs, examples] = await Promise.all([
    api.getEndpoint(),
    api.getGatewayProviders(),
    api.getHealth(),
    api.getRateLimits(),
    api.getRequestLogs(),
    api.getCodeExamples(),
  ]);

  gatewayEndpoint = endpoint;
  codeExamples = examples;

  const endpointEl = document.getElementById("gatewayEndpoint");
  if (endpointEl) endpointEl.textContent = endpoint;

  renderProviders(providers);
  renderHealth(health);
  renderRateLimits(rateLimits);
  renderRequestLogs(logs);
  renderCodeTabs();
  renderCodeExample();
  updateStats();

  document.getElementById("copyEndpointBtn")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(gatewayEndpoint);
  });

  document.getElementById("codeTabs")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-lang]");
    if (!tab) return;
    activeTab = tab.dataset.lang;
    renderCodeTabs();
    renderCodeExample();
  });

  document.querySelector(".sdk-actions")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-sdk]");
    if (!button) return;
    const result = await api.downloadSdk();
    window.alert(result.message);
  });

  window.setInterval(updateStats, 5000);
});
