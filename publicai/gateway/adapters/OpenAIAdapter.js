(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaOpenAIAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("../gatewayConfig");
  const Secrets = typeof ZwimaSecrets !== "undefined" ? ZwimaSecrets : require("../secrets");

  const SPEC = {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    mockLatency: [280, 360],
    inputPer1M: 2.5,
    outputPer1M: 10,
    models: [
      { id: "gpt-4o", name: "GPT-4o", context: "128K", inputPer1M: 2.5, outputPer1M: 10, capabilities: ["chat", "vision"] },
      { id: "gpt-4-turbo", name: "GPT-4.1", context: "128K", inputPer1M: 2, outputPer1M: 8, capabilities: ["chat"] },
      { id: "gpt-4o", name: "GPT-5", context: "128K", inputPer1M: 2.5, outputPer1M: 10, capabilities: ["chat", "vision"] },
    ],
  };

  const MODEL_MAP = {
    "gpt-5": "gpt-4o",
    "gpt-4.1": "gpt-4.1",
    "gpt-4o": "gpt-4o",
    "o1-mini": "o4-mini",
    "o4-mini": "o4-mini",
    "gpt-4-turbo": "gpt-4-turbo",
    "GPT-5": "gpt-4o",
    "GPT-4.1": "gpt-4.1",
    "GPT-4o": "gpt-4o",
  };

  const PRICING = {
    "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
    "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
    "o4-mini": { inputPer1M: 0.55, outputPer1M: 2.2 },
    "gpt-4-turbo": { inputPer1M: 2, outputPer1M: 8 },
    "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
  };

  const mockAdapter = Base.createProviderAdapter({
    ...SPEC,
    chatPath: "/chat/completions",
    embeddingsPath: "/embeddings",
    imagePath: "/images/generations",
    audioPath: "/audio/speech",
    healthPath: "/models",
  });

  function resolveApiModel(model) {
    const raw = String(model || "gpt-4o");
    return MODEL_MAP[raw] || MODEL_MAP[raw.toLowerCase()] || raw.toLowerCase();
  }

  function calcCost(promptTokens, completionTokens, apiModel) {
    const rates = PRICING[apiModel] || { inputPer1M: 2.5, outputPer1M: 10 };
    return Number(
      ((promptTokens * rates.inputPer1M) / 1_000_000 + (completionTokens * rates.outputPer1M) / 1_000_000).toFixed(6)
    );
  }

  function buildUsage(promptTokens, completionTokens, apiModel) {
    const totalTokens = promptTokens + completionTokens;
    return {
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: calcCost(promptTokens, completionTokens, apiModel),
    };
  }

  function parseMessages(messages, prompt, system) {
    const msgs = Array.isArray(messages) && messages.length
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: "user", content: String(prompt || "") }];
    if (system) return [{ role: "system", content: system }, ...msgs];
    return msgs;
  }

  async function openaiFetch(path, options, timeoutMs) {
    const apiKey = Secrets.getApiKey("openai");
    if (!apiKey) {
      const err = new Error("Missing OpenAI API key");
      err.code = 401;
      throw err;
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const start = Date.now();
    try {
      const res = await fetch(`${SPEC.baseUrl}${path}`, {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller?.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json?.error?.message || `OpenAI API error ${res.status}`);
        err.code = res.status;
        throw err;
      }
      return { json, latency: Date.now() - start };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function chatReal(payload) {
    const apiModel = resolveApiModel(payload.model);
    const messages = parseMessages(payload.messages, payload.prompt, payload.system);
    const timeout = GatewayConfig.getTimeout(GatewayConfig.getMode());
    const { json, latency } = await openaiFetch(
      "/chat/completions",
      {
        method: "POST",
        body: {
          model: apiModel,
          messages,
          temperature: payload.temperature ?? 0.7,
          max_tokens: payload.maxTokens ?? 2048,
        },
      },
      timeout
    );
    const content = json.choices?.[0]?.message?.content || "";
    const promptTokens = json.usage?.prompt_tokens || Base.estimateTokens(messages.map((m) => m.content).join(" "));
    const completionTokens = json.usage?.completion_tokens || Base.estimateTokens(content);
    return {
      provider: SPEC.name,
      model: apiModel,
      content,
      latency,
      mode: "real",
      usage: buildUsage(promptTokens, completionTokens, apiModel),
    };
  }

  async function chatMock(payload) {
    const result = await mockAdapter.chat(payload);
    return { ...result, mode: "mock", fallback: result.fallback || false };
  }

  function shouldUseReal(payload) {
    return GatewayConfig.resolveRequestMode(payload) === "real";
  }

  return {
    id: SPEC.id,
    name: SPEC.name,
    baseUrl: SPEC.baseUrl,

    listModels() {
      return mockAdapter.listModels();
    },

    async chat(payload) {
      if (!shouldUseReal(payload)) {
        return chatMock(payload);
      }
      try {
        return await chatReal(payload);
      } catch (err) {
        const mock = await chatMock(payload);
        return {
          ...mock,
          fallback: true,
          fallbackReason: err.message,
          requestedMode: "real",
        };
      }
    },

    embeddings(payload) {
      return mockAdapter.embeddings(payload);
    },

    image(payload) {
      return mockAdapter.image(payload);
    },

    audio(payload) {
      return mockAdapter.audio(payload);
    },

    async health() {
      if (!Secrets.hasOpenAIKey()) {
        if (GatewayConfig.isMockMode()) return mockAdapter.health();
        return {
          provider: SPEC.name,
          providerId: SPEC.id,
          status: "unconfigured",
          latency: 0,
          availability: 0,
          configured: false,
        };
      }
      const start = Date.now();
      try {
        const { latency } = await openaiFetch("/models", { method: "GET" }, 15000);
        return {
          provider: SPEC.name,
          providerId: SPEC.id,
          status: "healthy",
          latency,
          availability: 99.9,
          configured: true,
        };
      } catch {
        return {
          provider: SPEC.name,
          providerId: SPEC.id,
          status: "unhealthy",
          latency: Date.now() - start,
          availability: 0,
          configured: true,
        };
      }
    },
  };
});
