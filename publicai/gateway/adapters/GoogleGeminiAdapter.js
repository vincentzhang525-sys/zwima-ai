(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaGoogleGeminiAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("../gatewayConfig");
  const Secrets = typeof ZwimaSecrets !== "undefined" ? ZwimaSecrets : require("../secrets");
  const modelRegistry =
    typeof ZwimaModelRegistry !== "undefined" ? ZwimaModelRegistry : require("../../config/modelRegistry.js");

  const SPEC = {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    mockLatency: [240, 320],
    inputPer1M: 1.2,
    outputPer1M: 5,
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", context: "1M", inputPer1M: 1.2, outputPer1M: 5 },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context: "1M", inputPer1M: 0.6, outputPer1M: 2.5 },
    ],
    mockTemplate:
      "I can help you with that.\n\nGemini has summarized your request and produced a concise, practical response with multimodal-ready formatting.",
  };

  const mockAdapter = Base.createProviderAdapter({
    ...SPEC,
    chatPath: "/models/gemini-2.5-pro:generateContent",
    healthPath: "/models",
  });

  function getApiKey() {
    if (typeof process !== "undefined" && process.env) {
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    }
    return Secrets.getApiKey("google");
  }

  function resolveApiModel(model) {
    const raw = String(model || "gemini-2.5-flash");
    const id = modelRegistry.resolveId(raw);
    return modelRegistry.resolveApiId(id);
  }

  function buildContents(messages, prompt) {
    const items = Array.isArray(messages) && messages.length
      ? messages
      : [{ role: "user", content: String(prompt || "") }];
    return items
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: String(item.content || "") }],
      }));
  }

  async function chatReal(payload) {
    const apiKey = getApiKey();
    if (!apiKey) {
      const err = new Error("Missing Gemini API key");
      err.code = 401;
      throw err;
    }
    const apiModel = resolveApiModel(payload.model);
    const started = Date.now();
    const res = await fetch(
      `${SPEC.baseUrl}/models/${apiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: payload.system ? { parts: [{ text: String(payload.system) }] } : undefined,
          contents: buildContents(payload.messages, payload.prompt),
          generationConfig: {
            temperature: payload.temperature ?? 0.7,
            maxOutputTokens: payload.maxTokens ?? 2048,
          },
        }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json?.error?.message || `Gemini API error ${res.status}`);
      err.code = res.status;
      throw err;
    }
    const content = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    if (!content) throw new Error("Gemini returned empty output.");
    const inputTokens = Number(json?.usageMetadata?.promptTokenCount) || 0;
    const outputTokens = Number(json?.usageMetadata?.candidatesTokenCount) || 0;
    return {
      provider: SPEC.name,
      model: apiModel,
      content,
      latency: Date.now() - started,
      mode: "real",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: Number(json?.usageMetadata?.totalTokenCount) || inputTokens + outputTokens,
      },
    };
  }

  function shouldUseReal() {
    if (typeof process !== "undefined" && process.env && getApiKey()) return true;
    return GatewayConfig.resolveRequestMode({}) === "real" && !!getApiKey();
  }

  return {
    id: SPEC.id,
    name: SPEC.name,
    baseUrl: SPEC.baseUrl,
    listModels: () => mockAdapter.listModels(),
    async chat(payload) {
      if (!shouldUseReal()) return mockAdapter.chat(payload);
      try {
        return await chatReal(payload);
      } catch (err) {
        const mock = await mockAdapter.chat(payload);
        return { ...mock, fallback: true, fallbackReason: err.message };
      }
    },
    embeddings: (payload) => mockAdapter.embeddings(payload),
    image: (payload) => mockAdapter.image(payload),
    audio: (payload) => mockAdapter.audio(payload),
    async health() {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { provider: SPEC.name, providerId: SPEC.id, status: "unconfigured", latency: 0, availability: 0, configured: false };
      }
      const start = Date.now();
      try {
        const res = await fetch(`${SPEC.baseUrl}/models?key=${encodeURIComponent(apiKey)}`);
        return {
          provider: SPEC.name,
          providerId: SPEC.id,
          status: res.ok ? "healthy" : "unhealthy",
          latency: Date.now() - start,
          availability: res.ok ? 99.9 : 0,
          configured: true,
          code: res.status,
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
