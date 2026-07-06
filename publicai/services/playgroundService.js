(function () {
  const RESPONSE_TEMPLATES = {
    openai: (prompt, model) =>
      `[Mock · ${model.displayName}] Here is a detailed response to: "${truncate(prompt, 80)}"\n\nI've analyzed your request and structured a step-by-step answer with actionable recommendations.`,
    anthropic: (prompt, model) =>
      `[Mock · ${model.displayName}] Let's think through this carefully.\n\nRegarding "${truncate(prompt, 80)}", here is a balanced, methodical answer tailored to your use case.`,
    mistral: (prompt, model) =>
      `[Mock · ${model.displayName}] Enterprise response for "${truncate(prompt, 80)}" — optimized for European compliance and coding workloads.`,
  };

  function truncate(text, len) {
    const value = String(text || "");
    return value.length <= len ? value : `${value.slice(0, len)}…`;
  }

  function estimateTokens(text) {
    return Math.max(1, Math.ceil(String(text || "").length / 4));
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function config() {
    return window.ZwimaModelConfig;
  }

  function buildProviders() {
    const providers = {};
    config().getProviderIds().forEach((providerId) => {
      providers[providerId] = {
        id: providerId,
        name: config().getProviderName(providerId),
        models: config().getByProvider(providerId),
      };
    });
    return providers;
  }

  function resolveModel(providerId, modelRef) {
    const models = config().getByProvider(providerId);
    const id = config().resolveId(modelRef);
    return config().getById(id) || models[0] || config().getById("gpt-4o");
  }

  window.ZwimaPlaygroundService = {
    getProviders() {
      return buildProviders();
    },

    getProviderList() {
      return config().getProviderIds().map((providerId) => ({
        id: providerId,
        name: config().getProviderName(providerId),
      }));
    },

    getModels(providerId) {
      return config().getByProvider(providerId);
    },

    getAllModelEntries() {
      return config().getAll().map((model) => ({
        providerId: model.provider,
        providerName: config().getProviderName(model.provider),
        modelId: model.id,
        displayName: model.displayName,
      }));
    },

    getModel(providerId, modelRef) {
      return resolveModel(providerId, modelRef);
    },

    async runMock({ providerId, model, prompt, temperature, maxTokens }) {
      const trimmed = String(prompt || "").trim();
      if (!trimmed) throw new Error("Prompt is required.");

      const modelMeta = resolveModel(providerId, model);
      const providerName = config().getProviderName(modelMeta.provider);
      const template = RESPONSE_TEMPLATES[modelMeta.provider] || RESPONSE_TEMPLATES.openai;
      const latencyMs = 350 + Math.floor(Math.random() * 650);

      await delay(latencyMs);

      const content = template(trimmed, modelMeta);
      const inputTokens = estimateTokens(trimmed);
      const outputTokens = Math.min(estimateTokens(content), Number(maxTokens) || 2048);

      return {
        content,
        provider: providerName,
        model: modelMeta.displayName,
        modelId: modelMeta.id,
        temperature: Number(temperature) || 0.7,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        latencyMs,
      };
    },
  };
})();
