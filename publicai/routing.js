let priorityOrder = ["OpenAI", "Google Gemini"];
let routingLog = [];
let statusTimer = null;

const priorityList = document.getElementById("priorityList");
const rulesList = document.getElementById("routingRules");
const statusBody = document.getElementById("providerStatusBody");
const logBody = document.getElementById("routingLogBody");
const resultModal = document.getElementById("routingResultModal");

const ROUTING_RULES = [
  { condition: "General chat", target: "OpenAI · GPT-4o" },
  { condition: "Coding tasks", target: "OpenAI · GPT-4.1" },
  { condition: "Low cost / fast response", target: "Google Gemini · Gemini 2.5 Flash" },
  { condition: "Long explanation", target: "Google Gemini · Gemini 2.5 Pro (fallback GPT-4.1)" },
];

function estimateCostEur(inputTokens, outputTokens, priceIn, priceOut) {
  const value = (inputTokens * priceIn + outputTokens * priceOut) / 1_000_000;
  return `€${value.toFixed(4)}`;
}

function classifyPrompt(prompt) {
  const text = String(prompt || "").toLowerCase();
  const coding = /(code|bug|debug|refactor|typescript|javascript|python|sql|api|function)/.test(text);
  const lowCost = /(cheap|low cost|fast|quick|summary|brief|short)/.test(text);
  const longExplain = /(explain|detailed|deep dive|step by step|comprehensive|long)/.test(text);
  if (coding) return "coding";
  if (lowCost) return "fast";
  if (longExplain) return "long";
  return "chat";
}

function selectRoute(prompt) {
  const task = classifyPrompt(prompt);
  if (task === "coding") {
    return {
      provider: "OpenAI",
      model: "GPT-4.1",
      reason: "Detected coding intent; route to GPT-4.1 for stronger code generation and fixes.",
      estimatedCost: estimateCostEur(400, 600, 2, 8),
      estimatedLatency: "520 ms",
    };
  }
  if (task === "fast") {
    return {
      provider: "Google Gemini",
      model: "Gemini 2.5 Flash",
      reason: "Detected low-cost/fast request; route to Gemini Flash for speed and lower cost.",
      estimatedCost: estimateCostEur(400, 600, 0.1, 0.4),
      estimatedLatency: "290 ms",
    };
  }
  if (task === "long") {
    return {
      provider: "Google Gemini",
      model: "Gemini 2.5 Pro",
      reason: "Detected long explanation request; prefer Gemini Pro, fallback to GPT-4.1 if unavailable.",
      estimatedCost: estimateCostEur(700, 1200, 1.25, 5),
      estimatedLatency: "680 ms",
    };
  }
  return {
    provider: "OpenAI",
    model: "GPT-4o",
    reason: "Default general chat route for balanced quality and latency.",
    estimatedCost: estimateCostEur(350, 500, 2.5, 10),
    estimatedLatency: "470 ms",
  };
}

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
  const metrics = {
    monthlySaving: "€132",
    tokenCost: "€0.041 / 1K",
    avgLatency: "404 ms",
    avgQuality: "8.8 / 10",
  };
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
  const result = selectRoute(prompt, strategy);

  document.getElementById("resultProvider").textContent = result.provider;
  document.getElementById("resultModel").textContent = result.model;
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
  const rows = [
    { name: "OpenAI", latency: "470 ms", availability: "99.9%", cost: "€0.052 / 1K" },
    { name: "Google Gemini", latency: "315 ms", availability: "99.8%", cost: "€0.022 / 1K" },
  ];
  renderStatusTable(rows);
  updateOptimizer();
}

document.addEventListener("DOMContentLoaded", async () => {
  const rules = ROUTING_RULES;
  routingLog = [];

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
