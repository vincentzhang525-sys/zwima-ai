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
      apiId: "gpt-4o",
      displayName: "GPT-4o",
      provider: "openai",
      contextWindow: 128000,
      inputPrice: 2.5,
      outputPrice: 10,
    },
    {
      id: "gpt-4.1",
      apiId: "gpt-4.1",
      displayName: "GPT-4.1",
      provider: "openai",
      contextWindow: 128000,
      inputPrice: 2,
      outputPrice: 8,
    },
    {
      id: "o1-mini",
      apiId: "o4-mini",
      displayName: "o1-mini",
      provider: "openai",
      contextWindow: 200000,
      inputPrice: 0.55,
      outputPrice: 2.2,
    },
    {
      id: "claude-4-sonnet",
      apiId: "claude-sonnet-4-20250514",
      displayName: "Claude 4 Sonnet",
      provider: "anthropic",
      contextWindow: 200000,
      inputPrice: 3,
      outputPrice: 15,
    },
    {
      id: "claude-4-opus",
      apiId: "claude-opus-4-20250514",
      displayName: "Claude 4 Opus",
      provider: "anthropic",
      contextWindow: 200000,
      inputPrice: 15,
      outputPrice: 75,
    },
    {
      id: "claude-3-5-haiku",
      apiId: "claude-3-5-haiku-latest",
      displayName: "Claude 3.5 Haiku",
      provider: "anthropic",
      contextWindow: 200000,
      inputPrice: 0.8,
      outputPrice: 4,
    },
    {
      id: "gemini-2-flash",
      apiId: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      provider: "google",
      contextWindow: 1000000,
      inputPrice: 0.1,
      outputPrice: 0.4,
    },
    {
      id: "gemini-2-pro",
      apiId: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      provider: "google",
      contextWindow: 2000000,
      inputPrice: 1.25,
      outputPrice: 5,
    },
    {
      id: "deepseek-chat",
      displayName: "DeepSeek Chat",
      provider: "deepseek",
      contextWindow: 128000,
      inputPrice: 0.27,
      outputPrice: 1.1,
    },
    {
      id: "deepseek-reasoner",
      displayName: "DeepSeek Reasoner",
      provider: "deepseek",
      contextWindow: 128000,
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

  const REASONING_MODEL_IDS = new Set([
    "o1-mini",
    "o4-mini",
    "o3-mini",
    "o1-preview",
    "o1",
    "o3",
    "deepseek-reasoner",
  ]);

  const OPENAI_API_ALIASES = {
    "o1-preview": "o3",
    o1: "o1",
  };

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
    const aliases = {
      "deepseek-v3": "deepseek-chat",
      "deepseek-r1": "deepseek-reasoner",
    };
    const normalized = aliases[value] || value;
    const byId = getById(normalized);
    if (byId) return byId.id;
    const byName = MODELS.find((model) => model.displayName === normalized);
    return byName?.id || normalized;
  }

  function resolveApiId(modelRef) {
    const id = resolveId(modelRef);
    const model = getById(id);
    if (model?.apiId) return model.apiId;
    if (model?.provider === "openai" && OPENAI_API_ALIASES[id]) {
      return OPENAI_API_ALIASES[id];
    }
    return id;
  }

  function isReasoningModel(modelRef) {
    const id = resolveId(modelRef);
    const apiId = resolveApiId(modelRef);
    return REASONING_MODEL_IDS.has(id) || REASONING_MODEL_IDS.has(apiId);
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
    resolveApiId,
    isReasoningModel,
  };
});
