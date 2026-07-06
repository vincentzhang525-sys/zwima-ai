(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaBaseProvider = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function getModelConfig() {
    if (typeof window !== "undefined" && window.ZwimaModelConfig) {
      return window.ZwimaModelConfig;
    }
    return require("../config/models.js");
  }

  function createPlaceholderAdapter(spec) {
    const providerId = spec.providerId;

    return {
      id: providerId,
      name: spec.name,
      enabled: false,

      listModels() {
        return getModelConfig().getByProvider(providerId);
      },

      calculateCost(inputTokens, outputTokens, modelId) {
        const model = getModelConfig().getById(modelId);
        if (!model) return 0;
        const input = Number(inputTokens) || 0;
        const output = Number(outputTokens) || 0;
        return Number(
          ((input * model.inputPrice + output * model.outputPrice) / 1_000_000).toFixed(6)
        );
      },

      async chat() {
        throw new Error(`${spec.name} provider is not enabled yet.`);
      },
    };
  }

  function createEnabledAdapter(spec) {
    return {
      id: spec.providerId,
      name: spec.name,
      enabled: true,

      listModels() {
        return getModelConfig().getByProvider(spec.providerId);
      },

      calculateCost(inputTokens, outputTokens, modelId) {
        const model = getModelConfig().getById(modelId);
        if (!model) return 0;
        const input = Number(inputTokens) || 0;
        const output = Number(outputTokens) || 0;
        return Number(
          ((input * model.inputPrice + output * model.outputPrice) / 1_000_000).toFixed(6)
        );
      },

      chat: spec.chat,
    };
  }

  return {
    getModelConfig,
    createPlaceholderAdapter,
    createEnabledAdapter,
  };
});
