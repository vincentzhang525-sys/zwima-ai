(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaModelConfig = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const registry =
    typeof ZwimaModelRegistry !== "undefined" ? ZwimaModelRegistry : require("./modelRegistry.js");

  const MODELS = registry.getLegacyAll();

  return {
    MODELS,
    PROVIDER_NAMES: registry.PROVIDER_NAMES,
    getAll: registry.getLegacyAll,
    getOpenAIModels() {
      return registry.getLegacyByProvider("openai");
    },
    getByProvider(providerId) {
      return registry.getLegacyByProvider(providerId);
    },
    getById(id) {
      const model = registry.getById(id);
      return model ? registry.toLegacy(model) : null;
    },
    getProviderName: registry.getProviderName,
    getProviderIds: registry.getProviderIds,
    resolveId: registry.resolveId,
    resolveApiId: registry.resolveApiId,
    isReasoningModel: registry.isReasoningModel,
    registry,
  };
});
