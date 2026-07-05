(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaProviderAdapters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const load = (name, globalName) =>
    typeof globalThis[globalName] !== "undefined" ? globalThis[globalName] : require(`./${name}`);

  const adapters = {
    openai: load("OpenAIAdapter", "ZwimaOpenAIAdapter"),
    anthropic: load("AnthropicAdapter", "ZwimaAnthropicAdapter"),
    google: load("GoogleGeminiAdapter", "ZwimaGoogleGeminiAdapter"),
    deepseek: load("DeepSeekAdapter", "ZwimaDeepSeekAdapter"),
    qwen: load("QwenAdapter", "ZwimaQwenAdapter"),
    mistral: load("MistralAdapter", "ZwimaMistralAdapter"),
    openrouter: load("OpenRouterAdapter", "ZwimaOpenRouterAdapter"),
    openai_compatible: load("OpenAICompatibleAdapter", "ZwimaOpenAICompatibleAdapter"),
  };

  const nameToId = {
    OpenAI: "openai",
    Anthropic: "anthropic",
    Claude: "anthropic",
    Gemini: "google",
    "Google Gemini": "google",
    DeepSeek: "deepseek",
    Qwen: "qwen",
    Mistral: "mistral",
    OpenRouter: "openrouter",
    "OpenAI Compatible": "openai_compatible",
  };

  return {
    adapters,
    getAdapter(idOrName) {
      const key = adapters[idOrName] ? idOrName : nameToId[idOrName] || idOrName;
      return adapters[key] || null;
    },
    listAdapterIds() {
      return Object.keys(adapters);
    },
    listAdapters() {
      return Object.values(adapters);
    },
  };
});
