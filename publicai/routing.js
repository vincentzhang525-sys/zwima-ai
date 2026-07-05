let priorityOrder = [];
let routingLog = [];
let statusTimer = null;

const priorityList = document.getElementById("priorityList");
const rulesList = document.getElementById("routingRules");
const statusBody = document.getElementById("providerStatusBody");
const logBody = document.getElementById("routingLogBody");
const resultModal = document.getElementById("routingResultModal");

function renderPriorityList() {
  if (!priorityList) return;
  priorityList.innerHTML = priorityOrder
    .map(
      (name, index) => `
        <li class="priority-item" draggable="true" data-provider="${name}">
          <span class="priority-handle">☰</span>
          <span>${index + 1}. ${name}</span>
        </li>
      `
    )
    .join("");
}

function renderRules(rules) {
  if (!rulesList) return;
  rulesList.innerHTML = rules
    .map(
      (rule) => `
      <li class="rule-item">
        <span class="rule-condition">${rule.condition}</span>
        <span class="rule-arrow">↓</span>
        <span class="rule-target">${rule.target}</span>
      </li>
    `
    )
    .join("");
}

function renderStatusTable(rows) {
  if (!statusBody) return;
  statusBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.name}</td>
        <td>${row.latency}</td>
        <td>${row.availability}</td>
        <td>${row.cost}</td>
      </tr>
    `
    )
    .join("");
}

function renderRoutingLog() {
  if (!logBody) return;
  logBody.innerHTML = routingLog
    .map(
      (row) => `
      <tr>
        <td class="muted">${row.time}</td>
        <td>${row.request}</td>
        <td>${row.provider}</td>
        <td class="muted">${row.latency}</td>
        <td><span class="status-pill ${row.status === "Fallback" ? "ready" : "active"}">${row.status}</span></td>
      </tr>
    `
    )
    .join("");
}

async function updateOptimizer() {
  const metrics = await window.ZwimaRoutingService.getOptimizerMetrics();
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("monthlySaving", metrics.monthlySaving);
  set("tokenCost", metrics.tokenCost);
  set("avgLatency", metrics.avgLatency);
  set("avgQuality", metrics.avgQuality);
}

function getSelectedStrategy() {
  const checked = document.querySelector('input[name="strategy"]:checked');
  return checked ? checked.value : "Balanced";
}

async function runRoutingSimulation() {
  const prompt = document.getElementById("testPrompt")?.value.trim();
  if (!prompt) {
    window.alert("Please enter a prompt to test routing.");
    return;
  }

  const strategy = getSelectedStrategy();
  const result = await window.ZwimaRoutingService.simulateRouting(prompt, strategy, priorityOrder);

  document.getElementById("resultProvider").textContent = result.provider;
  document.getElementById("resultReason").textContent = result.reason;
  document.getElementById("resultCost").textContent = result.estimatedCost;
  document.getElementById("resultLatency").textContent = result.estimatedLatency;

  if (resultModal) resultModal.hidden = false;

  routingLog.unshift({
    time: new Date().toTimeString().slice(0, 8),
    request: prompt.length > 36 ? `${prompt.slice(0, 36)}...` : prompt,
    provider: result.provider,
    latency: result.estimatedLatency,
    status: "Routed",
  });
  routingLog.pop();
  renderRoutingLog();
}

function setupDragDrop() {
  if (!priorityList) return;

  let draggedItem = null;

  priorityList.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".priority-item");
    if (!item) return;
    draggedItem = item;
    item.classList.add("dragging");
  });

  priorityList.addEventListener("dragend", (event) => {
    const item = event.target.closest(".priority-item");
    if (item) item.classList.remove("dragging");
    draggedItem = null;

    priorityOrder = [...priorityList.querySelectorAll(".priority-item")].map((el) => el.dataset.provider);
    renderPriorityList();
    setupDragDrop();
  });

  priorityList.addEventListener("dragover", (event) => {
    event.preventDefault();
    const item = event.target.closest(".priority-item");
    if (!item || !draggedItem || item === draggedItem) return;
    const rect = item.getBoundingClientRect();
    const next = event.clientY > rect.top + rect.height / 2;
    priorityList.insertBefore(draggedItem, next ? item.nextSibling : item);
  });
}

async function refreshLiveStatus() {
  const rows = await window.ZwimaRoutingService.getLiveProviderStatus();
  renderStatusTable(rows);
  updateOptimizer();
}

document.addEventListener("DOMContentLoaded", async () => {
  const routing = window.ZwimaRoutingService;
  const [rules, priority, log] = await Promise.all([
    routing.getRules(),
    routing.getProviderPriority(),
    routing.getRoutingLog(),
  ]);

  priorityOrder = priority;
  routingLog = [...log];

  renderPriorityList();
  setupDragDrop();
  renderRules(rules);
  renderRoutingLog();
  refreshLiveStatus();

  statusTimer = window.setInterval(refreshLiveStatus, 3000);

  document.getElementById("runRoutingBtn")?.addEventListener("click", runRoutingSimulation);

  document.getElementById("closeRoutingResult")?.addEventListener("click", () => {
    if (resultModal) resultModal.hidden = true;
  });

  resultModal?.addEventListener("click", (event) => {
    if (event.target === resultModal) resultModal.hidden = true;
  });
});

window.addEventListener("beforeunload", () => {
  if (statusTimer) window.clearInterval(statusTimer);
});
