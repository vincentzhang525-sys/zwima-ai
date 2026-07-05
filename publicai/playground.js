let messages = [];
let sessionInputTokens = 0;
let sessionOutputTokens = 0;
let lastResponseMs = null;

const providerSelect = document.getElementById("providerSelect");
const modelSelect = document.getElementById("modelSelect");
const modelList = document.getElementById("modelList");
const temperatureRange = document.getElementById("temperatureRange");
const temperatureValue = document.getElementById("temperatureValue");
const chatMessages = document.getElementById("chatMessages");
const promptInput = document.getElementById("promptInput");
const historyList = document.getElementById("historyList");

function escapeHtml(text) {
  return window.ZwimaFormat?.escapeHtml?.(text) ?? String(text);
}

function truncate(text, len) {
  const value = String(text || "");
  return value.length <= len ? value : `${value.slice(0, len)}…`;
}

function getSelectedProviderId() {
  return providerSelect?.value || "openai";
}

function getSelectedModel() {
  return modelSelect?.value || window.ZwimaPlaygroundService.getModels(getSelectedProviderId())[0];
}

function populateProviders() {
  if (!providerSelect) return;
  providerSelect.innerHTML = window.ZwimaPlaygroundService.getProviderList()
    .map((provider) => `<option value="${provider.id}">${escapeHtml(provider.name)}</option>`)
    .join("");
}

function populateModels(providerId) {
  if (!modelSelect) return;
  const models = window.ZwimaPlaygroundService.getModels(providerId);
  modelSelect.innerHTML = models
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("");
}

function renderModelList() {
  if (!modelList) return;
  const activeProvider = getSelectedProviderId();
  const activeModel = getSelectedModel();

  modelList.innerHTML = window.ZwimaPlaygroundService.getAllModelEntries()
    .map((entry) => {
      const isActive = entry.providerId === activeProvider && entry.model === activeModel;
      return `
        <li>
          <button
            class="model-list-item${isActive ? " active" : ""}"
            type="button"
            data-provider="${escapeHtml(entry.providerId)}"
            data-model="${escapeHtml(entry.model)}"
          >
            <span class="model-list-name">${escapeHtml(entry.model)}</span>
            <span class="model-list-provider">${escapeHtml(entry.providerName)}</span>
          </button>
        </li>
      `;
    })
    .join("");
}

function selectModel(providerId, model) {
  if (providerSelect) providerSelect.value = providerId;
  populateModels(providerId);
  if (modelSelect) modelSelect.value = model;
  renderModelList();
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const providerId = params.get("provider");
  const modelSlug = params.get("model");
  const providers = window.ZwimaPlaygroundService.getProviders();

  if (providerId && providers[providerId]) {
    populateModels(providerId);
    providerSelect.value = providerId;
  }

  if (modelSlug && modelSelect) {
    const models = window.ZwimaPlaygroundService.getModels(getSelectedProviderId());
    const match = models.find(
      (name) => window.ZwimaFormat?.slugify?.(name) === modelSlug.toLowerCase()
    );
    if (match) modelSelect.value = match;
  }

  renderModelList();
}

function updateUsageDisplay() {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("usageInput", sessionInputTokens.toLocaleString());
  set("usageOutput", sessionOutputTokens.toLocaleString());
  set("usageTotal", (sessionInputTokens + sessionOutputTokens).toLocaleString());
  set("usageTime", lastResponseMs !== null ? `${lastResponseMs} ms` : "—");

  const wallet = window.ZwimaCreditsService?.getWallet?.();
  set("remainingCredits", wallet ? wallet.balance.toLocaleString() : "—");
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
          ${escapeHtml(msg.content).replace(/\n/g, "<br>")}
        </div>
      `
    )
    .join("");

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function saveToHistory(firstPrompt) {
  let history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);
  const provider = window.ZwimaPlaygroundService.getProviders()[getSelectedProviderId()];

  history.unshift({
    id: Date.now(),
    title: truncate(firstPrompt, 48),
    provider: provider?.name || getSelectedProviderId(),
    model: getSelectedModel(),
    messages: [...messages],
    timestamp: new Date().toISOString(),
  });

  window.ZwimaStorage.set("PLAYGROUND_HISTORY", history.slice(0, 5));
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
            <span class="history-item-title">${escapeHtml(item.title)}</span>
            <span class="history-item-meta">${escapeHtml(item.provider)} · ${escapeHtml(item.model)}</span>
          </button>
        </li>
      `
    )
    .join("");
}

function loadHistoryItem(id) {
  const item = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []).find((row) => row.id === Number(id));
  if (!item) return;

  messages = [...item.messages];
  sessionInputTokens = 0;
  sessionOutputTokens = 0;
  lastResponseMs = null;

  messages.forEach((msg) => {
    const tokens = Math.max(1, Math.ceil(msg.content.length / 4));
    if (msg.role === "user") sessionInputTokens += tokens;
    else sessionOutputTokens += tokens;
  });

  renderMessages();
  updateUsageDisplay();
}

function clearConversation() {
  messages = [];
  sessionInputTokens = 0;
  sessionOutputTokens = 0;
  lastResponseMs = null;
  renderMessages();
  updateUsageDisplay();
}

async function sendMessage() {
  const prompt = promptInput?.value.trim();
  if (!prompt) return;

  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.disabled = true;

  messages.push({ role: "user", content: prompt });
  if (promptInput) promptInput.value = "";
  renderMessages();

  try {
    const result = await window.ZwimaPlaygroundService.runMock({
      providerId: getSelectedProviderId(),
      model: getSelectedModel(),
      prompt,
      temperature: Number(temperatureRange?.value || 0.7),
      maxTokens: Number(document.getElementById("maxTokensInput")?.value || 2048),
    });

    messages.push({ role: "assistant", content: result.content });
    sessionInputTokens += result.usage.inputTokens;
    sessionOutputTokens += result.usage.outputTokens;
    lastResponseMs = result.latencyMs;
    saveToHistory(prompt);
  } catch (err) {
    messages.push({
      role: "assistant",
      content: err.message || "Mock request failed.",
    });
  }

  if (sendBtn) sendBtn.disabled = false;
  renderMessages();
  updateUsageDisplay();
}

function bindEvents() {
  providerSelect?.addEventListener("change", () => {
    populateModels(providerSelect.value);
    renderModelList();
  });

  modelSelect?.addEventListener("change", renderModelList);

  modelList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-provider]");
    if (!button) return;
    selectModel(button.dataset.provider, button.dataset.model);
  });

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

  document.getElementById("clearConversationBtn")?.addEventListener("click", clearConversation);

  historyList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-id]");
    if (!button) return;
    loadHistoryItem(button.dataset.historyId);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  populateProviders();
  populateModels(getSelectedProviderId());
  applyUrlParams();
  renderModelList();
  renderMessages();
  renderHistory();
  updateUsageDisplay();
  bindEvents();
});
