(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.ZwimaProviders = root.ZwimaProviders || {};
    root.ZwimaProviders.ProviderManager = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const load = (name, globalKey) => {
    if (typeof globalThis[globalKey] !== "undefined") return globalThis[globalKey];
    if (typeof globalThis.ZwimaProviders?.[name] !== "undefined") {
      return globalThis.ZwimaProviders[name];
    }
    return require(`./${name}`);
  };

  const registry = {
    openai: () => load("OpenAIAdapter", "ZwimaProviders.OpenAIAdapter"),
    anthropic: () => load("ClaudeAdapter", "ZwimaProviders.ClaudeAdapter"),
    google: () => load("GeminiAdapter", "ZwimaProviders.GeminiAdapter"),
    deepseek: () => load("DeepSeekAdapter", "ZwimaProviders.DeepSeekAdapter"),
    qwen: () => load("QwenAdapter", "ZwimaProviders.QwenAdapter"),
  };

  function getAdapter(providerId) {
    const factory = registry[providerId];
    return factory ? factory() : null;
  }

  return {
    get(providerId) {
      return getAdapter(providerId);
    },

    list() {
      return Object.keys(registry)
        .map((id) => getAdapter(id))
        .filter(Boolean);
    },

    listEnabled() {
      return this.list().filter((adapter) => adapter.enabled);
    },

    listModels(providerId) {
      const adapter = getAdapter(providerId);
      if (!adapter) throw new Error(`Unknown provider: ${providerId}`);
      return adapter.listModels();
    },

    calculateCost(providerId, inputTokens, outputTokens, modelId) {
      const adapter = getAdapter(providerId);
      if (!adapter) throw new Error(`Unknown provider: ${providerId}`);
      return adapter.calculateCost(inputTokens, outputTokens, modelId);
    },

    async chat(providerId, payload) {
      const adapter = getAdapter(providerId);
      if (!adapter) throw new Error(`Unknown provider: ${providerId}`);
      if (!adapter.enabled) {
        throw new Error(`${adapter.name} provider is not enabled yet.`);
      }
      return adapter.chat(payload);
    },
  };
});
