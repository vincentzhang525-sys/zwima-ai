(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaModelRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MODELS = [
    { id: "gpt-4o", apiId: "gpt-4o", displayName: "GPT-4o", provider: "openai", contextLength: 128000, inputCost: 2.5, outputCost: 10, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "active" },
    { id: "gpt-4.1", apiId: "gpt-4.1", displayName: "GPT-4.1", provider: "openai", contextLength: 128000, inputCost: 2, outputCost: 8, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "active" },
    { id: "o1-mini", apiId: "o4-mini", displayName: "o1-mini", provider: "openai", contextLength: 200000, inputCost: 0.55, outputCost: 2.2, supportsVision: false, supportsFunctionCalling: false, supportsJson: false, supportsStreaming: false, status: "active" },
    { id: "claude-4-sonnet", apiId: "claude-sonnet-4-20250514", displayName: "Claude 4 Sonnet", provider: "anthropic", contextLength: 200000, inputCost: 3, outputCost: 15, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "claude-4-opus", apiId: "claude-opus-4-20250514", displayName: "Claude 4 Opus", provider: "anthropic", contextLength: 200000, inputCost: 15, outputCost: 75, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "claude-3-5-haiku", apiId: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku", provider: "anthropic", contextLength: 200000, inputCost: 0.8, outputCost: 4, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "gemini-2-flash", apiId: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", provider: "google", contextLength: 1000000, inputCost: 0.1, outputCost: 0.4, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "active" },
    { id: "gemini-2-pro", apiId: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "google", contextLength: 2000000, inputCost: 1.25, outputCost: 5, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "active" },
    { id: "deepseek-chat", apiId: "deepseek-chat", displayName: "DeepSeek Chat", provider: "deepseek", contextLength: 128000, inputCost: 0.27, outputCost: 1.1, supportsVision: false, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "deepseek-reasoner", apiId: "deepseek-reasoner", displayName: "DeepSeek Reasoner", provider: "deepseek", contextLength: 128000, inputCost: 0.55, outputCost: 2.19, supportsVision: false, supportsFunctionCalling: false, supportsJson: false, supportsStreaming: true, status: "inactive" },
    { id: "qwen-turbo", apiId: "qwen-turbo", displayName: "Qwen Turbo", provider: "qwen", contextLength: 128000, inputCost: 0.3, outputCost: 0.6, supportsVision: false, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "qwen-plus", apiId: "qwen-plus", displayName: "Qwen Plus", provider: "qwen", contextLength: 128000, inputCost: 0.8, outputCost: 2, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "mistral-large", apiId: "mistral-large-latest", displayName: "Mistral Large", provider: "mistral", contextLength: 128000, inputCost: 2, outputCost: 6, supportsVision: false, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "mistral-small", apiId: "mistral-small-latest", displayName: "Mistral Small", provider: "mistral", contextLength: 128000, inputCost: 0.2, outputCost: 0.6, supportsVision: false, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "openrouter-auto", apiId: "openrouter/auto", displayName: "OpenRouter Auto", provider: "openrouter", contextLength: 128000, inputCost: 0.4, outputCost: 1.2, supportsVision: false, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "grok-2", apiId: "grok-2-latest", displayName: "Grok 2", provider: "xai", contextLength: 131072, inputCost: 2, outputCost: 10, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
    { id: "azure-gpt-4o", apiId: "gpt-4o", displayName: "Azure GPT-4o", provider: "azure_openai", contextLength: 128000, inputCost: 2.5, outputCost: 10, supportsVision: true, supportsFunctionCalling: true, supportsJson: true, supportsStreaming: true, status: "inactive" },
  ];

  const REASONING_MODEL_IDS = new Set(["o1-mini", "o4-mini", "o3-mini", "o1-preview", "o1", "o3", "deepseek-reasoner"]);
  const OPENAI_API_ALIASES = { "o1-preview": "o3", o1: "o1" };
  const PROVIDER_NAMES = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    mistral: "Mistral",
    openrouter: "OpenRouter",
    xai: "xAI",
    azure_openai: "Azure OpenAI",
  };

  function getAll() {
    return MODELS.map((m) => ({ ...m }));
  }

  function getActive() {
    return MODELS.filter((m) => m.status === "active").map((m) => ({ ...m }));
  }

  function getByProvider(providerId) {
    return MODELS.filter((m) => m.provider === providerId).map((m) => ({ ...m }));
  }

  function getById(id) {
    const model = MODELS.find((m) => m.id === id);
    return model ? { ...model } : null;
  }

  function getProviderName(providerId) {
    return PROVIDER_NAMES[providerId] || providerId;
  }

  function getProviderIds() {
    return [...new Set(MODELS.map((m) => m.provider))];
  }

  function resolveId(modelRef) {
    const value = String(modelRef || "").trim();
    if (!value) return "gpt-4o";
    const aliases = { "deepseek-v3": "deepseek-chat", "deepseek-r1": "deepseek-reasoner" };
    const normalized = aliases[value] || value;
    if (getById(normalized)) return normalized;
    const byName = MODELS.find((m) => m.displayName === normalized);
    return byName?.id || normalized;
  }

  function resolveApiId(modelRef) {
    const id = resolveId(modelRef);
    const model = getById(id);
    if (model?.apiId) return model.apiId;
    if (model?.provider === "openai" && OPENAI_API_ALIASES[id]) return OPENAI_API_ALIASES[id];
    return id;
  }

  function isReasoningModel(modelRef) {
    const id = resolveId(modelRef);
    const apiId = resolveApiId(modelRef);
    return REASONING_MODEL_IDS.has(id) || REASONING_MODEL_IDS.has(apiId);
  }

  function toLegacy(model) {
    return {
      id: model.id,
      apiId: model.apiId,
      displayName: model.displayName,
      provider: model.provider,
      contextWindow: model.contextLength,
      inputPrice: model.inputCost,
      outputPrice: model.outputCost,
    };
  }

  return {
    MODELS,
    PROVIDER_NAMES,
    getAll,
    getActive,
    getByProvider,
    getById,
    getProviderName,
    getProviderIds,
    resolveId,
    resolveApiId,
    isReasoningModel,
    toLegacy,
    getLegacyAll() {
      return getAll().map(toLegacy);
    },
    getLegacyByProvider(providerId) {
      return getByProvider(providerId).map(toLegacy);
    },
  };
});
