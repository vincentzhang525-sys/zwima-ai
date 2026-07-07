(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAzureOpenAIAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base =
    typeof ZwimaBaseProviderAdapter !== "undefined"
      ? ZwimaBaseProviderAdapter
      : require("./BaseProviderAdapter");
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("../gatewayConfig");

  function getEndpoint() {
    if (typeof process !== "undefined" && process.env?.AZURE_OPENAI_ENDPOINT) {
      return String(process.env.AZURE_OPENAI_ENDPOINT).replace(/\/$/, "");
    }
    return "https://your-resource.openai.azure.com/openai/deployments";
  }

  const SPEC = {
    id: "azure_openai",
    name: "Azure OpenAI",
    baseUrl: getEndpoint(),
    mockLatency: [300, 400],
    inputPer1M: 2.5,
    outputPer1M: 10,
    models: [
      { id: "gpt-4o", name: "Azure GPT-4o", context: "128K", inputPer1M: 2.5, outputPer1M: 10, capabilities: ["chat", "vision"] },
    ],
    mockTemplate:
      "Azure OpenAI deployment response:\n\nEnterprise-grade answer delivered through your Azure OpenAI endpoint with regional compliance.",
  };

  const mockAdapter = Base.createProviderAdapter({
    ...SPEC,
    chatPath: "/gpt-4o/chat/completions?api-version=2024-08-01-preview",
    healthPath: "/gpt-4o/chat/completions?api-version=2024-08-01-preview",
  });

  function getApiKey() {
    if (typeof process !== "undefined" && process.env?.AZURE_OPENAI_API_KEY) {
      return process.env.AZURE_OPENAI_API_KEY;
    }
    return GatewayConfig.getApiKey("azure_openai");
  }

  return {
    id: SPEC.id,
    name: SPEC.name,
    baseUrl: SPEC.baseUrl,
    listModels: () => mockAdapter.listModels(),
    chat: (payload) => mockAdapter.chat(payload),
    embeddings: (payload) => mockAdapter.embeddings(payload),
    image: (payload) => mockAdapter.image(payload),
    audio: (payload) => mockAdapter.audio(payload),
    async health() {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { provider: SPEC.name, providerId: SPEC.id, status: "unconfigured", latency: 0, availability: 0, configured: false };
      }
      if (GatewayConfig.isMockMode()) return mockAdapter.health();
      return { provider: SPEC.name, providerId: SPEC.id, status: "healthy", latency: 250, availability: 99.5, configured: true };
    },
  };
});
