(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaSecrets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ENV_MAP = {
    openai: ["OPENAI_API_KEY"],
    google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY"],
    qwen: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
    mistral: ["MISTRAL_API_KEY"],
    openrouter: ["OPENROUTER_API_KEY"],
    xai: ["XAI_API_KEY", "GROK_API_KEY"],
    azure_openai: ["AZURE_OPENAI_API_KEY"],
    openai_compatible: ["OPENAI_COMPATIBLE_API_KEY"],
  };

  function cfg() {
    return (typeof window !== "undefined" ? window.ZWIMA_CONFIG : global.ZWIMA_CONFIG) || {};
  }

  function fromEnv() {
    if (typeof process === "undefined" || !process.env) return {};
    const env = {};
    Object.entries(ENV_MAP).forEach(([id, keys]) => {
      env[id] = keys.map((k) => process.env[k]).find(Boolean) || null;
    });
    env.default = process.env.ZWIMA_API_KEY || null;
    return env;
  }

  function fromConfig() {
    return { openai: null, default: null };
  }

  function getApiKey(providerId) {
    const env = fromEnv();
    const conf = fromConfig();
    if (providerId === "openai") return env.openai || conf.openai || conf.default || null;
    return env[providerId] || conf[providerId] || conf.default || env.default || null;
  }

  function hasKey(providerId) {
    return !!getApiKey(providerId);
  }

  function hasOpenAIKey() {
    return hasKey("openai");
  }

  return { getApiKey, hasOpenAIKey, hasKey, fromEnv, fromConfig, ENV_MAP };
});
