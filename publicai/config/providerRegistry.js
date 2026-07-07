(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaProviderRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const modelRegistry =
    typeof ZwimaModelRegistry !== "undefined" ? ZwimaModelRegistry : require("./modelRegistry.js");

  const PROVIDER_DEFS = [
    {
      id: "openai",
      name: "OpenAI",
      status: "active",
      enabled: true,
      priority: 1,
      defaultModel: "gpt-4o",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: true,
      supportsImageGeneration: true,
      apiBaseUrl: "https://api.openai.com/v1",
      envKeys: ["OPENAI_API_KEY"],
      adapterId: "openai",
    },
    {
      id: "google",
      name: "Google Gemini",
      status: "active",
      enabled: true,
      priority: 2,
      defaultModel: "gemini-2-flash",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: true,
      supportsImageGeneration: false,
      apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      adapterId: "google",
    },
    {
      id: "anthropic",
      name: "Claude",
      status: "inactive",
      enabled: false,
      priority: 3,
      defaultModel: "claude-4-sonnet",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: false,
      supportsImageGeneration: false,
      apiBaseUrl: "https://api.anthropic.com/v1",
      envKeys: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
      adapterId: "anthropic",
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      status: "inactive",
      enabled: false,
      priority: 4,
      defaultModel: "deepseek-chat",
      supportsVision: false,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: false,
      supportsImageGeneration: false,
      apiBaseUrl: "https://api.deepseek.com/v1",
      envKeys: ["DEEPSEEK_API_KEY"],
      adapterId: "deepseek",
    },
    {
      id: "qwen",
      name: "Qwen",
      status: "inactive",
      enabled: false,
      priority: 5,
      defaultModel: "qwen-turbo",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: false,
      supportsImageGeneration: false,
      apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      envKeys: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
      adapterId: "qwen",
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      status: "inactive",
      enabled: false,
      priority: 6,
      defaultModel: "openrouter-auto",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: false,
      supportsImageGeneration: false,
      apiBaseUrl: "https://openrouter.ai/api/v1",
      envKeys: ["OPENROUTER_API_KEY"],
      adapterId: "openrouter",
    },
    {
      id: "xai",
      name: "xAI",
      status: "inactive",
      enabled: false,
      priority: 7,
      defaultModel: "grok-2",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: false,
      supportsImageGeneration: false,
      apiBaseUrl: "https://api.x.ai/v1",
      envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
      adapterId: "xai",
    },
    {
      id: "mistral",
      name: "Mistral",
      status: "inactive",
      enabled: false,
      priority: 8,
      defaultModel: "mistral-large",
      supportsVision: false,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: true,
      supportsImageGeneration: false,
      apiBaseUrl: "https://api.mistral.ai/v1",
      envKeys: ["MISTRAL_API_KEY"],
      adapterId: "mistral",
    },
    {
      id: "azure_openai",
      name: "Azure OpenAI",
      status: "inactive",
      enabled: false,
      priority: 9,
      defaultModel: "azure-gpt-4o",
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsEmbedding: true,
      supportsImageGeneration: true,
      apiBaseUrl: process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com/openai/deployments",
      envKeys: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
      adapterId: "azure_openai",
    },
  ];

  function isConfigured(def) {
    if (typeof process === "undefined" || !process.env) return false;
    return (def.envKeys || []).some((key) => Boolean(process.env[key]));
  }

  function buildProvider(def, runtime = {}, health = {}) {
    const modelList = modelRegistry.getByProvider(def.id).map((m) => m.id);
    const configured = isConfigured(def);
    return {
      providerId: def.id,
      providerName: def.name,
      id: def.id,
      name: def.name,
      status: runtime.enabled === false ? "disabled" : def.status,
      enabled: runtime.enabled !== undefined ? runtime.enabled : def.enabled && configured,
      modelList,
      supportsVision: def.supportsVision,
      supportsStreaming: def.supportsStreaming,
      supportsJsonMode: def.supportsJsonMode,
      supportsEmbedding: def.supportsEmbedding,
      supportsImageGeneration: def.supportsImageGeneration,
      apiBaseUrl: def.apiBaseUrl,
      healthStatus: health.healthStatus || (configured ? "unknown" : "not_configured"),
      lastCheck: health.lastCheck || null,
      priority: runtime.priority ?? def.priority,
      defaultModel: runtime.defaultModel ?? def.defaultModel,
      adapterId: def.adapterId,
      configured,
      latencyMs: health.latencyMs ?? null,
      totalRequests: health.totalRequests ?? 0,
      lastRequest: health.lastRequest ?? null,
    };
  }

  function getAll(runtimeMap = {}, healthMap = {}) {
    return PROVIDER_DEFS.map((def) => buildProvider(def, runtimeMap[def.id] || {}, healthMap[def.id] || {}));
  }

  function getById(id, runtimeMap = {}, healthMap = {}) {
    const def = PROVIDER_DEFS.find((p) => p.id === id);
    return def ? buildProvider(def, runtimeMap[id] || {}, healthMap[id] || {}) : null;
  }

  function getDefinition(id) {
    return PROVIDER_DEFS.find((p) => p.id === id) || null;
  }

  function getEnabled(runtimeMap = {}, healthMap = {}) {
    return getAll(runtimeMap, healthMap)
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  function resolveProviderForModel(modelId) {
    const model = modelRegistry.getById(modelRegistry.resolveId(modelId));
    return model?.provider || "openai";
  }

  return {
    PROVIDER_DEFS,
    getAll,
    getById,
    getDefinition,
    getEnabled,
    isConfigured,
    resolveProviderForModel,
    getAdapterId(providerId) {
      return getDefinition(providerId)?.adapterId || providerId;
    },
  };
});
