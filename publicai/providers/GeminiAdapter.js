(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.ZwimaProviders = root.ZwimaProviders || {};
    root.ZwimaProviders.GeminiAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProvider !== "undefined" ? ZwimaBaseProvider : require("./BaseProvider");
  const modelConfig = Base.getModelConfig();

  function listModels() {
    return modelConfig.getByProvider("google");
  }

  function calculateCost(inputTokens, outputTokens, modelId) {
    const model = modelConfig.getById(modelConfig.resolveId(modelId));
    if (!model) return 0;
    const input = Number(inputTokens) || 0;
    const output = Number(outputTokens) || 0;
    return Number(
      ((input * model.inputPrice + output * model.outputPrice) / 1_000_000).toFixed(6)
    );
  }

  async function chat(payload) {
    const modelId = modelConfig.resolveId(payload.model);
    const body = {
      prompt: payload.prompt,
      model: modelId,
      temperature: payload.temperature ?? 0.7,
      maxTokens: payload.maxTokens ?? 2048,
      messages: payload.messages,
      instructions: payload.instructions,
    };

    const response = await fetch("/api/gemini-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: payload.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || "Gemini request failed");
      err.details = data.details;
      throw err;
    }

    const usage = data.usage || {};
    const inputTokens = Number(usage.inputTokens) || 0;
    const outputTokens = Number(usage.outputTokens) || 0;

    return {
      provider: "google",
      model: data.model || modelId,
      content: data.content,
      latencyMs: data.latencyMs,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: Number(usage.totalTokens) || inputTokens + outputTokens,
        estimatedCost: calculateCost(inputTokens, outputTokens, modelId),
      },
    };
  }

  return {
    id: "google",
    name: "Gemini",
    enabled: true,
    listModels,
    calculateCost,
    chat,
  };
});
