const RESPONSE_TEMPLATES = {
  openai: (prompt, model) =>
    `Here is a detailed reasoning response from ${model}:\n\nI've analyzed your request — "${truncate(prompt, 80)}" — and structured a step-by-step answer. First, I identified the core objective. Then I evaluated relevant constraints and produced a clear recommendation with actionable next steps.`,
  anthropic: (prompt, model) =>
    `Certainly. Let's think through this carefully.\n\nRegarding "${truncate(prompt, 80)}", I'll break this down methodically. ${model} suggests starting with context, then exploring alternatives before arriving at a balanced conclusion tailored to your use case.`,
  google: (prompt, model) =>
    `I can help you with that.\n\nUsing ${model}, here is a concise response to your question about "${truncate(prompt, 80)}". I've summarized the key points and included practical guidance you can apply immediately.`,
  deepseek: (prompt, model) =>
    `Based on your request — "${truncate(prompt, 80)}" — ${model} provides the following analysis:\n\nI've reviewed the input parameters and generated a cost-efficient response focused on accuracy and clarity for production workloads.`,
  qwen: (prompt, model) =>
    `Here is a focused response from ${model} to your question:\n\n"${truncate(prompt, 80)}" — I've prepared a structured answer optimized for enterprise and coding scenarios with clear, actionable output.`,
  glm: (prompt, model) =>
    `${model} response:\n\nFor your query "${truncate(prompt, 80)}", I've prepared a multilingual-ready answer suitable for enterprise deployment across regional routing paths.`,
  mistral: (prompt, model) =>
    `${model} (Europe routing):\n\nAddressing "${truncate(prompt, 80)}" with an enterprise-grade response optimized for European compliance and coding workloads.`,
};

let providersMap = {};
let providerList = [];
let messages = [];
let sessionInputTokens = 0;
let sessionOutputTokens = 0;
let sessionCost = 0;
let lastResponseMs = null;

const providerSelect = document.getElementById("providerSelect");
const modelSelect = document.getElementById("modelSelect");
const temperatureRange = document.getElementById("temperatureRange");
const temperatureValue = document.getElementById("temperatureValue");
const systemPromptInput = document.getElementById("systemPromptInput");
const chatMessages = document.getElementById("chatMessages");
const promptInput = document.getElementById("promptInput");
const historyList = document.getElementById("historyList");

function truncate(text, len) {
  return window.ZwimaFormat.truncate(text, len);
}

function slugify(name) {
  return window.ZwimaFormat.slugify(name);
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

function parsePrice(value) {
  const match = String(value || "").match(/€([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function getSelectedProvider() {
  const id = providerSelect?.value;
  return providersMap[id] || providersMap.openai;
}

function getSelectedModel() {
  const provider = getSelectedProvider();
  const modelName = modelSelect?.value;
  return provider.models.find((m) => m.name === modelName) || provider.models[0];
}

function populateProviders() {
  if (!providerSelect) return;
  providerSelect.innerHTML = providerList
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join("");
}

function populateModels(providerId) {
  if (!modelSelect) return;
  const provider = providersMap[providerId] || providersMap.openai;
  modelSelect.innerHTML = provider.models
    .map((m) => `<option value="${m.name}">${m.name}</option>`)
    .join("");
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const providerId = params.get("provider");
  const modelSlug = params.get("model");

  if (providerId && providersMap[providerId] && providerSelect) {
    providerSelect.value = providerId;
    populateModels(providerId);
  }

  if (modelSlug && modelSelect) {
    const provider = getSelectedProvider();
    const match = provider.models.find((m) => slugify(m.name) === modelSlug.toLowerCase());
    if (match) modelSelect.value = match.name;
  }
}

function updateModelInfo() {
  const provider = getSelectedProvider();
  const model = getSelectedModel();

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("infoProvider", provider.name);
  set("infoContext", model.context);
  set("infoPricing", `${model.inputPrice} in · ${model.outputPrice} out`);
  set("infoLatency", provider.latency);
  set("infoRegion", provider.region);

  const capEl = document.getElementById("infoCapabilities");
  if (capEl) {
    capEl.innerHTML = `<span class="info-tags">${model.tags
      .map((t) => `<span>${t}</span>`)
      .join("")}</span>`;
  }
}

function updateUsageDisplay() {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("usageInput", sessionInputTokens.toLocaleString());
  set("usageOutput", sessionOutputTokens.toLocaleString());
  set("usageCost", `€${sessionCost.toFixed(4)}`);
  set("usageTime", lastResponseMs !== null ? `${lastResponseMs} ms` : "—");
}

function renderMessages() {
  if (!chatMessages) return;

  if (!messages.length) {
    chatMessages.innerHTML = '<p class="chat-empty">Start a conversation by entering a prompt below.</p>';
    return;
  }

  chatMessages.innerHTML = messages
    .map(
      (msg) => `
        <div class="chat-bubble ${msg.role}">
          <span class="chat-bubble-role">${msg.role === "user" ? "User" : "Assistant"}</span>
          ${window.ZwimaFormat.escapeHtml(msg.content).replace(/\n/g, "<br>")}
        </div>
      `
    )
    .join("");

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function generateResponse(prompt) {
  const provider = getSelectedProvider();
  const model = getSelectedModel();
  const template = RESPONSE_TEMPLATES[provider.id] || RESPONSE_TEMPLATES.openai;
  return template(prompt, model.name);
}

function calculateCost(inputTokens, outputTokens, model) {
  const inputRate = parsePrice(model.inputPrice) / 1_000_000;
  const outputRate = parsePrice(model.outputPrice) / 1_000_000;
  return inputTokens * inputRate + outputTokens * outputRate;
}

function getPlaygroundMode() {
  const select = document.getElementById("playgroundModeSelect");
  const stored = window.ZwimaStorage?.getRaw("PLAYGROUND_MODE");
  const mode = select?.value || stored || "mock";
  return mode === "real" ? "real" : "mock";
}

function initPlaygroundMode() {
  const select = document.getElementById("playgroundModeSelect");
  if (!select) return;
  const stored = window.ZwimaStorage?.getRaw("PLAYGROUND_MODE") || "mock";
  select.value = stored === "real" ? "real" : "mock";
  select.addEventListener("change", () => {
    window.ZwimaStorage.setRaw("PLAYGROUND_MODE", select.value);
  });
}

function mapModelForGateway(model) {
  const name = model?.name || model;
  const map = {
    "GPT-5": "gpt-4o",
    "GPT-4.1": "gpt-4-turbo",
    "GPT-4o": "gpt-4o",
  };
  return map[name] || name;
}

function sendMessage() {
  const prompt = promptInput?.value.trim();
  if (!prompt) return;

  const model = getSelectedModel();
  const provider = getSelectedProvider();
  const systemPrompt = systemPromptInput?.value.trim() || "";

  messages.push({ role: "user", content: prompt });
  if (promptInput) promptInput.value = "";
  renderMessages();

  runGatewayChat(prompt, provider, model, systemPrompt);
}

async function runGatewayChat(prompt, provider, model, systemPrompt) {
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    const mode = getPlaygroundMode();
    const result = await window.ZwimaGatewayService.chat({
      providerId: provider.id === "glm" ? "qwen" : provider.id,
      mode,
      prompt,
      messages: messages.filter((m) => m.role === "user" || m.role === "assistant"),
      model: provider.id === "openai" ? mapModelForGateway(model) : model.name,
      temperature: Number(temperatureRange?.value || 0.7),
      maxTokens: Number(document.getElementById("maxTokensInput")?.value || 2048),
      system: systemPrompt || undefined,
    });

    messages.push({ role: "assistant", content: result.content });
    sessionInputTokens += result.usage.promptTokens ?? result.usage.inputTokens;
    sessionOutputTokens += result.usage.completionTokens ?? result.usage.outputTokens;
    sessionCost += result.usage.estimatedCost;
    lastResponseMs = result.latency;
  } catch (err) {
    const fallback = generateResponse(prompt);
    const inputTokens = estimateTokens(systemPrompt) + estimateTokens(prompt);
    const outputTokens = estimateTokens(fallback);
    messages.push({ role: "assistant", content: fallback });
    sessionInputTokens += inputTokens;
    sessionOutputTokens += outputTokens;
    sessionCost += calculateCost(inputTokens, outputTokens, model);
    lastResponseMs = 420;
  }

  if (sendBtn) sendBtn.disabled = false;
  renderMessages();
  updateUsageDisplay();
  saveToHistory(prompt);
}

function saveToHistory(firstPrompt) {
  const provider = getSelectedProvider();
  const model = getSelectedModel();
  let history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);

  history.unshift({
    id: Date.now(),
    title: truncate(firstPrompt, 48),
    provider: provider.name,
    model: model.name,
    messages: [...messages],
    timestamp: new Date().toISOString(),
  });

  history = history.slice(0, 5);
  window.ZwimaStorage.set("PLAYGROUND_HISTORY", history);
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;

  const history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);

  if (!history.length) {
    historyList.innerHTML = '<li class="history-item-meta">No recent conversations.</li>';
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) => `
        <li>
          <button class="history-item" type="button" data-history-id="${item.id}">
            <span class="history-item-title">${window.ZwimaFormat.escapeHtml(item.title)}</span>
            <span class="history-item-meta">${window.ZwimaFormat.escapeHtml(item.provider)} · ${window.ZwimaFormat.escapeHtml(item.model)}</span>
          </button>
        </li>
      `
    )
    .join("");
}

function loadHistoryItem(id) {
  const history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);
  const item = history.find((h) => h.id === Number(id));
  if (!item) return;

  messages = [...item.messages];
  sessionInputTokens = 0;
  sessionOutputTokens = 0;
  sessionCost = 0;
  lastResponseMs = null;

  messages.forEach((msg, i) => {
    const tokens = estimateTokens(msg.content);
    if (msg.role === "user") sessionInputTokens += tokens;
    else sessionOutputTokens += tokens;
    if (i > 0 && msg.role === "assistant") {
      const model = getSelectedModel();
      sessionCost += calculateCost(estimateTokens(messages[i - 1]?.content || ""), tokens, model);
    }
  });

  renderMessages();
  updateUsageDisplay();
}

function clearConversation() {
  messages = [];
  sessionInputTokens = 0;
  sessionOutputTokens = 0;
  sessionCost = 0;
  lastResponseMs = null;
  renderMessages();
  updateUsageDisplay();
}

function getConversationMarkdown() {
  const provider = getSelectedProvider();
  const model = getSelectedModel();
  let md = `# ZWIMA AI Playground Conversation\n\n`;
  md += `**Provider:** ${provider.name}\n**Model:** ${model.name}\n\n---\n\n`;
  messages.forEach((msg) => {
    md += `### ${msg.role === "user" ? "User" : "Assistant"}\n\n${msg.content}\n\n`;
  });
  return md;
}

function getConversationJson() {
  return JSON.stringify(
    {
      provider: getSelectedProvider().name,
      model: getSelectedModel().name,
      messages,
      usage: {
        inputTokens: sessionInputTokens,
        outputTokens: sessionOutputTokens,
        estimatedCost: sessionCost,
        responseTimeMs: lastResponseMs,
      },
    },
    null,
    2
  );
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bindPlaygroundEvents() {
  providerSelect?.addEventListener("change", () => {
    populateModels(providerSelect.value);
    updateModelInfo();
  });

  modelSelect?.addEventListener("change", updateModelInfo);

  temperatureRange?.addEventListener("input", () => {
    if (temperatureValue) temperatureValue.textContent = temperatureRange.value;
  });

  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);

  promptInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("clearPromptBtn")?.addEventListener("click", () => {
    if (promptInput) promptInput.value = "";
  });

  document.getElementById("copyPromptBtn")?.addEventListener("click", async () => {
    const text = promptInput?.value || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
  });

  document.getElementById("clearConversationBtn")?.addEventListener("click", clearConversation);

  document.getElementById("exportMarkdownBtn")?.addEventListener("click", () => {
    if (!messages.length) return;
    downloadFile("zwima-playground-chat.md", getConversationMarkdown(), "text/markdown");
  });

  document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    if (!messages.length) return;
    downloadFile("zwima-playground-chat.json", getConversationJson(), "application/json");
  });

  document.getElementById("copyConversationBtn")?.addEventListener("click", async () => {
    if (!messages.length) return;
    await navigator.clipboard.writeText(getConversationMarkdown());
  });

  historyList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-id]");
    if (!button) return;
    loadHistoryItem(button.dataset.historyId);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const svc = window.ZwimaProviderService;
  [providersMap, providerList] = await Promise.all([svc.getProviderMap(), svc.getProviderList()]);

  populateProviders();
  populateModels(providerSelect?.value || "openai");
  applyUrlParams();
  initPlaygroundMode();
  updateModelInfo();
  renderMessages();
  renderHistory();
  updateUsageDisplay();
  bindPlaygroundEvents();
});
