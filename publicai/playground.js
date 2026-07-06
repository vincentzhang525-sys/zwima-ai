let messages = [];
let sessionInputTokens = 0;
let sessionOutputTokens = 0;
let lastResponseMs = null;
let streamAbortController = null;
let streamingMessageIndex = -1;
let isGenerating = false;

const providerSelect = document.getElementById("providerSelect");
const modelSelect = document.getElementById("modelSelect");
const modelList = document.getElementById("modelList");
const temperatureRange = document.getElementById("temperatureRange");
const temperatureValue = document.getElementById("temperatureValue");
const chatMessages = document.getElementById("chatMessages");
const promptInput = document.getElementById("promptInput");
const historyList = document.getElementById("historyList");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");

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

function getChatPayload(prompt) {
  return {
    prompt,
    model: getSelectedModel(),
    temperature: Number(temperatureRange?.value || 0.7),
    maxTokens: Number(document.getElementById("maxTokensInput")?.value || 2048),
    messages: messages.map((item) => ({ role: item.role, content: item.content })),
  };
}

function setGeneratingState(active) {
  isGenerating = active;
  if (sendBtn) sendBtn.disabled = active;
  if (stopBtn) stopBtn.hidden = !active;
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

function formatMessageBody(content, streaming) {
  const html = escapeHtml(content).replace(/\n/g, "<br>");
  if (streaming) {
    return `<span class="chat-bubble-body">${html}<span class="stream-cursor" aria-hidden="true"></span></span>`;
  }
  return `<span class="chat-bubble-body">${html}</span>`;
}

function renderMessages() {
  if (!chatMessages) return;

  if (!messages.length) {
    chatMessages.innerHTML = '<p class="chat-empty">Start a conversation by entering a prompt below.</p>';
    return;
  }

  chatMessages.innerHTML = messages
    .map((msg, index) => {
      const streaming = Boolean(msg.streaming);
      const streamingClass = streaming ? " is-streaming" : "";
      const streamId = streaming ? ' id="streaming-bubble"' : "";
      return `
        <div class="chat-bubble ${msg.role}${streamingClass}"${streamId} data-index="${index}">
          <span class="chat-bubble-role">${msg.role === "user" ? "User" : "Assistant"}</span>
          ${formatMessageBody(msg.content, streaming)}
        </div>
      `;
    })
    .join("");

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateStreamingBubble(content) {
  if (streamingMessageIndex < 0) return;
  messages[streamingMessageIndex].content = content;
  const bubble = document.getElementById("streaming-bubble");
  const body = bubble?.querySelector(".chat-bubble-body");
  if (body) {
    body.innerHTML = `${escapeHtml(content).replace(/\n/g, "<br>")}<span class="stream-cursor" aria-hidden="true"></span>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function beginStreamingAssistant() {
  messages.push({ role: "assistant", content: "", streaming: true });
  streamingMessageIndex = messages.length - 1;
  renderMessages();
}

function finalizeStreamingAssistant() {
  if (streamingMessageIndex < 0) return;
  delete messages[streamingMessageIndex].streaming;
  streamingMessageIndex = -1;
  renderMessages();
}

function removeStreamingAssistant() {
  if (streamingMessageIndex < 0) return;
  messages.splice(streamingMessageIndex, 1);
  streamingMessageIndex = -1;
  renderMessages();
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
  if (isGenerating) stopGeneration();
  messages = [];
  sessionInputTokens = 0;
  sessionOutputTokens = 0;
  lastResponseMs = null;
  streamingMessageIndex = -1;
  renderMessages();
  updateUsageDisplay();
}

function mapApiResult(data, started) {
  return {
    content: data.content,
    provider: "OpenAI",
    model: data.model || getSelectedModel(),
    usage: {
      inputTokens: Number(data.usage?.inputTokens) || 0,
      outputTokens: Number(data.usage?.outputTokens) || 0,
      totalTokens: Number(data.usage?.totalTokens) || 0,
    },
    latencyMs: Number(data.latencyMs) || Date.now() - started,
    source: "openai",
  };
}

async function runOpenAIChat(prompt) {
  const started = Date.now();
  const response = await fetch("/api/openai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getChatPayload(prompt)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[Playground OpenAI Error]", {
      status: response.status,
      error: data.error,
      details: data.details,
    });
    throw new Error(data.error || "OpenAI request failed");
  }

  return mapApiResult(data, started);
}

function parseSseEvents(chunk, onEvent) {
  const lines = chunk.split("\n");
  let eventName = null;
  let dataLines = [];

  const flush = () => {
    if (!dataLines.length) {
      eventName = null;
      return;
    }
    const raw = dataLines.join("\n").trim();
    dataLines = [];
    if (!raw || raw === "[DONE]") {
      eventName = null;
      return;
    }
    try {
      onEvent(eventName, JSON.parse(raw));
    } catch {
      // ignore malformed chunks
    }
    eventName = null;
  };

  for (const line of lines) {
    if (line.startsWith("event:")) {
      flush();
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
      continue;
    }
    if (!line.trim()) {
      flush();
    }
  }
}

async function consumeOpenAIStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usage = null;
  let model = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      parseSseEvents(`${part}\n\n`, (eventName, event) => {
        const type = event.type || eventName;
        if (type === "response.output_text.delta" && event.delta) {
          fullText += event.delta;
          onDelta(fullText);
        }
        if (type === "response.completed" && event.response) {
          usage = event.response.usage;
          model = event.response.model;
          if (!fullText && typeof event.response.output_text === "string") {
            fullText = event.response.output_text;
            onDelta(fullText);
          }
        }
        if (event.error) {
          throw new Error(event.error.message || "OpenAI stream error");
        }
      });
    }
  }

  if (!fullText.trim()) {
    throw new Error("OpenAI stream returned empty content");
  }

  const inputTokens = Number(usage?.input_tokens) || 0;
  const outputTokens = Number(usage?.output_tokens) || 0;

  return {
    content: fullText.trim(),
    model: model || getSelectedModel(),
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: Number(usage?.total_tokens) || inputTokens + outputTokens,
    },
  };
}

async function runOpenAIChatStream(prompt, onDelta, signal) {
  const started = Date.now();
  const response = await fetch("/api/openai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getChatPayload(prompt), stream: true }),
    signal,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    console.error("[Playground OpenAI Stream Error]", {
      status: response.status,
      error: data.error,
      details: data.details,
    });
    throw new Error(data.error || "OpenAI stream failed");
  }

  const result = await consumeOpenAIStream(response, onDelta);
  return {
    ...mapApiResult(
      {
        content: result.content,
        model: result.model,
        usage: result.usage,
        latencyMs: Date.now() - started,
      },
      started
    ),
  };
}

async function runOpenAIChatWithFallback(prompt, onDelta, signal) {
  try {
    return await runOpenAIChatStream(prompt, onDelta, signal);
  } catch (streamErr) {
    if (signal.aborted) throw streamErr;
    console.warn("[Playground] Stream failed, falling back to non-stream:", streamErr);
    removeStreamingAssistant();
    return runOpenAIChat(prompt);
  }
}

async function runChatRequest(prompt, onDelta, signal) {
  const providerId = getSelectedProviderId();
  const model = getSelectedModel();
  const temperature = Number(temperatureRange?.value || 0.7);
  const maxTokens = Number(document.getElementById("maxTokensInput")?.value || 2048);

  if (providerId === "openai") {
    return runOpenAIChatWithFallback(prompt, onDelta, signal);
  }

  return window.ZwimaPlaygroundService.runMock({
    providerId,
    model,
    prompt,
    temperature,
    maxTokens,
  });
}

async function recordSuccessfulRequest(prompt, result) {
  const inputTokens = result.usage.inputTokens;
  const outputTokens = result.usage.outputTokens;
  const totalTokens = result.usage.totalTokens || inputTokens + outputTokens;
  const estimatedCost = window.ZwimaUsageService?.estimateCost?.(totalTokens) ?? 0;
  const providerName =
    window.ZwimaPlaygroundService.getProviders()[getSelectedProviderId()]?.name || result.provider;

  window.ZwimaCreditsService?.spend?.(
    totalTokens,
    `Playground: ${providerName} · ${getSelectedModel()}`
  );

  const remainingCredits = window.ZwimaCreditsService?.getWallet?.()?.balance ?? 0;
  window.ZwimaUsageService?.addRecord?.({
    provider: providerName,
    model: getSelectedModel(),
    prompt,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    remainingCredits,
    status: "Success",
  });

  saveToHistory(prompt);
}

function stopGeneration() {
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
  finalizeStreamingAssistant();
  setGeneratingState(false);
}

async function sendMessage() {
  const prompt = promptInput?.value.trim();
  if (!prompt || isGenerating) return;

  streamAbortController = new AbortController();
  setGeneratingState(true);

  messages.push({ role: "user", content: prompt });
  if (promptInput) promptInput.value = "";
  renderMessages();

  const providerId = getSelectedProviderId();
  const useStream = providerId === "openai";
  if (useStream) beginStreamingAssistant();

  try {
    const result = await runChatRequest(
      prompt,
      (partial) => updateStreamingBubble(partial),
      streamAbortController.signal
    );

    if (streamAbortController?.signal.aborted) return;

    if (streamingMessageIndex >= 0) {
      messages[streamingMessageIndex].content = result.content;
      finalizeStreamingAssistant();
    } else {
      messages.push({ role: "assistant", content: result.content });
    }

    sessionInputTokens += result.usage.inputTokens;
    sessionOutputTokens += result.usage.outputTokens;
    lastResponseMs = result.latencyMs;

    try {
      await recordSuccessfulRequest(prompt, result);
    } catch (creditErr) {
      messages.pop();
      messages.pop();
      messages.push({
        role: "assistant",
        content: creditErr.message || "Insufficient credits for this request.",
      });
      renderMessages();
      updateUsageDisplay();
      return;
    }

    renderMessages();
    updateUsageDisplay();
  } catch (err) {
    if (streamAbortController?.signal.aborted) return;
    console.error("[Playground Send Error]", err);
    removeStreamingAssistant();
    messages.push({
      role: "assistant",
      content: err.message || "OpenAI request failed.",
    });
    renderMessages();
  } finally {
    streamAbortController = null;
    setGeneratingState(false);
  }
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

  sendBtn?.addEventListener("click", sendMessage);
  stopBtn?.addEventListener("click", stopGeneration);

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
