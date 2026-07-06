(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaModelConfig = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PROVIDER_NAMES = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    deepseek: "DeepSeek",
    mistral: "Mistral",
  };

  const MODELS = [
    {
      id: "gpt-4o",
      displayName: "GPT-4o",
      provider: "openai",
      contextWindow: 128000,
      inputPrice: 2.5,
      outputPrice: 10,
    },
    {
      id: "gpt-4.1",
      displayName: "GPT-4.1",
      provider: "openai",
      contextWindow: 128000,
      inputPrice: 2,
      outputPrice: 8,
    },
    {
      id: "o1-mini",
      displayName: "o1-mini",
      provider: "openai",
      contextWindow: 128000,
      inputPrice: 3,
      outputPrice: 12,
    },
    {
      id: "claude-4-sonnet",
      displayName: "Claude 4 Sonnet",
      provider: "anthropic",
      contextWindow: 200000,
      inputPrice: 3,
      outputPrice: 15,
    },
    {
      id: "claude-4-opus",
      displayName: "Claude 4 Opus",
      provider: "anthropic",
      contextWindow: 200000,
      inputPrice: 15,
      outputPrice: 75,
    },
    {
      id: "claude-3-5-haiku",
      displayName: "Claude 3.5 Haiku",
      provider: "anthropic",
      contextWindow: 200000,
      inputPrice: 0.8,
      outputPrice: 4,
    },
    {
      id: "gemini-2-flash",
      displayName: "Gemini 2.0 Flash",
      provider: "google",
      contextWindow: 1000000,
      inputPrice: 0.1,
      outputPrice: 0.4,
    },
    {
      id: "gemini-2-pro",
      displayName: "Gemini 2.0 Pro",
      provider: "google",
      contextWindow: 2000000,
      inputPrice: 1.25,
      outputPrice: 5,
    },
    {
      id: "deepseek-v3",
      displayName: "DeepSeek V3",
      provider: "deepseek",
      contextWindow: 64000,
      inputPrice: 0.27,
      outputPrice: 1.1,
    },
    {
      id: "deepseek-r1",
      displayName: "DeepSeek R1",
      provider: "deepseek",
      contextWindow: 64000,
      inputPrice: 0.55,
      outputPrice: 2.19,
    },
    {
      id: "mistral-large",
      displayName: "Mistral Large",
      provider: "mistral",
      contextWindow: 128000,
      inputPrice: 2,
      outputPrice: 6,
    },
    {
      id: "mistral-small",
      displayName: "Mistral Small",
      provider: "mistral",
      contextWindow: 128000,
      inputPrice: 0.2,
      outputPrice: 0.6,
    },
  ];

  const REASONING_MODEL_IDS = new Set(["o1-mini", "o1-preview", "o1", "o3-mini"]);

  function getAll() {
    return MODELS.slice();
  }

  function getOpenAIModels() {
    return MODELS.filter((model) => model.provider === "openai");
  }

  function getByProvider(providerId) {
    return MODELS.filter((model) => model.provider === providerId);
  }

  function getById(id) {
    return MODELS.find((model) => model.id === id) || null;
  }

  function getProviderName(providerId) {
    return PROVIDER_NAMES[providerId] || providerId;
  }

  function getProviderIds() {
    return [...new Set(MODELS.map((model) => model.provider))];
  }

  function resolveId(modelRef) {
    const value = String(modelRef || "").trim();
    if (!value) return "gpt-4o";
    const byId = getById(value);
    if (byId) return byId.id;
    const byName = MODELS.find((model) => model.displayName === value);
    return byName?.id || value;
  }

  function isReasoningModel(modelRef) {
    return REASONING_MODEL_IDS.has(resolveId(modelRef));
  }

  return {
    MODELS,
    PROVIDER_NAMES,
    getAll,
    getOpenAIModels,
    getByProvider,
    getById,
    getProviderName,
    getProviderIds,
    resolveId,
    isReasoningModel,
  };
});
