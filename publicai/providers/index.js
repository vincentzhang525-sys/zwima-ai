(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaProviders = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const load = (name) => {
    if (typeof globalThis.ZwimaProviders?.[name] !== "undefined") {
      return globalThis.ZwimaProviders[name];
    }
    return require(`./${name}`);
  };

  require("./BaseProvider");
  load("OpenAIAdapter");
  load("ClaudeAdapter");
  load("GeminiAdapter");
  load("DeepSeekAdapter");
  load("QwenAdapter");
  const ProviderManager = load("ProviderManager");

  return {
    ProviderManager,
    OpenAIAdapter: load("OpenAIAdapter"),
    ClaudeAdapter: load("ClaudeAdapter"),
    GeminiAdapter: load("GeminiAdapter"),
    DeepSeekAdapter: load("DeepSeekAdapter"),
    QwenAdapter: load("QwenAdapter"),
  };
});
