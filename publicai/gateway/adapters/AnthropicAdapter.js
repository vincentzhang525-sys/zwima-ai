(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAnthropicAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("../gatewayConfig");

  const base = Base.createProviderAdapter({
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    chatPath: "/messages",
    healthPath: "/models",
    headers: { "anthropic-version": "2023-06-01" },
    mockLatency: [300, 380],
    inputPer1M: 3,
    outputPer1M: 15,
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", context: "200K", inputPer1M: 3, outputPer1M: 15 },
      { id: "claude-3-5-haiku-20241022", name: "Claude Haiku 3.5", context: "200K", inputPer1M: 0.8, outputPer1M: 4 },
    ],
    mockTemplate:
      "Certainly. Let's think through this carefully.\n\nRegarding your request, Claude provides a methodical, balanced answer optimized for enterprise writing and reasoning workloads.",
  });

  async function chatReal({ prompt, messages, model, temperature, maxTokens, system }) {
    const apiKey = GatewayConfig.getApiKey("anthropic");
    if (!apiKey) {
      const err = new Error("Missing API key for Anthropic");
      err.code = 401;
      throw err;
    }
    const msgs = Array.isArray(messages) && messages.length
      ? messages.filter((m) => m.role === "user" || m.role === "assistant")
      : [{ role: "user", content: String(prompt || "") }];
    const modelId = model || "claude-sonnet-4-20250514";
    const timeout = GatewayConfig.getTimeout(GatewayConfig.getMode());
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    const start = Date.now();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: maxTokens ?? 2048,
          temperature: temperature ?? 0.7,
          system: system || undefined,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller?.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json?.error?.message || `Anthropic API error ${res.status}`);
        err.code = res.status;
        throw err;
      }
      const content = (json.content || []).map((b) => b.text || "").join("\n");
      const inTok = json.usage?.input_tokens || 0;
      const outTok = json.usage?.output_tokens || 0;
      return {
        provider: "Anthropic",
        model: modelId,
        content,
        latency: Date.now() - start,
        usage: {
          inputTokens: inTok,
          outputTokens: outTok,
          totalTokens: inTok + outTok,
          estimatedCost: Base.calcCost(inTok, outTok, { inputPer1M: 3, outputPer1M: 15 }, modelId),
        },
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    ...base,
    async chat(input) {
      if (GatewayConfig.isMockMode()) return base.chat(input);
      return chatReal(input);
    },
    async health() {
      if (GatewayConfig.isMockMode()) return base.health();
      const apiKey = GatewayConfig.getApiKey("anthropic");
      if (!apiKey) return { provider: "Anthropic", status: "unconfigured", latency: 0, availability: 0 };
      const start = Date.now();
      try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        });
        return {
          provider: "Anthropic",
          status: res.ok ? "healthy" : "unhealthy",
          latency: Date.now() - start,
          availability: res.ok ? 99.9 : 0,
        };
      } catch {
        return { provider: "Anthropic", status: "unhealthy", latency: Date.now() - start, availability: 0 };
      }
    },
  };
});
