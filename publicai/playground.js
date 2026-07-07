let messages = [];
let currentConversationId = null;
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
const providerStatusNote = document.getElementById("providerStatusNote");

function escapeHtml(text) {
  return window.ZwimaFormat?.escapeHtml?.(text) ?? String(text);
}

function truncate(text, len) {
  const value = String(text || "");
  return value.length <= len ? value : `${value.slice(0, len)}…`;
}

function isLiveProvider(providerId) {
  if (providerId === "openai" || providerId === "google" || providerId === "deepseek") {
    return true;
  }
  return Boolean(window.ZwimaProviders?.ProviderManager?.get(providerId)?.enabled);
}

function updateProviderStatusNote() {
  if (!providerStatusNote) return;
  const providerId = getSelectedProviderId();
  const providerName =
    window.ZwimaPlaygroundService.getProviders()[providerId]?.name || providerId;

  if (isLiveProvider(providerId)) {
    providerStatusNote.textContent = `Live API mode — ${providerName} provider.`;
    return;
  }

  providerStatusNote.textContent = `Preview mode — ${providerName} responses are simulated locally until integration is enabled.`;
}

function getSelectedProviderId() {
  return providerSelect?.value || "openai";
}

function getSelectedModelId() {
  return modelSelect?.value || window.ZwimaPlaygroundService.getModels(getSelectedProviderId())[0]?.id;
}

function getSelectedModel() {
  return window.ZwimaPlaygroundService.getModel(getSelectedProviderId(), getSelectedModelId());
}

function getSelectedModelLabel() {
  return getSelectedModel()?.displayName || getSelectedModelId();
}

function getChatPayload(prompt) {
  const model = getSelectedModel();
  return {
    prompt,
    model: model?.id || getSelectedModelId(),
    temperature: Number(temperatureRange?.value || 0.7),
    topP: Number(document.getElementById("topPInput")?.value || 1),
    maxTokens: Number(document.getElementById("maxTokensInput")?.value || 2048),
    frequencyPenalty: Number(document.getElementById("frequencyPenaltyInput")?.value || 0),
    presencePenalty: Number(document.getElementById("presencePenaltyInput")?.value || 0),
    jsonMode: Boolean(document.getElementById("jsonModeToggle")?.checked),
    instructions: String(document.getElementById("systemPromptInput")?.value || ""),
    stream: Boolean(document.getElementById("streamingToggle")?.checked),
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
    .map(
      (model) =>
        `<option value="${escapeHtml(model.id)}">${escapeHtml(model.displayName)}</option>`
    )
    .join("");
}

function renderModelList() {
  if (!modelList) return;
  const activeProvider = getSelectedProviderId();
  const activeModelId = getSelectedModelId();

  modelList.innerHTML = window.ZwimaPlaygroundService.getAllModelEntries()
    .map((entry) => {
      const isActive = entry.providerId === activeProvider && entry.modelId === activeModelId;
      return `
        <li>
          <button
            class="model-list-item${isActive ? " active" : ""}"
            type="button"
            data-provider="${escapeHtml(entry.providerId)}"
            data-model="${escapeHtml(entry.modelId)}"
          >
            <span class="model-list-name">${escapeHtml(entry.displayName)}</span>
            <span class="model-list-provider">${escapeHtml(entry.providerName)}</span>
          </button>
        </li>
      `;
    })
    .join("");
}

function selectModel(providerId, modelId) {
  if (providerSelect) providerSelect.value = providerId;
  populateModels(providerId);
  if (modelSelect) modelSelect.value = modelId;
  renderModelList();
  updateProviderStatusNote();
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
      (model) =>
        model.id === modelSlug ||
        window.ZwimaFormat?.slugify?.(model.displayName) === modelSlug.toLowerCase()
    );
    if (match) modelSelect.value = match.id;
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

function scrollChatToBottom() {
  if (!document.getElementById("autoScrollToggle")?.checked) return;
  if (!chatMessages) return;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderUserContent(content) {
  return `<span class="chat-bubble-body">${escapeHtml(content).replace(/\n/g, "<br>")}</span>`;
}

function renderAssistantContent(content, streaming) {
  if (streaming && !String(content || "").trim()) {
    return `<span class="chat-bubble-body"><span class="typing-indicator" aria-label="Generating"><span></span><span></span><span></span></span></span>`;
  }

  const markdown = window.ZwimaMarkdown?.render?.(content) || escapeHtml(content).replace(/\n/g, "<br>");
  const cursor = streaming ? '<span class="stream-cursor" aria-hidden="true"></span>' : "";
  return `<span class="chat-bubble-body chat-markdown">${markdown}${cursor}</span>`;
}

function formatMessageBody(msg) {
  const body = msg.role === "user" ? renderUserContent(msg.content) : renderAssistantContent(msg.content, Boolean(msg.streaming));
  if (msg.role !== "assistant") return body;
  const badges = [];
  if (msg.provider) badges.push(`<span class="chat-meta-badge">${escapeHtml(msg.provider)}</span>`);
  if (msg.model) badges.push(`<span class="chat-meta-badge">${escapeHtml(msg.model)}</span>`);
  if (msg.durationMs != null) badges.push(`<span class="chat-meta-badge">${Number(msg.durationMs)} ms</span>`);
  if (msg.status) badges.push(`<span class="chat-meta-badge ${msg.status === "error" ? "error" : ""}">${escapeHtml(msg.status)}</span>`);
  const meta = badges.length ? `<div class="chat-meta-row">${badges.join("")}</div>` : "";
  return `${body}${meta}`;
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
          ${formatMessageBody(msg)}
        </div>
      `;
    })
    .join("");

  scrollChatToBottom();
}

function updateStreamingBubble(content) {
  if (streamingMessageIndex < 0) return;
  messages[streamingMessageIndex].content = content;
  const bubble = document.getElementById("streaming-bubble");
  if (bubble) {
    bubble.innerHTML = `<span class="chat-bubble-role">Assistant</span>${renderAssistantContent(content, true)}`;
  }
  scrollChatToBottom();
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

function decorateAssistantMessage(index, result, status) {
  if (index < 0 || !messages[index]) return;
  messages[index].provider = result?.provider || getSelectedProviderId();
  messages[index].model = result?.model || getSelectedModelLabel();
  messages[index].durationMs = Number(result?.latencyMs) || null;
  messages[index].status = status || "ok";
}

function saveToHistory(firstPrompt) {
  const provider = window.ZwimaPlaygroundService.getProviders()[getSelectedProviderId()];
  const payload = {
    id: currentConversationId,
    title: truncate(firstPrompt, 48),
    provider: provider?.name || getSelectedProviderId(),
    model: getSelectedModelLabel(),
    messages: [...messages],
  };

  const savePromise = window.ZwimaConversationService?.saveConversation?.(payload);
  if (savePromise?.then) {
    savePromise
      .then((conversation) => {
        if (conversation?.id) currentConversationId = conversation.id;
        renderHistory();
      })
      .catch((err) => console.warn("[Playground history]", err));
    return;
  }

  let history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);
  history.unshift({
    id: Date.now(),
    ...payload,
    timestamp: new Date().toISOString(),
  });
  window.ZwimaStorage.set("PLAYGROUND_HISTORY", history.slice(0, 5));
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  const renderRows = (history) => {
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
  };

  const historyPromise = window.ZwimaConversationService?.getHistory?.();
  if (historyPromise?.then) {
    historyPromise
      .then((rows) => {
        const search = String(document.getElementById("conversationSearchInput")?.value || "").toLowerCase();
        if (!search) return renderRows(rows);
        return renderRows((rows || []).filter((row) => String(row.title || "").toLowerCase().includes(search)));
      })
      .catch(() => renderRows([]));
    return;
  }

  renderRows(window.ZwimaStorage.get("PLAYGROUND_HISTORY", []));
}

function loadHistoryItem(id) {
  const applyItem = (item) => {
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
    currentConversationId = item.id || null;
  };

  const itemPromise = window.ZwimaConversationService?.findById?.(id);
  if (itemPromise?.then) {
    itemPromise.then(applyItem);
    return;
  }

  const item = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []).find((row) => row.id === Number(id));
  applyItem(item);
}

function clearConversation() {
  if (isGenerating) stopGeneration();
  messages = [];
  currentConversationId = null;
  sessionInputTokens = 0;
  sessionOutputTokens = 0;
  lastResponseMs = null;
  streamingMessageIndex = -1;
  renderMessages();
  updateUsageDisplay();
}

function mapProviderResult(providerId, data, started) {
  const providerName =
    window.ZwimaPlaygroundService.getProviders()[providerId]?.name || data.provider || providerId;
  return {
    content: data.content,
    provider: providerName,
    model: data.model || getSelectedModelLabel(),
    usage: {
      inputTokens: Number(data.usage?.inputTokens) || 0,
      outputTokens: Number(data.usage?.outputTokens) || 0,
      totalTokens: Number(data.usage?.totalTokens) || 0,
    },
    latencyMs: Number(data.latencyMs) || Date.now() - started,
    source: providerId,
  };
}

function mapApiResult(data, started) {
  return mapProviderResult("openai", { ...data, provider: "openai" }, started);
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

  if (buffer.trim()) {
    parseSseEvents(`${buffer}\n\n`, (eventName, event) => {
      const type = event.type || eventName;
      if (type === "response.output_text.delta" && event.delta) {
        fullText += event.delta;
        onDelta(fullText);
      }
      if (type === "response.completed" && event.response) {
        usage = event.response.usage;
        model = event.response.model;
      }
    });
  }

  if (!fullText.trim()) {
    throw new Error("OpenAI stream returned empty content");
  }

  const inputTokens = Number(usage?.input_tokens) || 0;
  const outputTokens = Number(usage?.output_tokens) || 0;

  return {
    content: fullText.trim(),
    model: model || getSelectedModelId(),
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

function extractGeminiStreamText(event) {
  const candidates = event?.candidates;
  if (!Array.isArray(candidates) || !candidates.length) return "";
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part) => part.text)
    .map((part) => part.text)
    .join("");
}

async function consumeGeminiStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }

      if (event.error) {
        throw new Error(event.error.message || "Gemini stream error");
      }

      const delta = extractGeminiStreamText(event);
      if (delta) {
        fullText += delta;
        onDelta(fullText);
      }

      if (event.usageMetadata) {
        usage = event.usageMetadata;
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      const raw = trimmed.slice(5).trim();
      if (raw && raw !== "[DONE]") {
        try {
          const event = JSON.parse(raw);
          const delta = extractGeminiStreamText(event);
          if (delta) {
            fullText += delta;
            onDelta(fullText);
          }
          if (event.usageMetadata) usage = event.usageMetadata;
        } catch {
          // ignore trailing partial chunk
        }
      }
    }
  }

  if (!fullText.trim()) {
    throw new Error("Gemini stream returned empty content");
  }

  const inputTokens = Number(usage?.promptTokenCount) || 0;
  const outputTokens = Number(usage?.candidatesTokenCount) || 0;

  return {
    content: fullText.trim(),
    model: getSelectedModelId(),
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: Number(usage?.totalTokenCount) || inputTokens + outputTokens,
    },
  };
}

async function runGeminiChat(prompt) {
  const started = Date.now();
  const response = await fetch("/api/gemini-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getChatPayload(prompt)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[Playground Gemini Error]", {
      status: response.status,
      error: data.error,
      details: data.details,
    });
    throw new Error(data.error || "Gemini request failed");
  }

  return mapProviderResult(
    "google",
    {
      content: data.content,
      model: data.model,
      usage: data.usage,
      latencyMs: data.latencyMs,
      provider: "google",
    },
    started
  );
}

async function runGeminiChatStream(prompt, onDelta, signal) {
  const started = Date.now();
  const response = await fetch("/api/gemini-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getChatPayload(prompt), stream: true }),
    signal,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    console.error("[Playground Gemini Stream Error]", {
      status: response.status,
      error: data.error,
      details: data.details,
    });
    throw new Error(data.error || "Gemini stream failed");
  }

  const result = await consumeGeminiStream(response, onDelta);
  return mapProviderResult(
    "google",
    {
      content: result.content,
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      provider: "google",
    },
    started
  );
}

async function runGeminiChatWithFallback(prompt, onDelta, signal) {
  try {
    return await runGeminiChatStream(prompt, onDelta, signal);
  } catch (streamErr) {
    if (signal.aborted) throw streamErr;
    console.warn("[Playground] Gemini stream failed, falling back to non-stream:", streamErr);
    removeStreamingAssistant();
    return runGeminiChat(prompt);
  }
}

async function consumeChatCompletionsStream(response, onDelta) {
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
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }

      if (event.error) {
        throw new Error(event.error.message || "Chat completion stream error");
      }

      const delta = event.choices?.[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        onDelta(fullText);
      }

      if (event.usage) usage = event.usage;
      if (event.model) model = event.model;
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      const raw = trimmed.slice(5).trim();
      if (raw && raw !== "[DONE]") {
        try {
          const event = JSON.parse(raw);
          const delta = event.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            onDelta(fullText);
          }
          if (event.usage) usage = event.usage;
          if (event.model) model = event.model;
        } catch {
          // ignore trailing partial chunk
        }
      }
    }
  }

  if (!fullText.trim()) {
    throw new Error("Chat completion stream returned empty content");
  }

  const inputTokens = Number(usage?.prompt_tokens) || 0;
  const outputTokens = Number(usage?.completion_tokens) || 0;

  return {
    content: fullText.trim(),
    model: model || getSelectedModelId(),
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: Number(usage?.total_tokens) || inputTokens + outputTokens,
    },
  };
}

async function runDeepSeekChat(prompt) {
  const started = Date.now();
  const response = await fetch("/api/deepseek-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getChatPayload(prompt)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[Playground DeepSeek Error]", {
      status: response.status,
      error: data.error,
      details: data.details,
    });
    throw new Error(data.error || "DeepSeek request failed");
  }

  return mapProviderResult(
    "deepseek",
    {
      content: data.content,
      model: data.model,
      usage: data.usage,
      latencyMs: data.latencyMs,
      provider: "deepseek",
    },
    started
  );
}

async function runDeepSeekChatStream(prompt, onDelta, signal) {
  const started = Date.now();
  const response = await fetch("/api/deepseek-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getChatPayload(prompt), stream: true }),
    signal,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    console.error("[Playground DeepSeek Stream Error]", {
      status: response.status,
      error: data.error,
      details: data.details,
    });
    throw new Error(data.error || "DeepSeek stream failed");
  }

  const result = await consumeChatCompletionsStream(response, onDelta);
  return mapProviderResult(
    "deepseek",
    {
      content: result.content,
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      provider: "deepseek",
    },
    started
  );
}

async function runDeepSeekChatWithFallback(prompt, onDelta, signal) {
  try {
    return await runDeepSeekChatStream(prompt, onDelta, signal);
  } catch (streamErr) {
    if (signal.aborted) throw streamErr;
    console.warn("[Playground] DeepSeek stream failed, falling back to non-stream:", streamErr);
    removeStreamingAssistant();
    return runDeepSeekChat(prompt);
  }
}

async function runProviderChat(prompt, providerId, onDelta, signal) {
  const started = Date.now();
  const result = await window.ZwimaProviders.ProviderManager.chat(providerId, {
    ...getChatPayload(prompt),
    signal,
  });
  if (onDelta && result.content) onDelta(result.content);
  return mapProviderResult(providerId, result, started);
}

async function runChatRequest(prompt, onDelta, signal) {
  const providerId = getSelectedProviderId();
  const temperature = Number(temperatureRange?.value || 0.7);
  const maxTokens = Number(document.getElementById("maxTokensInput")?.value || 2048);

  const streamingEnabled = Boolean(document.getElementById("streamingToggle")?.checked);
  if (providerId === "openai") {
    if (!streamingEnabled) return runOpenAIChat(prompt);
    return runOpenAIChatWithFallback(prompt, onDelta, signal);
  }

  if (providerId === "google") {
    if (!streamingEnabled) return runGeminiChat(prompt);
    return runGeminiChatWithFallback(prompt, onDelta, signal);
  }

  if (providerId === "deepseek") {
    if (!streamingEnabled) return runDeepSeekChat(prompt);
    return runDeepSeekChatWithFallback(prompt, onDelta, signal);
  }

  const adapter = window.ZwimaProviders?.ProviderManager?.get(providerId);
  if (adapter?.enabled) {
    return runProviderChat(prompt, providerId, onDelta, signal);
  }

  return window.ZwimaPlaygroundService.runMock({
    providerId,
    model: getSelectedModelId(),
    prompt,
    temperature,
    maxTokens,
  });
}

async function recordSuccessfulRequest(prompt, result) {
  const inputTokens = result.usage.inputTokens;
  const outputTokens = result.usage.outputTokens;
  const totalTokens = result.usage.totalTokens || inputTokens + outputTokens;
  const providerId = getSelectedProviderId();
  const modelId = getSelectedModelId();
  const estimatedCost =
    window.ZwimaProviders?.ProviderManager?.calculateCost?.(
      providerId,
      inputTokens,
      outputTokens,
      modelId
    ) ?? window.ZwimaUsageService?.estimateCost?.(totalTokens) ?? 0;
  const providerName =
    window.ZwimaPlaygroundService.getProviders()[providerId]?.name || result.provider;

  const spendResult = window.ZwimaCreditsService?.spend?.(
    totalTokens,
    `Playground: ${providerName} · ${getSelectedModelLabel()}`
  );
  if (spendResult?.then) await spendResult;

  const remainingCredits = window.ZwimaCreditsService?.getWallet?.()?.balance ?? 0;
  const usageResult = window.ZwimaUsageService?.addRecord?.({
    provider: providerName,
    model: getSelectedModelLabel(),
    prompt,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    remainingCredits,
    status: "Success",
  });
  if (usageResult?.then) await usageResult;

  saveToHistory(prompt);
  window.ZwimaAppEvents?.emit?.("data-updated", {
    source: "playground",
    credits: true,
    usage: true,
  });
}

function stopGeneration() {
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
  if (streamingMessageIndex >= 0 && messages[streamingMessageIndex]) {
    delete messages[streamingMessageIndex].streaming;
    streamingMessageIndex = -1;
    renderMessages();
  }
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
  const useRealChat = isLiveProvider(providerId);
  if (useRealChat) beginStreamingAssistant();

  try {
    const result = await runChatRequest(
      prompt,
      (partial) => updateStreamingBubble(partial),
      streamAbortController.signal
    );

    if (streamAbortController?.signal.aborted) return;

    if (streamingMessageIndex >= 0) {
      messages[streamingMessageIndex].content = result.content;
      decorateAssistantMessage(streamingMessageIndex, result, "ok");
      finalizeStreamingAssistant();
    } else {
      messages.push({
        role: "assistant",
        content: result.content,
        provider: result.provider,
        model: result.model,
        durationMs: result.latencyMs,
        status: "ok",
      });
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

    try {
      await window.ZwimaOnboardingService?.completeStep?.("first_api_call");
    } catch {}
  } catch (err) {
    if (streamAbortController?.signal.aborted) return;
    console.error("[Playground Send Error]", err);
    removeStreamingAssistant();
    messages.push({
      role: "assistant",
      content: err.message || "Request failed.",
      provider: getSelectedProviderId(),
      model: getSelectedModelLabel(),
      durationMs: null,
      status: "error",
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
    updateProviderStatusNote();
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
  document.getElementById("conversationSearchInput")?.addEventListener("input", renderHistory);
  document.getElementById("savePromptBtn")?.addEventListener("click", () => {
    const prompt = String(document.getElementById("promptInput")?.value || "").trim();
    if (!prompt) return;
    window.ZwimaStorage?.set("PLAYGROUND_SAVED_PROMPT", prompt);
    alert("Prompt saved.");
  });
  document.getElementById("renameConversationBtn")?.addEventListener("click", async () => {
    if (!currentConversationId) return;
    const title = window.prompt("New conversation title:");
    if (!title) return;
    const item = await window.ZwimaConversationService?.findById?.(currentConversationId);
    if (!item) return;
    await window.ZwimaConversationService?.saveConversation?.({ ...item, title });
    renderHistory();
  });
  document.getElementById("deleteConversationBtn")?.addEventListener("click", async () => {
    if (!currentConversationId) return;
    const ok = window.confirm("Delete this conversation?");
    if (!ok) return;
    await window.ZwimaConversationService?.deleteConversation?.(currentConversationId);
    clearConversation();
    renderHistory();
  });
  document.getElementById("exportConversationBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ id: currentConversationId, messages }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${currentConversationId || "new"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  historyList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-id]");
    if (!button) return;
    loadHistoryItem(button.dataset.historyId);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const savedPrompt = window.ZwimaStorage?.get("PLAYGROUND_SAVED_PROMPT", "");
  if (savedPrompt && promptInput) promptInput.value = savedPrompt;
  populateProviders();
  populateModels(getSelectedProviderId());
  applyUrlParams();
  renderModelList();
  renderMessages();
  renderHistory();
  updateUsageDisplay();
  updateProviderStatusNote();
  bindEvents();
  window.ZwimaOnboardingService?.completeStep?.("playground_opened").catch(() => {});
});
